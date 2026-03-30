"use server";

import { createClient } from "@/app/lib/supabase/server";

export async function getCoaches() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_profiles")
    .select(
      `
      id,
      style,
      specialty,
      rate,
      bio,
      experience,
      highlight_reel_url,
      availability,
      verified,
      rating,
      review_count,
      banned,
      profiles!inner (
        full_name,
        avatar_url
      )
    `,
    )
    .or("banned.is.null,banned.eq.false")
    .order("rating", { ascending: false });

  if (error) {
    console.error("Error fetching coaches:", error);
    return [];
  }

  return (data || []).map((coach: Record<string, unknown>) => {
    const profile = coach.profiles as Record<string, unknown> | null;
    return {
      id: coach.id as string,
      name: (profile?.full_name as string) || "Coach",
      style: (coach.style as string) || "General",
      role: (coach.specialty as string) || "All Positions",
      rate: (coach.rate as number) || 50,
      verified: (coach.verified as boolean) || false,
      rating: Number(coach.rating) || 0,
      reviews: (coach.review_count as number) || 0,
      bio: (coach.bio as string) || "No bio yet.",
      experience: (coach.experience as string) || "",
      highlightUrl: (coach.highlight_reel_url as string) || "",
      availability: (coach.availability as string[]) || [],
      avatar: (profile?.full_name as string)?.charAt(0)?.toUpperCase() || "C",
      gradient: getGradient(coach.id as string),
    };
  });
}

export async function getMyCoachProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("coach_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return null;
  return data;
}

export async function updateCoachProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const style = formData.get("style") as string;
  const specialty = formData.get("specialty") as string;
  const rate = parseInt(formData.get("rate") as string) || 50;
  const bio = formData.get("bio") as string;
  const experience = formData.get("experience") as string;
  const highlight_reel_url = formData.get("highlight_reel_url") as string;
  const availabilityText = formData.get("availability") as string;

  let availability = [];
  try {
    availability = JSON.parse(availabilityText || "[]");
  } catch (e) {}

  const { error } = await supabase.from("coach_profiles").upsert({
    id: user.id,
    style,
    specialty,
    rate,
    bio,
    experience,
    highlight_reel_url,
    availability,
  });

  if (error) {
    console.error("Error updating coach profile:", error);
    return { error: error.message };
  }

  return { success: true };
}

/* ── Admin: Get ALL coaches (including banned) ── */
export async function getAllCoachesAdmin() {
  const supabase = await createClient();

  // Verify calling user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return [];

  const { data, error } = await supabase
    .from("coach_profiles")
    .select(`
      id,
      style,
      specialty,
      rate,
      bio,
      verified,
      rating,
      review_count,
      banned,
      stripe_account_id,
      stripe_onboarding_complete,
      profiles!inner (
        full_name,
        avatar_url,
        email
      )
    `)
    .order("rating", { ascending: false });

  if (error) {
    console.error("Error fetching admin coaches:", error);
    return [];
  }

  return (data || []).map((coach: Record<string, unknown>) => {
    const profile = coach.profiles as Record<string, unknown> | null;
    return {
      id: coach.id as string,
      name: (profile?.full_name as string) || "Coach",
      email: (profile?.email as string) || "",
      style: (coach.style as string) || "General",
      role: (coach.specialty as string) || "All Positions",
      rate: (coach.rate as number) || 50,
      verified: (coach.verified as boolean) || false,
      banned: (coach.banned as boolean) || false,
      rating: Number(coach.rating) || 0,
      reviews: (coach.review_count as number) || 0,
      bio: (coach.bio as string) || "No bio yet.",
      avatar: (profile?.full_name as string)?.charAt(0)?.toUpperCase() || "C",
      gradient: getGradient(coach.id as string),
      stripeConnected: !!(coach.stripe_onboarding_complete),
    };
  });
}

/* ── Admin: Ban a Coach ── */
export async function banCoach(coachId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Unauthorized" };

  const { error } = await supabase
    .from("coach_profiles")
    .update({ banned: true })
    .eq("id", coachId);

  if (error) return { error: error.message };
  return { success: true };
}

/* ── Admin: Unban a Coach ── */
export async function unbanCoach(coachId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Unauthorized" };

  const { error } = await supabase
    .from("coach_profiles")
    .update({ banned: false })
    .eq("id", coachId);

  if (error) return { error: error.message };
  return { success: true };
}

// Generate consistent gradient based on ID
function getGradient(id: string): string {
  const gradients = [
    "from-indigo-600 to-violet-700",
    "from-cyan-500 to-blue-600",
    "from-rose-500 to-pink-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-fuchsia-500 to-purple-600",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}
