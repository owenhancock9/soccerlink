"use server";

import { createClient } from "@/app/lib/supabase/server";

import { stripe } from "@/app/lib/stripe/server";

export async function createBooking(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Coaching Session",
              description: `Session on ${sessionDate} at ${sessionTime}`,
            },
            unit_amount: Math.round(total * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      client_reference_id: data.id,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}?canceled=true`,
    });

    return { success: true, booking: data, url: session.url };
  } catch (err: any) {
    console.error("Stripe Checkout Error:", err);
    return { error: "Failed to create payment session." };
  }
}

export async function getMyBookings() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  // Get bookings where user is the player
  const { data: playerBookings } = await supabase
    .from("bookings")
    .select(`
      *,
      coach:profiles!bookings_coach_id_fkey (
        full_name
      )
    `)
    .eq("player_id", user.id)
    .order("created_at", { ascending: false });

  return playerBookings || [];
}

export async function getCoachBookings() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  // Get bookings where user is the coach
  const { data: coachBookings } = await supabase
    .from("bookings")
    .select(`
      *,
      player:profiles!bookings_player_id_fkey (
        full_name
      )
    `)
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });

  return coachBookings || [];
}

export async function updateBookingStatus(bookingId: string, status: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
