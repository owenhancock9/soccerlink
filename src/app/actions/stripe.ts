"use server";

import { createClient } from "@/app/lib/supabase/server";
import { getStripe } from "@/app/lib/stripe/server";

export async function createStripeConnectAccount(rootUrl?: string) {
  const getBaseUrl = () => {
    if (rootUrl) return rootUrl;
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return process.env.NEXT_PUBLIC_SITE_URL.endsWith("/")
        ? process.env.NEXT_PUBLIC_SITE_URL.slice(0, -1)
        : process.env.NEXT_PUBLIC_SITE_URL;
    }
    
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }

    return "http://localhost:3000";
  };

  const baseUrl = getBaseUrl();
  const stripe = getStripe();

  if (!stripe) {
    return { error: "Stripe configuration missing. Ensure STRIPE_SECRET_KEY is set." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    // 1. Find or sync existing account
    const { data: profile } = await supabase
      .from("coach_profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", user.id)
      .single();

    let accountId = profile?.stripe_account_id;

    // If we have an account ID but it's not marked as complete, sync it once.
    if (profile?.stripe_account_id && !profile?.stripe_onboarding_complete && stripe) {
      try {
        const account = await stripe.accounts.retrieve(profile.stripe_account_id);
        
        // payouts_enabled is the ultimate goal, charges_enabled is a good proxy.
        const isComplete = !!(account.details_submitted || account.payouts_enabled || account.charges_enabled);

        if (isComplete) {
          const { error: updateErr } = await supabase
            .from("coach_profiles")
            .update({ stripe_onboarding_complete: true })
            .eq("id", user.id);
          
          if (updateErr) {
            console.error("DB Sync Update Failed:", updateErr);
          } else {
            return { success: true, alreadyComplete: true };
          }
        }
      } catch (err) {
        console.error("[Stripe Sync Alert] Couldn't fetch account status:", err);
      }
    }

    if (profile?.stripe_onboarding_complete) return { success: true, alreadyComplete: true };

    // 2. Create if missing
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: { transfers: { requested: true } },
        metadata: { supabase_user_id: user.id }
      });
      accountId = account.id;

      const { error: upsertErr } = await supabase
        .from("coach_profiles")
        .upsert({ 
          id: user.id, 
          stripe_account_id: accountId,
          stripe_onboarding_complete: false
        });
      
      if (upsertErr) {
        console.error("[STRIPE_DB_FAILURE] Upsert failed:", upsertErr);
        return { error: `Database Error: ${upsertErr.message}. Check your Supabase RLS policies for coach_profiles.` };
      }
    }

    // 3. Generate Link
    const returnPath = `${baseUrl}?setup=success`;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}`,
      return_url: returnPath,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  } catch (err: unknown) {
    console.error("Stripe Action Error:", err);
    return { error: err instanceof Error ? err.message : "Stripe initialization failed." };
  }
}
