"use server";

import { createClient } from "@/app/lib/supabase/server";
import { getStripe } from "@/app/lib/stripe/server";

export async function getCoaches() {
  const stripe = getStripe();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_profiles")
    .select(`
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
    `)
    .eq("stripe_onboarding_complete", true)
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
      availability: (coach.availability as { day: string; start: string; end: string }[]) || [],
      avatar: (profile?.full_name as string)?.charAt(0)?.toUpperCase() || "C",
      gradient: getGradient(coach.id as string),
    };
  });
}

/** 
 * Retrieves the current user's profile and syncs Stripe status if needed. 
 */
export async function getMyCoachProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("coach_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Supabase error in getMyCoachProfile:", error);
    return null;
  }
  
  const currentData: any = data || { id: user.id, stripe_onboarding_complete: false };
  const stripe = getStripe();

  // If we have an account ID but it's not marked as complete, sync it once.
  if (currentData.stripe_account_id && !currentData.stripe_onboarding_complete && stripe) {
    try {
      const account = await stripe.accounts.retrieve(currentData.stripe_account_id);
      
      // payouts_enabled is the ultimate goal, charges_enabled is a good proxy.
      const isComplete = !!(account.details_submitted || account.payouts_enabled);

      if (isComplete) {
        const { error: updateErr } = await supabase
          .from("coach_profiles")
          .update({ stripe_onboarding_complete: true })
          .eq("id", user.id);
        
        if (updateErr) {
          console.error("DB Sync Update Failed:", updateErr);
          currentData.error = `DB Error: ${updateErr.message}`;
        } else {
          currentData.stripe_onboarding_complete = true;
        }
      } else {
        currentData.stripeDiagnostic = `Incomplete (${account.id})`;
      }
    } catch (err) {
      console.error("[Stripe Sync Alert] Couldn't fetch account status:", err);
      currentData.stripeDiagnostic = `API Sync Failure`;
    }
  } else if (!currentData.stripe_account_id) {
     currentData.stripeDiagnostic = "Missing Stripe ID";
  }

  return currentData;
}

export async function updateCoachProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("coach_profiles").upsert({
    id: user.id,
    style: formData.get("style"),
    specialty: formData.get("specialty"),
    rate: parseInt(formData.get("rate") as string) || 50,
    bio: formData.get("bio"),
    experience: formData.get("experience"),
    highlight_reel_url: formData.get("highlight_reel_url"),
    availability: JSON.parse((formData.get("availability") as string) || "[]"),
  });

  if (error) {
    console.error("Profile update failed:", error);
    return { error: error.message };
  }

  return { success: true };
}

export async function getAllCoachesAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return [];

  const { data, error } = await supabase
    .from("coach_profiles")
    .select("*, profiles!inner(full_name, avatar_url, email)")
    .order("rating", { ascending: false });

  if (error) return [];

  return (data || []).map((coach: Record<string, unknown>) => {
    const p = coach.profiles as Record<string, unknown> | null;
    return {
      id: coach.id,
      name: p?.full_name || "Coach",
      email: p?.email || "",
      style: coach.style,
      role: coach.specialty,
      rate: coach.rate,
      verified: coach.verified,
      banned: coach.banned,
      rating: Number(coach.rating) || 0,
      reviews: coach.review_count || 0,
      avatar: (p?.full_name as string)?.charAt(0)?.toUpperCase() || "C",
      gradient: getGradient(coach.id as string),
      stripeConnected: !!(coach.stripe_onboarding_complete),
    };
  });
}

export async function banCoach(coachId: string) {
  const supabase = await createClient();
  await supabase.from("coach_profiles").update({ banned: true }).eq("id", coachId);
  return { success: true };
}

export async function unbanCoach(coachId: string) {
  const supabase = await createClient();
  await supabase.from("coach_profiles").update({ banned: false }).eq("id", coachId);
  return { success: true };
}

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
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}
