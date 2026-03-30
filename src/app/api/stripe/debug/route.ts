import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getStripe } from "@/app/lib/stripe/server";

export async function GET(request: NextRequest) {
  const results: string[] = [];
  
  // Step 1: Check Stripe
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set in environment" });
  }
  results.push("✅ Stripe client initialized");

  // Step 2: Check auth
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated", authErr: authErr?.message });
  }
  results.push(`✅ Authenticated as ${user.id} (${user.email})`);

  // Step 3: Check profile
  const { data: profile, error: profileErr } = await supabase
    .from("coach_profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  
  if (profileErr) {
    results.push(`❌ Profile error: ${profileErr.message}`);
  } else {
    results.push(`✅ Profile found: stripe_account_id=${profile.stripe_account_id || "NONE"}, onboarding_complete=${profile.stripe_onboarding_complete}`);
  }

  // Step 4: If no stripe_account_id, create one
  const action = request.nextUrl.searchParams.get("action");
  
  if (action === "connect") {
    try {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: { transfers: { requested: true } }
      });
      results.push(`✅ Created Stripe account: ${account.id}`);

      // Save to DB
      const { error: updateErr } = await supabase
        .from("coach_profiles")
        .update({ stripe_account_id: account.id, stripe_onboarding_complete: false })
        .eq("id", user.id);
      
      if (updateErr) {
        results.push(`❌ DB update failed: ${updateErr.message}`);
        return NextResponse.json({ results, error: updateErr.message });
      }
      results.push("✅ Saved account ID to database");

      // Create onboarding link
      const baseUrl = request.nextUrl.origin;
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${baseUrl}/coach/edit`,
        return_url: `${baseUrl}/coach/edit?setup=success`,
        type: "account_onboarding",
      });
      
      results.push(`✅ Onboarding link created`);
      
      // Redirect to Stripe
      return NextResponse.redirect(accountLink.url);
    } catch (err: any) {
      results.push(`❌ Stripe API error: ${err.message}`);
      return NextResponse.json({ results, error: err.message });
    }
  }

  // If stripe_account_id exists, check its status
  if (profile?.stripe_account_id) {
    try {
      const account = await stripe.accounts.retrieve(profile.stripe_account_id);
      results.push(`✅ Stripe account status: details_submitted=${account.details_submitted}, payouts_enabled=${account.payouts_enabled}`);
      
      if (account.details_submitted || account.payouts_enabled) {
        // Mark as complete
        await supabase
          .from("coach_profiles")
          .update({ stripe_onboarding_complete: true })
          .eq("id", user.id);
        results.push("✅ Marked onboarding as COMPLETE in database!");
      }
    } catch (err: any) {
      results.push(`❌ Stripe retrieve error: ${err.message}`);
    }
  }

  return NextResponse.json({
    results,
    profile: profile ? {
      id: profile.id,
      stripe_account_id: profile.stripe_account_id,
      stripe_onboarding_complete: profile.stripe_onboarding_complete,
    } : null,
    instructions: "Visit this URL with ?action=connect to create a new Stripe link and start onboarding"
  }, { status: 200 });
}
