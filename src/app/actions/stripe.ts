"use server";

import { createClient } from "@/app/lib/supabase/server";
import { getStripe } from "@/app/lib/stripe/server";

export async function createStripeConnectAccount(rootUrl?: string) {
  const getBaseUrl = () => {
    if (rootUrl) return rootUrl;
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
    return "http://localhost:3000";
  };

  const baseUrl = getBaseUrl();
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe missing" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    const { data: profile } = await supabase.from("coach_profiles").select("*").eq("id", user.id).single();
    let accountId = profile?.stripe_account_id;

    if (accountId) {
      // Ensure existing account is on the fastest free payout schedule (Daily)
      await stripe.accounts.update(accountId, {
        settings: { payouts: { schedule: { interval: "daily" } } }
      }).catch(e => console.warn("Failed to set daily payout schedule:", e.message));

      const account = await stripe.accounts.retrieve(accountId);
      const isComplete = !!(account.details_submitted || account.payouts_enabled);
      if (isComplete) {
        await supabase.from("coach_profiles").update({ stripe_onboarding_complete: true }).eq("id", user.id);
        return { success: true, alreadyComplete: true };
      }
    } else {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: { transfers: { requested: true } },
        settings: { payouts: { schedule: { interval: "daily" } } }
      }, {
        idempotencyKey: `stripe-connect-${user.id}`
      });
      accountId = account.id;

      // Upsert to handle both cases: profile row exists or doesn't exist yet
      // (update silently succeeds with 0 rows if no coach_profiles row exists)
      const { error: upsertErr } = await supabase.from("coach_profiles").upsert({ 
        id: user.id, 
        stripe_account_id: accountId,
        stripe_onboarding_complete: false
      });
      if (upsertErr) return { error: `DB Error: ${upsertErr.message}` };
    }

    const returnPath = `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}coach/edit?setup=success`;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/coach/edit`,
      return_url: returnPath,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

/** 
 * DESTRUCTIVE RESET: Only for stuck states 
 */
export async function resetStripeConnection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Auth missing" };

  const { error } = await supabase
    .from("coach_profiles")
    .update({ stripe_account_id: null, stripe_onboarding_complete: false })
    .eq("id", user.id);
  
  if (error) return { error: error.message };
  return { success: true };
}
