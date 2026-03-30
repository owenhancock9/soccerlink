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
    
    // Deployment URL from Vercel
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }

    // Default for local development
    return "http://localhost:3000";
  };

  const baseUrl = getBaseUrl();
  const stripe = getStripe();

  if (!stripe) {
    return { error: "CRITICAL_CONFIG_ERROR: Stripe Secret Key is missing in your Vercel Dashboard. Please add STRIPE_SECRET_KEY to your Environment Variables." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  try {
    // 1. Check if coach already has a Stripe Account ID
    const { data: profile } = await supabase
      .from("coach_profiles")
      .select("stripe_account_id")
      .eq("id", user.id)
      .single();

    let accountId = profile?.stripe_account_id;

    // 2. If not, create a new Express account
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      // Save ID to database (using upsert to handle cases where profile doesn't exist yet)
      await supabase
        .from("coach_profiles")
        .upsert({ 
          id: user.id, 
          stripe_account_id: accountId 
        });
    }

    // 3. Create an onboarding link
    const returnPath = `${baseUrl}?setup=success`;
    console.log(`[Stripe Onboarding] Generating link for ${user.id} | Return Path: ${returnPath}`);
    
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}`,
      return_url: returnPath,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  } catch (err: unknown) {
    console.error("Stripe Connect Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to initialize Stripe Connect." };
  }
}
