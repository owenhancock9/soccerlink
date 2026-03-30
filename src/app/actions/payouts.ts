"use server";

import { createClient } from "@/app/lib/supabase/server";
import { getStripe } from "@/app/lib/stripe/server";

export async function releaseFundsToCoach(bookingId: string) {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe not configured on server" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  try {
    // 1. Fetch the booking to verify it exists and is ready for payout
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("*, coach:coach_profiles(stripe_account_id)")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) {
      return { error: "Booking not found." };
    }

    if (booking.status !== "confirmed") {
      return { error: "Funds cannot be released. Session must be confirmed." };
    }

    const stripeAccountId = booking.coach?.stripe_account_id;

    if (!stripeAccountId) {
      return {
        error: "Coach has not connected a verified Stripe account yet.",
      };
    }

    // 2. Transfer funds to Coach
    // Rate is what the coach is owed (the total is rate + platform fee)
    const transferAmountCents = Math.round(booking.rate * 100);
    // 4. Create transfer to coach account
    const stripe = getStripe();
    if (!stripe) return { error: "Stripe not configured on server" };
    const transfer = await stripe.transfers.create({
      amount: transferAmountCents,
      currency: "usd",
      destination: stripeAccountId,
      description: `Payout for session ${booking.id}`,
    });

    // 3. Update the booking status to "completed" so it doesn't get paid twice
    const { error: updateErr } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", bookingId);

    if (updateErr) {
      console.error("Failed to update booking status after payout:", updateErr);
      return { error: "Transfer successful but failed to update status." };
    }

    return { success: true, transferId: transfer.id };
  } catch (err: unknown) {
    console.error("Stripe Transfer Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to release funds." };
  }
}
