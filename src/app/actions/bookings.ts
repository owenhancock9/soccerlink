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
  const rate = parseInt(formData.get("rate") as string);

  if (!coachId || !sessionDate || !sessionTime || !rate) {
    return { error: "Missing booking details." };
  }

  // Calculate fees
  const platformFee = rate * 0.13;
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
      platformFee,
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
    });

    return { success: true, booking: data, url: session.url };
  } catch (err: unknown) {
    console.error("Stripe Checkout Error:", err);
    return { error: "Failed to create payment session." };
  }
}

/* ═══════════════════════════════════
   TWO-WAY SESSION CONFIRMATION
   ═══════════════════════════════════ */

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

  // Email the other party
  try {
    const confirmerName = isCoach
      ? (booking.coach as any)?.full_name || "Your Coach"
      : (booking.player as any)?.full_name || "Your Player";
    const recipientEmail = isCoach
      ? (booking.player as any)?.email
      : (booking.coach as any)?.email;

    if (recipientEmail) {
      if (coachConfirmed && playerConfirmed) {
        // Both confirmed — release funds
        const payoutResult = await releaseFundsToCoach(bookingId);
        if (payoutResult.error) {
          console.error("Auto-payout failed:", payoutResult.error);
        }
        // Email coach about payout
        const coachEmail = (booking.coach as any)?.email;
        if (coachEmail) {
          await sendFundsReleasedEmail(coachEmail, booking.rate || 0);
        }
      } else {
        // Only one side confirmed — notify the other
        await sendSessionConfirmedEmail(
          recipientEmail,
          confirmerName,
          isCoach ? "coach" : "player",
        );
      }
    }
  } catch (e) {
    console.warn("Failed to send confirmation email:", e);
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
    const avg = allRatings.reduce((sum: number, b: any) => sum + b.player_rating, 0) / allRatings.length;
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
    const coachEmail = (booking.coach as any)?.email;
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
