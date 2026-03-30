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

    if (accountId) {
      // Periodic Sync Check
      const account = await stripe.accounts.retrieve(accountId);
      const isComplete = !!(account.details_submitted || account.charges_enabled);
      
      if (isComplete && !profile?.stripe_onboarding_complete) {
        await supabase.from("coach_profiles").update({ stripe_onboarding_complete: true }).eq("id", user.id);
        return { success: true, alreadyComplete: true };
      }
      
      if (isComplete) return { success: true, alreadyComplete: true };
    }

    // 2. Create if missing
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: { transfers: { requested: true } },
        metadata: { supabase_user_id: user.id }
      });
      accountId = account.id;

      await supabase.from("coach_profiles").upsert({ 
        id: user.id, 
        stripe_account_id: accountId,
        stripe_onboarding_complete: false
      });
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
