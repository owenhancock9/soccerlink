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
      console.log("No webhook secret configured. Skipping signature validation (not recommended for production).");
      event = JSON.parse(body);
    } else {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    }
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Handle successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.client_reference_id;

    if (bookingId) {
      // Use service role key to bypass Row Level Security since this is a server-to-server webhook
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabaseAdmin
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", bookingId);

      if (error) {
        console.error("Error updating booking status:", error);
        return NextResponse.json({ error: "Failed to update database" }, { status: 500 });
      }

      console.log(`Successfully confirmed booking ${bookingId}`);
    }
  }

  return NextResponse.json({ received: true });
}
