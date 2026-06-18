import { NextResponse } from "next/server";
import { getStripe } from "@/app/lib/stripe/server";
import { createAdminClient } from "@/app/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const stripe = getStripe();
  if (!stripe) {
    console.error("Stripe Secret Key missing in webhook handler");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured on the server.");
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
  }

  if (!sig) {
    console.error("stripe-signature header missing in webhook request.");
    return NextResponse.json({ error: "Missing signature header" }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook error";
    console.error("Webhook verification error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Handle successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.client_reference_id;

    if (bookingId) {
      const supabaseAdmin = createAdminClient();

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
      const supabaseAdmin = createAdminClient();

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

