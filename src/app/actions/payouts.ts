import { createClient } from "@/app/lib/supabase/server";
import { getStripe } from "@/app/lib/stripe/server";

export async function releaseFundsToCoach(bookingId: string, supabaseClient?: any) {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe not configured on server" };
  const supabase = supabaseClient || (await createClient());

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

    // 2. Auth check: If there is an authenticated user session, check if they are authorized
    // (This prevents internal server action invocation by unauthorized logged-in users)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const isPlayer = user.id === booking.player_id;
      const isCoach = user.id === booking.coach_id;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const isAdmin = profile?.role === "admin";

      if (!isPlayer && !isCoach && !isAdmin) {
        return { error: "Not authorized to release funds for this booking." };
      }
    }

    // Allow payout if confirmed with both-party confirmation, or legacy confirmed status
    if (booking.status === "completed") {
      return { error: "Funds already released for this session." };
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

    // 1. Transfer funds from Platform to Coach's Stripe Balance
    // Rate is what the coach is owed (the total is rate + platform fee)
    const transferAmountCents = Math.round(booking.rate * 100);
    const transfer = await stripe.transfers.create({
      amount: transferAmountCents,
      currency: "usd",
      destination: stripeAccountId,
      description: `Payout for session ${booking.id}`,
    }, {
      idempotencyKey: `release-funds-${bookingId}`,
    });

    // 2. Update the booking status to "completed" so it doesn't get paid twice
    const { error: updateErr } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", bookingId);

    if (updateErr) {
      console.error("Failed to update booking status after payout:", updateErr);
      return { error: "Transfer successful but failed to update status." };
    }

    return { 
      success: true, 
      transferId: transfer.id, 
    };
  } catch (err: unknown) {
    console.error("Stripe Transfer Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to release funds." };
  }
}

