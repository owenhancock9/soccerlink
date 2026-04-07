"use server";

import { createClient } from "@/app/lib/supabase/server";
import { getStripe } from "@/app/lib/stripe/server";

export async function getCoaches() {
  const stripe = getStripe();
  if (!stripe) return [];
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
      location,
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

  if (error) return [];

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
      location: (coach.location as string) || "",
      avatar: (profile?.full_name as string)?.charAt(0)?.toUpperCase() || "C",
      gradient: getGradient(coach.id as string),
    };
  });
}

/** 
 * Retrieves the current user's profile and MUST ALWAYS RETURN AN OBJECT 
 * if a user session exists, to prevent UI null-crashes.
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

  // If we get an error from DB (and it's not simply "no row found"), capture it.
  let dbErr = error && error.code !== "PGRST116" ? error.message : null;
  const currentData: any = data || { 
    id: user.id, 
    stripe_onboarding_complete: false,
    isFallback: true 
  };
  
  if (dbErr) currentData.dbError = dbErr;

  const stripe = getStripe();

  // SYNC LOGIC
  if (currentData.stripe_account_id && !currentData.stripe_onboarding_complete && stripe) {
    try {
      const account = await stripe.accounts.retrieve(currentData.stripe_account_id);
      const isComplete = !!(account.details_submitted || account.payouts_enabled);

      if (isComplete) {
        const { error: updateErr } = await supabase
          .from("coach_profiles")
          .update({ stripe_onboarding_complete: true })
          .eq("id", user.id);
        
        if (updateErr) {
          currentData.dbError = `Update failed: ${updateErr.message}`;
        } else {
          currentData.stripe_onboarding_complete = true;
        }
      } else {
        // Keep the account ID — Stripe may still be processing.
        // Just flag it as incomplete so the UI knows.
        currentData.stripeDiagnostic = `Stripe says incomplete (${account.id}) — try clicking Refresh in a minute`;
      }
    } catch (err: any) {
      currentData.stripeDiagnostic = `API Failure: ${err.message}`;
    }
  } else if (!currentData.stripe_account_id) {
     currentData.stripeDiagnostic = "ID Missing in DB";
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
    location: formData.get("location") || null,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function getAllCoachesAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return [];

  const { data, error } = await supabase.from("coach_profiles").select("*, profiles!inner(*)").order("rating", { ascending: false });
  if (error) return [];

  return (data || []).map((coach: any) => ({
    id: coach.id,
    name: coach.profiles?.full_name || "Coach",
    email: coach.profiles?.email || "",
    style: coach.style,
    role: coach.specialty,
    rate: coach.rate,
    verified: coach.verified,
    banned: coach.banned,
    rating: Number(coach.rating) || 0,
    reviews: coach.review_count || 0,
    avatar: "C",
    gradient: getGradient(coach.id),
    stripeConnected: !!(coach.stripe_onboarding_complete)
  }));
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
  const gradients = ["from-indigo-600 to-violet-700", "from-cyan-500 to-blue-600", "from-rose-500 to-pink-600", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-fuchsia-500 to-purple-600"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}
