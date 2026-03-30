import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (!webhookSecret) {
      console.log(
        "No webhook secret configured. Skipping signature validation (not recommended for production).",
      );
      event = JSON.parse(body);
    } else {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook error";
    console.error("Webhook error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Handle successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.client_reference_id;

    if (bookingId) {
      // Use service role key to bypass Row Level Security since this is a server-to-server webhook
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error } = await supabaseAdmin
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", bookingId);

      if (error) {
        console.error("Error updating booking status:", error);
        return NextResponse.json(
          { error: "Failed to update database" },
          { status: 500 },
        );
      }

      console.log(`Successfully confirmed booking ${bookingId}`);
    }
  } else if (event.type === "account.updated") {
    const account = event.data.object;

    // Check if the coach has finished onboarding
    if (account.details_submitted) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error } = await supabaseAdmin
        .from("coach_profiles")
        .update({ stripe_onboarding_complete: true })
        .eq("stripe_account_id", account.id);

      if (error) {
        console.error("Error updating coach onboarding status:", error);
      } else {
        console.log(
          `Coach onboarding completed for Stripe account ${account.id}`,
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
