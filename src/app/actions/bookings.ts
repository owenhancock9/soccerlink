"use server";

import { createClient } from "@/app/lib/supabase/server";
import { getStripe } from "@/app/lib/stripe/server";
import { sendBookingNotification, sendSessionConfirmedEmail, sendFundsReleasedEmail, sendRatingReceivedEmail } from "./emails";
import { releaseFundsToCoach } from "./payouts";

export async function createBooking(formData: FormData) {
  const stripe = getStripe();
  if (!stripe) return { error: "Stripe is not configured on the server." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in to book a session." };

  const coachId = formData.get("coachId") as string;
  const sessionDate = formData.get("sessionDate") as string;
  const sessionTime = formData.get("sessionTime") as string;
  const baseRate = parseInt(formData.get("rate") as string);

  if (!coachId || !sessionDate || !sessionTime || !baseRate) {
    return { error: "Missing booking details." };
  }

  // Check if this is the player's first session
  const { data: activeBookings } = await supabase
    .from("bookings")
    .select("id, status, created_at")
    .eq("player_id", user.id);

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const hasPastBooking = activeBookings?.some(b => 
    b.status === "confirmed" || 
    b.status === "completed" || 
    (b.status === "pending" && new Date(b.created_at) > fifteenMinutesAgo)
  );
  const isFirstSession = !hasPastBooking;

  // 1. Tactical Pricing: 50% off for first session
  const rate = isFirstSession ? Math.max(1, Math.round(baseRate * 0.5)) : baseRate;

  // 2. Launch Promo: 0% Platform Commission
  const platformFee = 0;
  const total = rate + platformFee;

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      player_id: user.id,
      player_name: user?.user_metadata?.full_name || "Anonymous Player",
      player_email: user?.email || "No Email Provided",
      coach_id: coachId,
      session_date: sessionDate,
      session_time: sessionTime,
      rate,
      platform_fee: platformFee,
      total,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Booking error:", error);
    return { error: error.message };
  }

  // Email the coach about the new booking
  try {
    const { data: coachProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", coachId)
      .single();
    if (coachProfile?.email) {
      await sendBookingNotification(
        coachProfile.email,
        user?.user_metadata?.full_name || "A Player",
        sessionDate,
        sessionTime,
        rate,
      );
    }
  } catch (e) {
    console.warn("Failed to send booking email:", e);
  }

  const getBaseUrl = () => {
    let url = process.env.NEXT_PUBLIC_SITE_URL ?? "https://coachingmatch.co";
    url = url.includes("http") ? url : `https://${url}`;
    return url.endsWith("/") ? url.slice(0, -1) : url;
  };
  const baseUrl = getBaseUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Coaching Session`,
              description: `Session on ${sessionDate} at ${sessionTime}`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: user?.email,
      client_reference_id: data.id,
      success_url: `${baseUrl}/?success=true`,
      cancel_url: `${baseUrl}/?canceled=true`,
    }, {
      idempotencyKey: `checkout-session-${data.id}`,
    });

    return { success: true, booking: data, url: session.url };
  } catch (err: unknown) {
    console.error("Stripe Checkout Error:", err);
    // Clean up the pending booking if payment session creation fails
    await supabase.from("bookings").delete().eq("id", data.id);
    return { error: "Failed to create payment session." };
  }
}

/* ═══════════════════════════════════
   TWO-WAY SESSION CONFIRMATION
   ═══════════════════════════════════ */

interface ProfileJoin {
  full_name: string | null;
  email: string | null;
}

export async function confirmSession(bookingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch the booking
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("*, coach:profiles!bookings_coach_id_fkey(full_name, email), player:profiles!bookings_player_id_fkey(full_name, email)")
    .eq("id", bookingId)
    .single();

  if (fetchErr || !booking) return { error: "Booking not found." };
  if (booking.status !== "confirmed") return { error: "Session cannot be confirmed until payment is complete." };

  // Determine role
  const isCoach = user.id === booking.coach_id;
  const isPlayer = user.id === booking.player_id;
  if (!isCoach && !isPlayer) return { error: "Not authorized for this booking." };

  // Prevent double-confirm
  if (isCoach && booking.coach_confirmed_at) return { error: "You already confirmed this session." };
  if (isPlayer && booking.player_confirmed_at) return { error: "You already confirmed this session." };

  // Set the confirmation timestamp
  const now = new Date().toISOString();
  const updatePayload = isCoach
    ? { coach_confirmed_at: now }
    : { player_confirmed_at: now };

  const { error: updateErr } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", bookingId);

  if (updateErr) return { error: updateErr.message };

  // Check if BOTH sides have now confirmed
  const coachConfirmed = isCoach ? true : !!booking.coach_confirmed_at;
  const playerConfirmed = isPlayer ? true : !!booking.player_confirmed_at;

  // 1. Release funds if both parties have confirmed
  if (coachConfirmed && playerConfirmed) {
    const payoutResult = await releaseFundsToCoach(bookingId, supabase);
    if (payoutResult.error) {
      console.error("Auto-payout failed:", payoutResult.error);
    }
  }

  // 2. Send emails
  try {
    const confirmerName = isCoach
      ? (booking.coach as unknown as ProfileJoin)?.full_name || "Your Coach"
      : (booking.player as unknown as ProfileJoin)?.full_name || "Your Player";
    const recipientEmail = isCoach
      ? (booking.player as unknown as ProfileJoin)?.email
      : (booking.coach as unknown as ProfileJoin)?.email;

    if (coachConfirmed && playerConfirmed) {
      const coachEmail = (booking.coach as unknown as ProfileJoin)?.email;
      if (coachEmail) {
        await sendFundsReleasedEmail(coachEmail, booking.rate || 0);
      }
    } else if (recipientEmail) {
      // Only one side confirmed — notify the other
      await sendSessionConfirmedEmail(
        recipientEmail,
        confirmerName,
        isCoach ? "coach" : "player",
      );
    }
  } catch (e) {
    console.warn("Failed to send confirmation emails:", e);
  }

  return {
    success: true,
    bothConfirmed: coachConfirmed && playerConfirmed,
  };
}

/* ═══════════════════════════════════
   PLAYER RATING & REVIEW
   ═══════════════════════════════════ */

export async function submitRating(bookingId: string, rating: number, review: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (rating < 1 || rating > 5) return { error: "Rating must be 1-5." };

  // Fetch booking
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("*, coach:profiles!bookings_coach_id_fkey(email)")
    .eq("id", bookingId)
    .eq("player_id", user.id)
    .single();

  if (fetchErr || !booking) return { error: "Booking not found or you don't own it." };
  if (booking.status !== "completed") return { error: "Session must be completed before rating." };
  if (booking.player_rating) return { error: "You already rated this session." };

  // Save rating to booking
  const { error: updateErr } = await supabase
    .from("bookings")
    .update({ player_rating: rating, player_review: review || null })
    .eq("id", bookingId);

  if (updateErr) return { error: updateErr.message };

  // Update coach's aggregate rating
  const { data: allRatings } = await supabase
    .from("bookings")
    .select("player_rating")
    .eq("coach_id", booking.coach_id)
    .not("player_rating", "is", null);

  if (allRatings && allRatings.length > 0) {
    const avg = allRatings.reduce((sum: number, b: { player_rating: number | null }) => sum + (b.player_rating ?? 0), 0) / allRatings.length;
    await supabase
      .from("coach_profiles")
      .update({
        rating: Math.round(avg * 10) / 10,
        review_count: allRatings.length,
      })
      .eq("id", booking.coach_id);
  }

  // Email coach about the new review
  try {
    const coachEmail = (booking.coach as unknown as ProfileJoin)?.email;
    const playerName = user.user_metadata?.full_name || "A Player";
    if (coachEmail) {
      await sendRatingReceivedEmail(coachEmail, playerName, rating, review);
    }
  } catch (e) {
    console.warn("Failed to send rating email:", e);
  }

  return { success: true };
}

/* ═══════════════════════════════════
   EXISTING FUNCTIONS
   ═══════════════════════════════════ */

export async function getMyBookings() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: playerBookings } = await supabase
    .from("bookings")
    .select(
      `
      *,
      coach:profiles!bookings_coach_id_fkey (
        full_name
      )
    `,
    )
    .eq("player_id", user.id)
    .order("created_at", { ascending: false });

  return playerBookings || [];
}

export async function getCoachBookings() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: coachBookings } = await supabase
    .from("bookings")
    .select(
      `
      *,
      player:profiles!bookings_player_id_fkey (
        full_name
      )
    `,
    )
    .eq("coach_id", user.id)
    .neq("status", "pending")
    .order("created_at", { ascending: false });

  return coachBookings || [];
}

export async function updateBookingStatus(bookingId: string, status: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Verify the user is an admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Not authorized to update booking status." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

/* ═══════════════════════════════════
   ADMIN: GET ALL BOOKINGS
   ═══════════════════════════════════ */

export async function getAllBookingsAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      *,
      coach:profiles!bookings_coach_id_fkey ( full_name, email ),
      player:profiles!bookings_player_id_fkey ( full_name, email )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin bookings error:", error);
    return [];
  }

  return data || [];
}
