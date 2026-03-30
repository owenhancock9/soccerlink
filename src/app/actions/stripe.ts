"use server";

import { createClient } from "@/app/lib/supabase/server";
import { stripe } from "@/app/lib/stripe/server";

export async function createStripeConnectAccount() {
  const getBaseUrl = () => {
    let url = process.env.NEXT_PUBLIC_SITE_URL ?? "https://coachingmatch.co";
    url = url.includes("http") ? url : `https://${url}`;
    return url.endsWith("/") ? url.slice(0, -1) : url;
  };
  const baseUrl = getBaseUrl();
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

      // Save ID to database
      await supabase
        .from("coach_profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);
    }

    // 3. Create an onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}`,
      return_url: `${baseUrl}?setup=success`,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  } catch (err: any) {
    console.error("Stripe Connect Error:", err);
    return { error: "Failed to initialize Stripe Connect." };
  }
}
