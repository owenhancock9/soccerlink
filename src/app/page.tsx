"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import { getCoaches, getMyCoachProfile, getAllCoachesAdmin, banCoach, unbanCoach } from "@/app/actions/coaches";
import { createBooking, getCoachBookings, getMyBookings, confirmSession, submitRating, getAllBookingsAdmin } from "@/app/actions/bookings";
import { createStripeConnectAccount } from "@/app/actions/stripe";
import { uploadVodForBooking } from "@/app/actions/upload";
import { releaseFundsToCoach } from "@/app/actions/payouts";

/* ─── Constants ─── */

/* ─── Constants ─── */
const PLATFORM_CUT = 0.13;

/* ─── Admin Coach type ─── */
interface AdminCoach {
  id: string;
  name: string;
  email: string;
  style: string;
  role: string;
  rate: number;
  verified: boolean;
  banned: boolean;
  rating: number;
  reviews: number;
  bio: string;
  avatar: string;
  gradient: string;
  stripeConnected: boolean;
}

/* ─── Booking type ─── */
interface Booking {
  id: string;
  status: string;
  amount: number;
  total: number;
  rate: number;
  session_date: string;
  session_time: string;
  location?: string;
  coach_id?: string;
  coach?: { full_name: string };
  player_name?: string;
  player_email?: string;
  vod_url?: string;
  payout_id?: string;
  coach_confirmed_at?: string;
  player_confirmed_at?: string;
  player_rating?: number;
  player_review?: string;
  [key: string]: unknown;
}

/* ─── Scheduling Helpers ─── */
interface AvailabilitySlot {
  day: string;
  start: string;
  end: string;
}

function getAvailableSlots(availability: AvailabilitySlot[], date: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = days[date.getDay()];
  const daySlots = availability.filter((s) => s.day === dayName);

  if (!daySlots || daySlots.length === 0) return [];

  const intervals: string[] = [];
  daySlots.forEach((slot) => {
    try {
      // Create date objects for comparison (dummy date)
      const [startH, startM] = slot.start.split(':').map(Number);
      const [endH, endM] = slot.end.split(':').map(Number);

      const current = new Date(2024, 0, 1, startH, startM);
      const end = new Date(2024, 0, 1, endH, endM);

      while (current < end) {
        intervals.push(current.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }));
        current.setHours(current.getHours() + 1);
      }
    } catch (e) {
      console.error("Error parsing slot:", e);
    }
  });
  return intervals;
}

/* ─── Star Renderer ─── */
function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <span className="inline-flex gap-px text-amber-400 text-xs">
      {Array.from({ length: full }).map((_, i) => (
        <span key={i}>★</span>
      ))}
      {hasHalf && <span className="opacity-50">★</span>}
    </span>
  );
}

/* ─── Animated Stat Bar ─── */


/* ─── Coach Card ─── */
interface Coach {
  id: number | string;
  name: string;
  style: string;
  role: string;
  rate: number;
  verified: boolean;
  rating: number;
  reviews: number;
  bio: string;
  avatar: string;
  avatarUrl?: string;
  gradient: string;
  experience?: string;
  highlightUrl?: string;
  availability: AvailabilitySlot[];
  location?: string;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function CoachCard({
  coach,
  index,
  onBook,
}: {
  coach: Coach;
  index: number;
  onBook: (c: Coach) => void;
}) {
  return (
    <div
      className="glass-card p-6 flex flex-col justify-between group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div>
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${coach.gradient} flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden`}
            >
              {coach.avatarUrl ? (
                <img src={coach.avatarUrl} alt={coach.name} className="w-full h-full object-cover" />
              ) : (
                coach.avatar
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-lg font-bold text-white leading-tight">
                  {titleCase(coach.name)}
                </h3>
                {coach.verified && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-500/20 font-semibold uppercase tracking-wider">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                    Verified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Stars rating={coach.rating} />
                  <span className="text-zinc-300 font-semibold font-mono text-xs">
                    {coach.rating}
                  </span>
                </div>
                <span className="text-zinc-600">·</span>
                <span className="text-xs text-zinc-500">
                  {coach.reviews} reviews
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xl font-bold text-white font-mono">
              ${coach.rate}
            </span>
            <span className="text-[10px] text-zinc-500 mt-0.5">per session</span>
          </div>
        </div>

        {/* Location */}
        {coach.location && (
          <div className="flex items-center gap-1.5 mb-3 text-zinc-400">
            <span className="text-xs">📍</span>
            <span className="text-xs">{coach.location}</span>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-5">
          <span className="text-xs text-zinc-300 px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700">
            {coach.role}
          </span>
          <span className="text-xs text-indigo-400 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20">
            {coach.style}
          </span>
        </div>

        {/* Bio */}
        <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3 mb-5">
          {coach.bio || "Experienced coach available for sessions and video analysis."}
        </p>

        {/* Availability */}
        {coach.availability && coach.availability.length > 0 && (
          <div className="mb-5 bg-zinc-900 rounded-lg p-3 border border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Availability</span>
              <span className="text-[10px] text-emerald-500 font-medium">Available</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {coach.availability.map((slot: AvailabilitySlot, i: number) => (
                <div
                  key={i}
                  className="flex flex-col items-center bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 min-w-[70px]"
                >
                  <span className="text-[10px] text-zinc-500 font-medium mb-0.5">{slot.day?.substring(0, 3)}</span>
                  <span className="text-[11px] text-zinc-300 font-mono font-medium">{slot.start}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video */}
        {coach.highlightUrl && (
          <a
            href={coach.highlightUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs text-zinc-400 hover:text-indigo-400 transition-colors mb-5"
          >
            ▶ Watch highlight reel
          </a>
        )}
      </div>

      {/* Book Button */}
      <button
        id={`book-coach-${coach.id}`}
        onClick={() => onBook(coach)}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-sm transition-colors active:scale-[0.98]"
      >
        Book Session
      </button>
    </div>
  );
}

/* ═══════════════════════════════════
   MAIN APP
   ═══════════════════════════════════ */
export default function SoccerPlatform() {
  /* ── Auth State ── */
  const [currentUser, setCurrentUser] = useState<{
    role: string;
    name: string;
    isAuthenticated: boolean;
  }>({
    role: "player",
    name: "",
    isAuthenticated: false,
  });
  const [, setAuthLoading] = useState(true);

  const [view, setView] = useState("discovery");
  const [search, setSearch] = useState("");
  const [viewKey, setViewKey] = useState(0);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All Roles");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  /* ── Real Coaches from DB ── */
  const [dbCoaches, setDbCoaches] = useState<Coach[]>([]);
  const [coachesLoaded, setCoachesLoaded] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [realBookings, setRealBookings] = useState<Booking[]>(
    [],
  );

  /* ── Coach Context ── */
  const [stripeOnboarded, setStripeOnboarded] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const [isSyncingStripe, setIsSyncingStripe] = useState(false);
  const [isInitiatingStripe, setIsInitiatingStripe] = useState(false);

  async function refreshStripeStatus() {
    setIsSyncingStripe(true);
    const profile = await getMyCoachProfile();
    setProfile(profile);
    if (profile) {
      const p = profile as Record<string, unknown>;
      setStripeOnboarded(!!p.stripe_onboarding_complete);
      if (p.stripe_onboarding_complete) {
        setBookingMessage({ type: "success", text: "Stripe Connection Verified! You are now live." });
      } else if (p.error) {
        setBookingMessage({ type: "error", text: `Database Issue: ${p.error}` });
      } else if (p.stripeDiagnostic) {
        setBookingMessage({ type: "error", text: `Stripe Alert: ${p.stripeDiagnostic}. Ensure you finished the bank/identity steps.` });
      } else {
        setBookingMessage({ type: "error", text: "Stripe reports onboarding is still incomplete. Please finish all steps in the Stripe dashboard." });
      }
    }
    setIsSyncingStripe(false);
  }

  /* ── Detect Stripe Setup Success ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") === "success" && currentUser.role === "coach") {
      getMyCoachProfile().then((profileResult) => {
        setProfile(profileResult);
        const p = profileResult as Record<string, unknown>;
        if (p?.stripe_onboarding_complete) {
          setStripeOnboarded(true);
        }
      });
      // Clear URL param
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [currentUser.role]);

  /* ── File Upload State ── */
  const [uploadingVod, setUploadingVod] = useState<string | null>(null);
  const [releasingFunds, setReleasingFunds] = useState<string | null>(null);

  /* ── Session Confirmation & Rating State ── */
  const [confirmingSession, setConfirmingSession] = useState<string | null>(null);
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  /* ── Admin State ── */
  const [adminCoaches, setAdminCoaches] = useState<AdminCoach[]>([]);
  const [adminBookings, setAdminBookings] = useState<Record<string, unknown>[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [banningCoach, setBanningCoach] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<"overview" | "coaches" | "bookings">("overview");

  /* ── Fetch Coaches from DB ── */
  useEffect(() => {
    async function loadCoaches() {
      const coaches = await getCoaches();
      setDbCoaches(coaches as unknown as Coach[]);
      setCoachesLoaded(true);
    }
    loadCoaches();
  }, []);

  /* ── Fetch Admin Data ── */
  useEffect(() => {
    if (currentUser.role === "admin" && currentUser.isAuthenticated) {
      setAdminLoading(true);
      Promise.all([getAllCoachesAdmin(), getAllBookingsAdmin()]).then(([coaches, bookings]) => {
        setAdminCoaches(coaches as unknown as AdminCoach[]);
        setAdminBookings(bookings as Record<string, unknown>[]);
        setAdminLoading(false);
      });
    }
  }, [currentUser.role, currentUser.isAuthenticated]);

  /* ── Fetch Coach Bookings & Details (for coach dashboard) ── */
  useEffect(() => {
    if (currentUser.role === "coach" && currentUser.isAuthenticated) {
      getCoachBookings().then((bookings) => {
        setRealBookings(bookings as unknown as Booking[]);
      });
      getMyCoachProfile().then((profileResult) => {
        setProfile(profileResult);
        const p = profileResult as Record<string, unknown>;
        setStripeOnboarded(!!p?.stripe_onboarding_complete);
      });
    } else if (currentUser.role === "player" && currentUser.isAuthenticated) {
      getMyBookings().then((bookings) => {
        setRealBookings(bookings as unknown as Booking[]);
      });
    }
  }, [currentUser.role, currentUser.isAuthenticated]);

  /* ── Fetch Auth User ── */
  useEffect(() => {
    const supabase = createClient();

    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Try to get profile from DB
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();

        const role = profile?.role || user.user_metadata?.role || "player";
        const name =
          profile?.full_name || user.user_metadata?.full_name || "User";

        setCurrentUser({
          role,
          name,
          isAuthenticated: true,
        });

        // Set initial view based on role
        if (role === "coach") setView("dashboard");
        else if (role === "admin") setView("admin");
        else setView("discovery");
      } else {
        setCurrentUser({ role: "player", name: "", isAuthenticated: false });
      }
      setAuthLoading(false);
    }

    getUser();

    // Listen for auth changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  /* ── Derived ── */
  const allCoaches = dbCoaches;
  const filteredCoaches = allCoaches.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.style.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q);
    const matchesRole = activeFilter === "All Roles" || c.role === activeFilter;
    return matchesSearch && matchesRole;
  });

  /* ── Handlers ── */
  const switchView = useCallback((v: string) => {
    setView(v);
    setViewKey((k) => k + 1);
    setIsMobileMenuOpen(false);
  }, []);

  const handleBookingClick = useCallback((coach: Coach) => {
    if (!currentUser.isAuthenticated) {
      window.location.href = "/signup";
      return;
    }
    setSelectedCoach(coach);
    setSelectedDate(null);
    setSelectedTime(null);
    setActiveModal("schedule");
  }, [currentUser.isAuthenticated]);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!isFilterOpen) return;
    const handler = () => setIsFilterOpen(false);
    const timer = setTimeout(
      () => document.addEventListener("click", handler),
      0,
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler);
    };
  }, [isFilterOpen]);

  /* ── File Upload Handlers ── */
  const handleVodUpload = async (e: React.ChangeEvent<HTMLInputElement>, bookingId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingVod(bookingId);
    setBookingMessage({ type: "success", text: "Starting upload..." });

    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadVodForBooking(bookingId, formData);

    if (result.error) {
      setBookingMessage({ type: "error", text: result.error });
    } else {
      setBookingMessage({ type: "success", text: "VOD uploaded successfully!" });
      // Refresh realBookings
      const updated = await getMyBookings();
      setRealBookings(updated);
    }
    setUploadingVod(null);
  };

  const handleReleaseFunds = async (bookingId: string) => {
    setReleasingFunds(bookingId);
    setBookingMessage({ type: "success", text: "Releasing funds to coach..." });

    const result = await releaseFundsToCoach(bookingId);

    if (result.error) {
      setBookingMessage({ type: "error", text: result.error });
    } else {
      setBookingMessage({ type: "success", text: "Funds released! Session completed." });
      // Refresh realBookings
      const updated = await getMyBookings();
      setRealBookings(updated);
    }
    setReleasingFunds(null);
  };

  /* ── Session Confirmation Handler ── */
  const handleConfirmSession = async (bookingId: string) => {
    setConfirmingSession(bookingId);
    setBookingMessage({ type: "success", text: "Confirming session..." });

    const result = await confirmSession(bookingId);

    if (result.error) {
      setBookingMessage({ type: "error", text: result.error });
    } else if (result.bothConfirmed) {
      setBookingMessage({ type: "success", text: "Both parties confirmed! Funds are being released to the coach. 🎉" });
    } else {
      setBookingMessage({ type: "success", text: "Session confirmed! Waiting for the other party to confirm." });
    }

    // Refresh bookings
    if (currentUser.role === "coach") {
      const updated = await getCoachBookings();
      setRealBookings(updated as unknown as Booking[]);
    } else {
      const updated = await getMyBookings();
      setRealBookings(updated as unknown as Booking[]);
    }
    setConfirmingSession(null);
  };

  /* ── Rating Submission Handler ── */
  const handleSubmitRating = async (bookingId: string) => {
    if (ratingValue === 0) {
      setBookingMessage({ type: "error", text: "Please select a star rating." });
      return;
    }
    setSubmittingRating(true);

    const result = await submitRating(bookingId, ratingValue, reviewText);

    if (result.error) {
      setBookingMessage({ type: "error", text: result.error });
    } else {
      setBookingMessage({ type: "success", text: "Thank you for your review! ⭐" });
      setRatingBookingId(null);
      setRatingValue(0);
      setReviewText("");
    }

    const updated = await getMyBookings();
    setRealBookings(updated as unknown as Booking[]);
    setSubmittingRating(false);
  };

  /* ═══════════════════
     RENDER
     ═══════════════════ */
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-zinc-100 relative">

      {/* ═══════════════
          MODALS
          ═══════════════ */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-xl max-w-5xl w-full  relative anim-scale-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              id="modal-close"
              onClick={closeModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors z-20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Schedule Modal */}
            {activeModal === "schedule" && selectedCoach && (
              <div className="anim-fade-in flex flex-col md:flex-row gap-8 relative z-10">
                {/* Left Side: Coach Info */}
                <div className="flex-1">
                  <div className="flex gap-4 mb-6">
                    <div className="shrink-0">
                      <div
                        className={`w-16 h-16 rounded-xl bg-gradient-to-br ${selectedCoach.gradient} flex items-center justify-center text-white font-bold text-2xl`}
                      >
                        {selectedCoach.avatar}
                      </div>
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-bold text-white">
                          {selectedCoach.name}
                        </h2>
                        {selectedCoach.verified && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-500/20 font-semibold">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                            Verified
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-zinc-400 mb-2">
                        {selectedCoach.experience || "Experienced Coach"}
                      </p>

                      <div className="flex items-center gap-2 text-sm">
                        <Stars rating={selectedCoach.rating} />
                        <span className="font-semibold text-white">
                          {selectedCoach.rating}
                        </span>
                        <span className="text-zinc-500 text-xs">({selectedCoach.reviews} reviews)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-5">
                    <span className="text-xs text-zinc-300 px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700">
                      {selectedCoach.role}
                    </span>
                    <span className="text-xs text-indigo-400 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20">
                      {selectedCoach.style}
                    </span>
                  </div>

                  <p className="text-zinc-300 text-sm leading-relaxed mb-6 bg-zinc-800/50 p-4 rounded-lg border border-zinc-800 whitespace-pre-wrap">
                    {selectedCoach.bio}
                  </p>

                  <div className="space-y-4">
                    {selectedCoach.availability && selectedCoach.availability.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">
                          Weekly Availability
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCoach.availability.map((slot: AvailabilitySlot, i: number) => (
                            <span
                              key={i}
                              className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 font-mono flex items-center gap-1.5"
                            >
                              <span className="text-zinc-500">{slot.day}</span>
                              {slot.start} - {slot.end}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedCoach.highlightUrl && (
                      <a
                        href={selectedCoach.highlightUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 py-3 rounded-lg text-sm font-medium transition-colors"
                      >
                        ▶ Watch Highlight Reel
                      </a>
                    )}
                  </div>
                </div>

                <div className="md:w-[20rem] shrink-0">
                  <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-6 h-full">
                    <h3 className="text-white font-bold text-lg mb-6">
                      Book Session
                    </h3>

                    <div className="space-y-6">
                      {/* Step 1: Date Picker */}
                      <div>
                        <label className="text-xs text-zinc-500 uppercase tracking-wider font-medium block mb-3">
                          1. Pick a Date
                        </label>
                        <div className="grid grid-cols-7 gap-1 text-center bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                            <div key={`day-${i}`} className="text-[10px] text-zinc-600 font-medium py-1.5">
                              {d}
                            </div>
                          ))}
                          {(() => {
                            const days: { date: Date; label: string }[] = [];
                            const today = new Date();
                            for (let i = 1; i <= 14; i++) {
                              const d = new Date(today);
                              d.setDate(today.getDate() + i);
                              days.push({ date: d, label: String(d.getDate()) });
                            }
                            return days.map((d, i) => {
                              const isSel = selectedDate === d.date.getDate() && selectedMonth === d.date.getMonth();
                              return (
                                <button
                                  key={i}
                                  onClick={() => { setSelectedDate(d.date.getDate()); setSelectedMonth(d.date.getMonth()); setSelectedYear(d.date.getFullYear()); }}
                                  className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                                    isSel
                                      ? "bg-indigo-600 text-white"
                                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      <div className={selectedDate ? "anim-fade-in" : "opacity-30 pointer-events-none transition-opacity"}>
                        <label className="text-xs text-zinc-500 uppercase tracking-wider font-medium block mb-3">
                          2. Select Time
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {getAvailableSlots(selectedCoach.availability || [], new Date(selectedYear || 2025, selectedMonth ?? 0, selectedDate || 1)).length > 0 ? (
                            getAvailableSlots(selectedCoach.availability || [], new Date(selectedYear || 2025, selectedMonth ?? 0, selectedDate || 1)).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setSelectedTime(t)}
                                className={`py-3 rounded-lg text-xs font-medium transition-colors border ${selectedTime === t
                                    ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400"
                                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                                  }`}
                              >
                                {t}
                              </button>
                            ))
                          ) : (
                            <div className="col-span-2 py-6 bg-zinc-900 rounded-lg border border-zinc-800 border-dashed text-center">
                              <p className="text-xs text-zinc-600">No availability on this day</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedDate && selectedTime ? (
                        <div className="anim-fade-in pt-6 border-t border-zinc-800">
                          <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                              <span className="text-zinc-500">Coaching Session</span>
                              <span className="text-white font-medium">${selectedCoach.rate}.00</span>
                            </div>
                             <div className="flex justify-between text-sm">
                              <span className="text-zinc-500">Service Fee</span>
                              <span className="text-white font-medium">${Math.round(selectedCoach.rate * PLATFORM_CUT)}.00</span>
                            </div>
                            <div className="flex justify-between items-end pt-3 border-t border-zinc-800">
                              <span className="text-zinc-400 font-medium text-sm">Total</span>
                              <span className="text-white text-xl font-bold">${selectedCoach.rate + Math.round(selectedCoach.rate * PLATFORM_CUT)}.00</span>
                            </div>
                          </div>

                          <button
                            id="confirm-pay-btn"
                            disabled={bookingLoading || isInitiatingStripe}
                            onClick={async () => {
                              if (!currentUser.isAuthenticated) {
                                setBookingMessage({ type: "error", text: "Please sign in to proceed." });
                                return;
                              }
                              setBookingLoading(true);
                              setIsInitiatingStripe(true);
                              setBookingMessage(null);

                              const formData = new FormData();
                              formData.set("coachId", String(selectedCoach.id));
                              formData.set("sessionDate", `${selectedYear}-${String((selectedMonth ?? 0) + 1).padStart(2, "0")}-${String(selectedDate).padStart(2, "0")}`);
                              formData.set("sessionTime", selectedTime || "10:00 AM");
                              formData.set("rate", String(selectedCoach.rate));

                              const result = await createBooking(formData);
                              if (result.error) {
                                setBookingMessage({ type: "error", text: result.error });
                                setBookingLoading(false);
                                setIsInitiatingStripe(false);
                              } else if (result.url) {
                                window.location.href = result.url;
                              }
                            }}
                            className="gradient-btn w-full py-3.5 text-sm disabled:opacity-50"
                          >
                            {bookingLoading ? "Connecting..." : "Book Now"}
                          </button>

                          <div className="mt-5 flex flex-col items-center gap-2">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-4 opacity-30 brightness-200" />
                            <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                              Payment secured. Released when both parties confirm.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-12 text-center opacity-20">
                          <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <p className="text-xs">Select a date and time</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TOS Modal */}
            {activeModal === "tos" && (
              <div className="anim-fade-in relative z-10 py-4 max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-zinc-800 text-zinc-400 rounded-lg flex items-center justify-center text-lg border border-zinc-700">📜</div>
                  <h3 className="text-xl font-bold text-white">
                    Terms of Service
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="p-5 bg-zinc-800/50 rounded-lg border border-zinc-800">
                    <strong className="text-white text-sm block mb-2">1. Two-Way Confirmation System</strong>
                    <p className="text-zinc-400 text-sm leading-relaxed">To ensure security for both sides, session funds are held in CoachingMatch&apos;s secure vault. After your session is completed, both the coach and the player must click &quot;Confirm Session Complete&quot; for funds to be released. If either party does not confirm, the funds remain held and our support team will assist.</p>
                  </div>
                  <div className="p-5 bg-zinc-800/50 rounded-lg border border-red-900/30">
                    <strong className="text-red-400 text-sm block mb-2">2. Off-Platform Protection</strong>
                    <p className="text-zinc-400 text-sm leading-relaxed">Attempting to book coaching sessions outside of CoachingMatch is strictly prohibited. This is for your own safety; sessions outside our portal are not protected by our escrow guarantee and will result in immediate permanent account suspension.</p>
                  </div>
                  <div className="p-5 bg-zinc-800/50 rounded-lg border border-zinc-800">
                    <strong className="text-amber-400 text-sm block mb-2">3. Reviews &amp; Ratings</strong>
                    <p className="text-zinc-400 text-sm leading-relaxed">After a session is completed, players are encouraged to leave a star rating and review. This helps future players make informed decisions and helps coaches build their reputation on the platform.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════
          NAVIGATION
          ═══════════════ */}
      <nav className="max-w-6xl mx-auto flex justify-between items-center nav-glass p-4 md:px-7 md:py-4 md:rounded-full sticky top-0 md:top-6 z-50 transition-all duration-300">
        <h1
          className="text-lg font-bold text-white cursor-pointer"
          onClick={() =>
            switchView(
              currentUser.role === "coach"
                ? "dashboard"
                : currentUser.role === "admin"
                  ? "admin"
                  : "discovery",
            )
          }
        >
          CoachingMatch
        </h1>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-5">
          <div className="flex gap-1">
            {currentUser.role === "player" && (
              <>
                <NavBtn
                  active={view === "discovery"}
                  onClick={() => switchView("discovery")}
                >
                  Find Coach
                </NavBtn>
                <NavBtn
                  active={view === "session"}
                  onClick={() => switchView("session")}
                >
                  My Sessions
                </NavBtn>
              </>
            )}
            {currentUser.role === "coach" && (
                <NavBtn
                active={view === "dashboard"}
                onClick={() => switchView("dashboard")}
              >
                <div className="flex items-center gap-2">
                  <span>Coach Hub</span>
                  {stripeOnboarded === false && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </div>
              </NavBtn>
            )}
            {currentUser.role === "admin" && (
              <NavBtn
                active={view === "admin"}
                onClick={() => switchView("admin")}
              >
                Admin
              </NavBtn>
            )}
          </div>

          <div className="h-5 w-px bg-zinc-700/50" />

          {currentUser.isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center text-white font-medium text-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-zinc-400">
                  {currentUser.name}
                </span>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-indigo-600 hover:bg-indigo-500 text-xs font-medium px-4 py-2 rounded-lg text-white transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          id="mobile-menu-toggle"
          className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <span
            className="text-lg transition-transform duration-300"
            style={{
              transform: isMobileMenuOpen ? "rotate(90deg)" : "none",
            }}
          >
            {isMobileMenuOpen ? "✕" : "☰"}
          </span>
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[68px] bg-zinc-950/98 backdrop-blur-sm z-30 p-6 anim-fade-in-down">
          <div className="flex flex-col gap-5 text-lg font-bold">
            {currentUser.role === "player" && (
              <>
                <button
                  onClick={() => switchView("discovery")}
                  className="text-left text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Find Coach
                </button>
                <button
                  onClick={() => switchView("session")}
                  className="text-left text-zinc-300 hover:text-white transition-colors"
                >
                  My Sessions
                </button>
              </>
            )}
            {currentUser.role === "coach" && (
              <button
                onClick={() => switchView("dashboard")}
                className="text-left text-indigo-400 flex items-center justify-between gap-3 w-full"
              >
                <span>COACH HUB</span>
                {stripeOnboarded === false && (
                  <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-semibold ">ACTION REQUIRED</span>
                )}
              </button>
            )}
            {currentUser.role === "admin" && (
              <button
                onClick={() => switchView("admin")}
                className="text-left text-red-400"
              >
                Admin
              </button>
            )}

            <hr className="border-zinc-800/50 my-2" />
            {currentUser.isAuthenticated ? (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-white font-medium text-sm"
                  >
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                      {currentUser.role}
                    </p>
                  </div>
                </div>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="text-left text-sm text-zinc-400 hover:text-red-400 transition-colors"
                  >
                    Sign Out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-left text-indigo-400 hover:text-indigo-300 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="text-left text-zinc-300 hover:text-white transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════
          MAIN CONTENT
          ═══════════════ */}
      <main
        key={viewKey}
        className="max-w-6xl mx-auto min-h-[60vh] px-4 md:px-6 mt-8 relative z-10"
      >
        {/* Global Alert System */}
        {bookingMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xl px-4 anim-fade-in">
            <div className={`bg-zinc-900 border rounded-xl p-4 flex items-center justify-between gap-4  ${bookingMessage.type === "error"
                ? "border-red-500/40 text-red-400"
                : "border-emerald-500/40 text-emerald-400"
              }`}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{bookingMessage.type === "error" ? "🚨" : "✅"}</span>
                <p className="text-sm font-medium">{bookingMessage.text}</p>
              </div>
              <button
                onClick={() => setBookingMessage(null)}
                className="w-7 h-7 rounded-md hover:bg-zinc-800 flex items-center justify-center transition-colors text-zinc-400"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ── VIEW 1: DISCOVERY ── */}
        {view === "discovery" && currentUser.role === "player" && (
          <section className="anim-fade-in-up pb-32">
            {/* Hero Section */}
            <div className="pt-16 md:pt-24 pb-16">
              <div className="flex flex-col items-center text-center max-w-3xl mx-auto px-4">
                <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white leading-tight">
                  Level Up <br /> <span className="text-indigo-400">Your Game.</span>
                </h1>

                <p className="text-zinc-400 text-base md:text-lg max-w-xl leading-relaxed mb-12">
                  Connect with experienced coaches for personalized training sessions, film analysis, and skill development.
                </p>

                <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl p-3 relative overflow-visible">
                  <div className="flex flex-col md:flex-row gap-3 items-center">
                    <div className="relative w-full">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      </div>
                      <input
                        id="coach-search"
                        className="w-full bg-zinc-800 border border-zinc-700 focus:border-indigo-500/50 rounded-lg py-3 pl-11 pr-4 outline-none text-white text-sm transition-colors placeholder:text-zinc-600"
                        placeholder="Search by position, style, or coach name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>

                    <div className="shrink-0 flex items-center gap-2 w-full md:w-auto">
                      <button
                        id="filter-toggle"
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`flex items-center justify-between md:justify-start gap-2 w-full md:w-auto px-4 py-3 rounded-lg text-xs font-medium border transition-colors ${isFilterOpen || activeFilter !== "All Roles"
                            ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                          {activeFilter === "All Roles" ? "Filter" : activeFilter}
                        </div>
                        <span className={`text-[8px] transition-transform ${isFilterOpen ? 'rotate-180' : ''}`}>▼</span>
                      </button>
                    </div>
                  </div>

                  {isFilterOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4  z-50 anim-scale-in grid grid-cols-2 md:grid-cols-5 gap-2">
                      {["All Roles", "Forward", "Midfielder", "Defender", "Goalkeeper"].map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setActiveFilter(f);
                            setIsFilterOpen(false);
                          }}
                          className={`py-2.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === f
                              ? "bg-indigo-600 text-white"
                              : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
                            }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coach Grid */}
            <div className="grid md:grid-cols-2 gap-6 stagger-children">
              {filteredCoaches.map((coach, i) => (
                <CoachCard
                  key={coach.id}
                  coach={coach}
                  index={i}
                  onBook={handleBookingClick}
                />
              ))}
            </div>

            {filteredCoaches.length === 0 && allCoaches.length === 0 && coachesLoaded && (
              <div className="text-center py-32 anim-fade-in glass-card border-dashed">
                <p className="text-6xl mb-8">🏟️</p>
                <h3 className="text-2xl font-semibold text-white mb-4 ">No Coaches Available Yet</h3>
                <p className="text-zinc-400 max-w-sm mx-auto leading-relaxed font-bold uppercase text-[10px] tracking-wider">
                  Be the first coach on the platform.
                </p>
                {!currentUser.isAuthenticated && (
                  <Link
                    href="/signup"
                    className="inline-block mt-10 gradient-btn px-8 py-4 text-xs"
                  >
                    Register as Coach →
                  </Link>
                )}
              </div>
            )}

            {filteredCoaches.length === 0 && allCoaches.length > 0 && (
              <div className="text-center py-32 anim-fade-in glass-card">
                <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-4">
                  0 RESULTS FOUND FOR QUERY
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setActiveFilter("All Roles");
                  }}
                  className="text-indigo-400 text-[12px] font-bold uppercase tracking-wider hover:underline decoration-2"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* Tactical Lifecycle Section */}
            <div className="mt-24 mb-16">
              <div className="text-center mb-12">
                <span className="text-xs font-medium text-indigo-400 mb-3 inline-block">How It Works</span>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Simple & Secure.</h2>
                <p className="text-zinc-500 text-sm max-w-md mx-auto">Book a session, train together, and both confirm when you&apos;re done.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                <div className="glass-card p-6">
                  <div className="text-2xl mb-4">🎯</div>
                  <h4 className="text-base font-semibold text-white mb-2">Find a Coach</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">Browse verified coaches by position, style, and availability. Pick one that fits your goals and book a time that works for you.</p>
                </div>

                <div className="glass-card p-6">
                  <div className="text-2xl mb-4">🔐</div>
                  <h4 className="text-base font-semibold text-white mb-2">Secure Payment</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">Your payment is held securely until the session is complete. Both you and the coach confirm it happened, then the coach gets paid.</p>
                </div>

                <div className="glass-card p-6">
                  <div className="text-2xl mb-4">📊</div>
                  <h4 className="text-base font-semibold text-white mb-2">Get Better</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">Train with your coach, get personalized feedback, and watch your game improve. Leave a review to help other players find great coaches.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── VIEW 2: VOD PORTAL ── */}
        {view === "session" && currentUser.role === "player" && (
          <div className="space-y-6 anim-fade-in-up">
            <h2 className="text-xl font-bold mb-6">
              My Sessions
            </h2>

            {/* bookingMessage was here, now moved to global top */}

            {realBookings.map((b: Booking) => (
              <div key={b.id} className="glass-card p-6 md:p-8 relative hover:transform-none">
                <div className="flex flex-col gap-6">

                  {/* Top: Info Row */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2">
                        Session with Coach {b.coach?.full_name || "Unknown"}
                      </h3>
                      <p className="text-zinc-400 text-sm mb-3">
                        {new Date(b.session_date).toLocaleDateString()} at {b.session_time}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                          b.status === "pending" ? "bg-amber-950/30 text-amber-500 border-amber-900/50" :
                          b.status === "confirmed" ? "bg-indigo-950/30 text-indigo-400 border-indigo-900/50" :
                          b.status === "completed" ? "bg-pink-950/30 text-indigo-400 border-pink-900/50" :
                          "bg-zinc-900 text-zinc-400 border-zinc-700"
                        }`}>
                          {b.status === "pending" ? "Awaiting Checkout" :
                           b.status === "confirmed" ? "Session Paid — Confirm When Done" :
                           b.status === "completed" ? "Completed ✓" :
                           b.status}
                        </span>
                        <span className="font-mono text-indigo-400 font-bold">${b.total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Two-Way Confirmation Status */}
                  {b.status === "confirmed" && (
                    <div className="bg-zinc-950/60 rounded-xl p-5 border border-zinc-800/80">
                      <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-4">Session Confirmation Status</p>
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className={`rounded-xl p-4 border text-center ${b.coach_confirmed_at ? "bg-indigo-500/10 border-indigo-500/30" : "bg-zinc-900 border-zinc-800"}`}>
                          <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">Coach</p>
                          <p className={`text-sm font-semibold ${b.coach_confirmed_at ? "text-indigo-400" : "text-zinc-600"}`}>
                            {b.coach_confirmed_at ? "✓ Confirmed" : "⏳ Pending"}
                          </p>
                        </div>
                        <div className={`rounded-xl p-4 border text-center ${b.player_confirmed_at ? "bg-indigo-500/10 border-indigo-500/30" : "bg-zinc-900 border-zinc-800"}`}>
                          <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">You (Player)</p>
                          <p className={`text-sm font-semibold ${b.player_confirmed_at ? "text-indigo-400" : "text-zinc-600"}`}>
                            {b.player_confirmed_at ? "✓ Confirmed" : "⏳ Pending"}
                          </p>
                        </div>
                      </div>

                      {/* Player Confirm Button */}
                      {!b.player_confirmed_at && (
                        <button
                          onClick={() => handleConfirmSession(b.id)}
                          disabled={confirmingSession === b.id}
                          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-all  disabled:opacity-50 active:scale-[0.98]"
                        >
                          {confirmingSession === b.id ? "Confirming..." : "✓ Confirm Session Complete"}
                        </button>
                      )}
                      {!!b.player_confirmed_at && !b.coach_confirmed_at && (
                        <p className="text-center text-amber-400 text-xs font-bold">Waiting for coach to confirm...</p>
                      )}
                    </div>
                  )}

                  {/* Rating Form (After completion) */}
                  {b.status === "completed" && !b.player_rating && (
                    <div className="bg-gradient-to-br from-amber-500/5 to-transparent rounded-xl p-6 border border-amber-500/20">
                      <p className="text-sm font-semibold text-white mb-4">Rate Your Session</p>
                      <div className="flex gap-2 mb-4">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onMouseEnter={() => setRatingHover(star)}
                            onMouseLeave={() => setRatingHover(0)}
                            onClick={() => { setRatingValue(star); setRatingBookingId(b.id); }}
                            className={`text-3xl transition-all hover:scale-125 ${
                              star <= (ratingHover || (ratingBookingId === b.id ? ratingValue : 0))
                                ? "text-amber-400"
                                : "text-zinc-700"
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      {ratingBookingId === b.id && ratingValue > 0 && (
                        <div className="space-y-3 anim-fade-in">
                          <textarea
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                            placeholder="Tell us about your experience (optional)"
                            maxLength={500}
                            rows={3}
                            className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm placeholder:text-zinc-700 outline-none focus:border-amber-500/30 resize-none"
                          />
                          <button
                            onClick={() => handleSubmitRating(b.id)}
                            disabled={submittingRating}
                            className="w-full py-3 bg-amber-500 text-black rounded-xl font-semibold text-xs uppercase tracking-wider hover:bg-amber-400 transition-all disabled:opacity-50"
                          >
                            {submittingRating ? "Submitting..." : `Submit ${ratingValue}-Star Review`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show existing rating */}
                  {!!b.player_rating && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-amber-400">{"★".repeat(b.player_rating)}{"☆".repeat(5 - b.player_rating)}</span>
                      <span className="text-zinc-500 font-bold">Your Review</span>
                      {!!b.player_review && <span className="text-zinc-400 italic text-xs">— "{b.player_review}"</span>}
                    </div>
                  )}

                  {/* Optional: VOD Upload (separate feature, not gating payment) */}
                  {b.status === "confirmed" && (
                    <div className="border-t border-zinc-800/50 pt-4">
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mb-3">Optional: Upload Match Footage for Analysis</p>
                      <div className="flex gap-3">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-xs transition-all cursor-pointer border border-dashed ${
                          uploadingVod === b.id
                            ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50"
                            : "bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:text-indigo-400 hover:border-indigo-500/30"
                        }`}>
                          {uploadingVod === b.id ? "Uploading..." : "📎 Upload MP4"}
                          <input type="file" accept="video/*" className="hidden" disabled={!!uploadingVod} onChange={(e) => handleVodUpload(e, b.id)} />
                        </label>
                        {!!b.vod_url && (
                          <a href={b.vod_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 py-3 px-4 bg-zinc-800 text-white rounded-xl font-semibold text-xs hover:bg-zinc-700 transition-colors border border-zinc-700">
                            ▶ Watch VOD
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            ))}

            {realBookings.length === 0 && (
              <div className="text-center py-20 glass-card">
                <p className="text-zinc-400 mb-4">You haven&apos;t booked any sessions yet.</p>
                <button onClick={() => setView("discovery")} className="text-indigo-400 font-semibold hover:text-indigo-300">
                  Find a Coach →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── VIEW 3: COACH DASHBOARD ── */}
        {view === "dashboard" && currentUser.role === "coach" && (
          <div className="anim-fade-in-up space-y-12">
            {/* Stripe Onboarding Alert */}
            {stripeOnboarded === false && (
              <div className="glass-card p-6 border-amber-500/20 bg-amber-500/[0.03] relative overflow-hidden anim-fade-in">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-xl shrink-0">⚠️</div>
                    <div>
                      <p className="font-semibold text-lg tracking-tight text-white mb-1">Financial Link Missing</p>
                      <p className="text-xs font-medium text-zinc-400 leading-relaxed max-w-xl">
                        You must complete your Stripe onboarding to receive session payouts. Your profile is currently hidden from players until this connection is verified.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button
                      onClick={refreshStripeStatus}
                      disabled={isSyncingStripe}
                      className="flex-1 md:flex-none bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 text-white px-6 py-3 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSyncingStripe ? <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Refresh Status"}
                    </button>
                    <button
                      onClick={async () => {
                        const { resetStripeConnection } = await import('@/app/actions/stripe');
                        if (confirm("This will completely erase your current Stripe connection so you can start over. Proceed?")) {
                          setIsInitiatingStripe(true);
                          const res = await resetStripeConnection();
                          if (res.success) {
                            window.location.reload();
                          } else {
                            setBookingMessage({ type: "error", text: `Reset failed: ${res.error}` });
                            setIsInitiatingStripe(false);
                          }
                        }
                      }}
                      disabled={isInitiatingStripe}
                      className="flex-1 md:flex-none bg-red-500/10 border border-red-500/50 hover:bg-red-500/20 text-red-500 px-6 py-3 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      Reset & Start Over
                    </button>
                    <button
                      onClick={async () => {
                        setIsInitiatingStripe(true);
                        try {
                          const res = await createStripeConnectAccount(window.location.origin);
                          if (res?.url) {
                            window.location.href = res.url;
                          } else if (res?.alreadyComplete) {
                            setStripeOnboarded(true);
                            setBookingMessage({ type: "success", text: "Stripe Connection Verified! You are now live." });
                          } else if (res?.error) {
                            setBookingMessage({ type: "error", text: `Stripe Alert: ${res.error}` });
                          } else {
                            setBookingMessage({ type: "error", text: "Stripe connection failed for an unknown reason." });
                          }
                        } catch (err: any) {
                          setBookingMessage({ type: "error", text: "Something went wrong connecting to Stripe. Please try again." });
                        } finally {
                          setIsInitiatingStripe(false);
                        }
                      }}
                      disabled={isInitiatingStripe}
                      className="flex-1 md:flex-none bg-white text-black hover:bg-zinc-200 px-6 py-3 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all  block text-center disabled:opacity-50"
                    >
                      {isInitiatingStripe ? "Processing..." : "Complete Setup"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  Coach Dashboard
                </h2>
                <p className="text-zinc-500 text-xs">
                  Your Dashboard
                </p>
              </div>
              <div className="flex gap-4">
                <div className="glass-card px-6 py-3 border-indigo-500/20 bg-indigo-500/5">
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Total Career Revenue</p>
                  <p className="text-xl font-semibold text-white font-mono">
                    ${realBookings
                      .filter((b: Booking) => b.status === "completed")
                      .reduce((acc: number, b: Booking) => acc + Number(b.amount || 0), 0)
                      .toFixed(2)}
                  </p>
                </div>
                <Link
                  href="/coach/edit"
                  className="glass-card px-6 py-3 border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all flex items-center gap-2 group/edit"
                >
                  <span className="text-[9px] text-indigo-400 font-semibold uppercase tracking-wider">Edit Profile</span>
                  <svg className="w-3 h-3 text-indigo-400 group-hover/edit:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              {[
                {
                  label: "Pending",
                  val: `$${realBookings
                    .filter((b: Booking) => b.status === "completed" && !b.payout_id)
                    .reduce((sum, b: Booking) => sum + Number(b.amount || 0), 0)
                    .toFixed(2)}`,
                  color: "text-orange-400",
                },
                {
                  label: "Net Earnings",
                  val: `$${realBookings
                    .filter((b: Booking) => !!b.payout_id)
                    .reduce((sum: number, b: Booking) => sum + Number(b.amount || 0) * (1 - PLATFORM_CUT), 0)
                    .toFixed(2)}`,
                  color: "text-indigo-400",
                },
                {
                  label: "Sessions",
                  val: realBookings.length.toString(),
                  color: "text-white",
                },
                {
                  label: "Platform Fee",
                  val: `$${realBookings
                    .filter((b: Booking) => b.payout_id)
                    .reduce((sum, b: Booking) => sum + Number(b.amount || 0) * PLATFORM_CUT, 0)
                    .toFixed(2)}`,
                  color: "text-zinc-500",
                },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-6">
                  <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider mb-3">{stat.label}</p>
                  <p className={`text-2xl font-semibold font-mono  ${stat.color}`}>{stat.val}</p>
                </div>
              ))}
            </div>

            {/* Action Queue */}
            <div>
              <h3 className="text-sm font-semibold mb-6 text-zinc-400 flex items-center gap-3 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)] " />
                Sessions Requiring Action
              </h3>
              {realBookings.filter((b: Booking) => b.status === 'confirmed' && !b.coach_confirmed_at).length > 0 ? (
                <div className="grid gap-4">
                  {realBookings.filter((b: Booking) => b.status === 'confirmed' && !b.coach_confirmed_at).map((booking: Booking) => (
                    <div key={booking.id} className="glass-card overflow-hidden group/action relative border-l-4 border-l-cyan-500">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.03] to-transparent pointer-events-none" />
                      <div className="p-6 md:p-8">
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-5">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-indigo-500 text-xl font-semibold ">
                              {booking.player_name?.charAt(0) || "P"}
                            </div>
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-lg font-semibold text-white tracking-tight">{booking.player_name || "Player"}</h4>
                                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-500/30 font-semibold uppercase tracking-wider">Confirm Session</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <p className="text-xs text-zinc-500 font-bold font-mono  opacity-80">{booking.player_email}</p>
                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Session: {new Date(booking.session_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-3 py-1.5 rounded-lg font-semibold uppercase tracking-wider ${
                              booking.player_confirmed_at 
                                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                                : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                            }`}>
                              Player: {booking.player_confirmed_at ? "✓ Confirmed" : "Pending"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleConfirmSession(booking.id)}
                          disabled={confirmingSession === booking.id}
                          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-all  disabled:opacity-50 active:scale-[0.98]"
                        >
                          {confirmingSession === booking.id ? "Confirming..." : "✓ Confirm Session Complete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card p-12 text-center border-dashed border-zinc-800 bg-zinc-900/10 container-blur">
                  <div className="w-16 h-16 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-zinc-800 ">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">No sessions awaiting confirmation. You're all caught up!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VIEW 4: ADMIN CONSOLE ── */}
        {view === "admin" && currentUser.role === "admin" && (
          <div className="anim-fade-in-up space-y-10">
            <div>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                  <h2 className="text-4xl font-semibold  text-white mb-2">
                    Admin <span className="gradient-text">Dashboard</span>
                  </h2>
                  <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider opacity-80">
                    Platform Overview & Management
                  </p>
                </div>
              </div>

              {/* ── Admin Tabs ── */}
              <div className="flex gap-2 mb-10 border-b border-zinc-800/50 pb-4">
                {(["overview", "coaches", "bookings"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAdminTab(tab)}
                    className={`px-5 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all ${
                      adminTab === tab
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                        : "text-zinc-500 hover:text-white hover:bg-zinc-800/40 border border-transparent"
                    }`}
                  >
                    {tab === "overview" ? "📊 Overview" : tab === "coaches" ? "👥 Coaches" : "📅 Bookings"}
                  </button>
                ))}
              </div>

              {adminLoading ? (
                <div className="glass-card p-24 text-center">
                  <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6" />
                  <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider">Loading data...</p>
                </div>
              ) : (
                <>
                  {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
                  {adminTab === "overview" && (
                    <div className="space-y-10">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                          {
                            label: "Total Coaches",
                            val: adminCoaches.length.toString(),
                            color: "text-indigo-400",
                            unit: "SIGNED UP",
                          },
                          {
                            label: "Active Coaches",
                            val: adminCoaches.filter((c: AdminCoach) => !c.banned).length.toString(),
                            color: "text-indigo-400",
                            unit: "LIVE",
                          },
                          {
                            label: "Total Bookings",
                            val: adminBookings.length.toString(),
                            color: "text-purple-400",
                            unit: "ALL TIME",
                          },
                          {
                            label: "Revenue (Platform)",
                            val: "$" + adminBookings
                              .filter((b) => b.status === "completed" || b.status === "confirmed")
                              .reduce((sum, b) => sum + Math.round(((Number(b.rate)) || 0) * PLATFORM_CUT), 0)
                              .toString(),
                            color: "text-white",
                            unit: "EARNED",
                          },
                        ].map((stat, i) => (
                          <div key={i} className="glass-card p-6 relative overflow-hidden group/stat">
                            <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl rounded-full -mr-12 -mt-12 opacity-10 transition-all group-hover/stat:opacity-20 ${stat.color === 'text-indigo-400' ? 'bg-indigo-500' : stat.color === 'text-indigo-400' ? 'bg-indigo-500' : stat.color === 'text-purple-400' ? 'bg-purple-400' : 'bg-white'}`} />
                            <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider mb-4">
                              {stat.label}
                            </p>
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className={`text-4xl font-semibold font-mono  ${stat.color}`}>{stat.val}</span>
                              <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider">{stat.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Upcoming Sessions */}
                      <div>
                        <h3 className="text-sm font-semibold mb-6 text-zinc-400 flex items-center gap-4 uppercase tracking-wider">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500/30 border border-indigo-500 flex items-center justify-center p-0.5">
                            <span className="w-full h-full rounded-full bg-indigo-500" />
                          </span>
                          Upcoming Sessions
                        </h3>
                        {(() => {
                          const upcoming = adminBookings
                            .filter((b) => {
                              const d = String(b.session_date);
                              return (b.status === "confirmed" || b.status === "pending") && d && new Date(d) >= new Date(new Date().toDateString());
                            })
                            .sort((a, b) => new Date(a.session_date as string).getTime() - new Date(String(b.session_date)).getTime())
                            .slice(0, 10);

                          if (upcoming.length === 0) {
                            return (
                              <div className="glass-card p-12 text-center border-dashed border-zinc-800">
                                <p className="text-3xl mb-4 opacity-30">📅</p>
                                <p className="text-zinc-500 text-sm font-bold">No upcoming sessions scheduled</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {upcoming.map((b, i) => {
                                const coach = b.coach as Record<string, string> | null;
                                const player = b.player as Record<string, string> | null;
                                return (
                                  <div key={i} className="glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-indigo-500/20">
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-sm">
                                        📅
                                      </div>
                                      <div>
                                        <p className="text-white font-bold text-sm">
                                          {new Date(String(b.session_date)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                          {!!b.session_time && <span className="text-zinc-500 ml-2">@ {String(b.session_time)}</span>}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                          {coach?.full_name || "Unknown Coach"} → {player?.full_name || String(b.player_name) || "Player"}
                                          {!!b.location && <span className="ml-2 text-indigo-400/70">📍 {String(b.location)}</span>}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-white font-semibold font-mono">${Number(b.rate)}</span>
                                      <span className={`text-[9px] px-3 py-1 rounded-lg font-semibold uppercase tracking-wider border ${
                                        b.status === "confirmed"
                                          ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                      }`}>{String(b.status)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Recent Completed */}
                      <div>
                        <h3 className="text-sm font-semibold mb-6 text-zinc-400 flex items-center gap-4 uppercase tracking-wider">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500/30 border border-green-500 flex items-center justify-center p-0.5">
                            <span className="w-full h-full rounded-full bg-green-500" />
                          </span>
                          Recently Completed
                        </h3>
                        {(() => {
                          const completed = adminBookings
                            .filter((b) => b.status === "completed")
                            .slice(0, 5);

                          if (completed.length === 0) {
                            return (
                              <div className="glass-card p-12 text-center border-dashed border-zinc-800">
                                <p className="text-3xl mb-4 opacity-30">✅</p>
                                <p className="text-zinc-500 text-sm font-bold">No completed sessions yet</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {completed.map((b, i) => {
                                const coach = b.coach as Record<string, string> | null;
                                const player = b.player as Record<string, string> | null;
                                return (
                                  <div key={i} className="glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 opacity-80">
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-sm">
                                        ✅
                                      </div>
                                      <div>
                                        <p className="text-white font-bold text-sm">
                                          {new Date(String(b.session_date)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                          {coach?.full_name || "Coach"} → {player?.full_name || String(b.player_name) || "Player"}
                                          {!!b.player_rating && <span className="ml-2 text-amber-400">{"★".repeat(Number(b.player_rating))}</span>}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-zinc-400 font-bold font-mono text-sm">${Number(b.rate)}</span>
                                      <span className="text-[9px] text-zinc-600 font-bold">→ ${Math.round((Number(b.rate)) * PLATFORM_CUT)} fee</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* ═══════════════ COACHES TAB ═══════════════ */}
                  {adminTab === "coaches" && (
                    <div>
                      <h3 className="text-sm font-semibold mb-8 text-zinc-400 flex items-center gap-4 uppercase tracking-wider">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500/30 border border-indigo-500 flex items-center justify-center p-0.5">
                          <span className="w-full h-full rounded-full bg-indigo-500" />
                        </span>
                        All Coaches ({adminCoaches.length})
                      </h3>

                      {adminCoaches.length === 0 ? (
                        <div className="glass-card p-20 text-center border-dashed border-zinc-800">
                          <p className="text-5xl mb-6 opacity-30">🏟️</p>
                          <p className="text-zinc-400 font-semibold uppercase tracking-wider mb-2">No Coaches Yet</p>
                          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider">No coach profiles have been created yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {adminCoaches.map((coach: AdminCoach) => (
                            <div
                              key={coach.id}
                              className={`glass-card overflow-hidden transition-all duration-500 group/personnel ${coach.banned ? "opacity-60 border-red-900/40 bg-red-500/[0.01]" : "hover:border-indigo-500/30"}`}
                            >
                              <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
                                <div className="flex items-center gap-6">
                                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${coach.gradient} flex items-center justify-center text-white font-semibold text-xl  relative z-10 border border-white/10 ${coach.banned ? "grayscale" : ""}`}>
                                    {coach.avatar}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                      <h4 className="text-xl font-semibold text-white ">
                                        {coach.name}
                                      </h4>
                                      <div className="flex gap-2">
                                        {coach.banned ? (
                                          <span className="text-[9px] bg-red-500/10 text-red-400 px-3 py-1 rounded-lg border border-red-500/20 font-semibold tracking-wider">BANNED</span>
                                        ) : (
                                          <>
                                            {coach.verified ? (
                                              <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-500/20 font-semibold tracking-wider leading-none flex items-center">✓ VERIFIED</span>
                                            ) : (
                                              <span className="text-[9px] bg-zinc-800 text-zinc-500 px-3 py-1 rounded-lg border border-zinc-700/50 font-semibold tracking-wider leading-none flex items-center">PENDING</span>
                                            )}
                                            {coach.stripeConnected && (
                                              <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-500/20 font-semibold tracking-wider leading-none flex items-center">STRIPE ✓</span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                      <span className="flex items-center gap-1.5"><Stars rating={coach.rating} /> {coach.rating}</span>
                                      <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                      <span>${coach.rate}/session</span>
                                      <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                      <span className="text-zinc-600 lowercase font-mono">{coach.email}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  {coach.banned ? (
                                    <button
                                      onClick={async () => {
                                        setBanningCoach(coach.id);
                                        await unbanCoach(coach.id);
                                        const updated = await getAllCoachesAdmin();
                                        setAdminCoaches(updated as unknown as AdminCoach[]);
                                        const publicCoaches = await getCoaches();
                                        setDbCoaches(publicCoaches as unknown as Coach[]);
                                        setBanningCoach(null);
                                      }}
                                      disabled={banningCoach === coach.id}
                                      className="bg-indigo-500 text-black hover:bg-pink-300 px-8 py-3.5 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all  disabled:opacity-50"
                                    >
                                      {banningCoach === coach.id ? "RESTORING..." : "RESTORE ACCESS"}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={async () => {
                                        setBanningCoach(coach.id);
                                        await banCoach(coach.id);
                                        const updated = await getAllCoachesAdmin();
                                        setAdminCoaches(updated as unknown as AdminCoach[]);
                                        const publicCoaches = await getCoaches();
                                        setDbCoaches(publicCoaches as unknown as Coach[]);
                                        setBanningCoach(null);
                                      }}
                                      disabled={banningCoach === coach.id}
                                      className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-8 py-3.5 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all border border-red-500/30 hover:border-transparent disabled:opacity-50"
                                    >
                                      {banningCoach === coach.id ? "BANNING..." : "BAN COACH"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══════════════ BOOKINGS TAB ═══════════════ */}
                  {adminTab === "bookings" && (
                    <div>
                      <h3 className="text-sm font-semibold mb-8 text-zinc-400 flex items-center gap-4 uppercase tracking-wider">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500/30 border border-purple-500 flex items-center justify-center p-0.5">
                          <span className="w-full h-full rounded-full bg-purple-500" />
                        </span>
                        All Bookings ({adminBookings.length})
                      </h3>

                      {adminBookings.length === 0 ? (
                        <div className="glass-card p-20 text-center border-dashed border-zinc-800">
                          <p className="text-5xl mb-6 opacity-30">📋</p>
                          <p className="text-zinc-400 font-semibold uppercase tracking-wider mb-2">No Bookings Yet</p>
                          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider">Bookings will appear here once players start booking sessions.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {adminBookings.map((b, i) => {
                            const coach = b.coach as Record<string, string> | null;
                            const player = b.player as Record<string, string> | null;
                            const statusColors: Record<string, string> = {
                              pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                              confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                              completed: "bg-green-500/10 text-green-400 border-green-500/20",
                              cancelled: "bg-zinc-800 text-zinc-500 border-zinc-700/50",
                            };
                            const status = String(b.status);
                            return (
                              <div key={i} className="glass-card p-5 hover:border-indigo-500/20 transition-all">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="flex items-center gap-4 flex-1">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm border ${
                                      status === "completed" ? "bg-green-500/10 border-green-500/20" :
                                      status === "confirmed" ? "bg-blue-500/10 border-blue-500/20" :
                                      "bg-zinc-800/50 border-zinc-700/30"
                                    }`}>
                                      {status === "completed" ? "✅" : status === "confirmed" ? "📅" : "⏳"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                                        <p className="text-white font-bold text-sm truncate">
                                          {coach?.full_name || "Unknown Coach"}
                                        </p>
                                        <span className="text-zinc-700">→</span>
                                        <p className="text-zinc-300 font-medium text-sm truncate">
                                          {player?.full_name || String(b.player_name) || "Player"}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex-wrap">
                                        <span>
                                          {b.session_date ? new Date(String(b.session_date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "No date"}
                                        </span>
                                        {!!b.session_time && (
                                          <>
                                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                            <span>{String(b.session_time)}</span>
                                          </>
                                        )}
                                        {!!b.location && (
                                          <>
                                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                            <span className="text-indigo-400/70">📍 {String(b.location)}</span>
                                          </>
                                        )}
                                        {!!b.player_rating && (
                                          <>
                                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                            <span className="text-amber-400">{"★".repeat(Number(b.player_rating))}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="text-white font-semibold font-mono">${Number(b.rate)}</span>
                                    <span className={`text-[9px] px-3 py-1.5 rounded-lg font-semibold uppercase tracking-wider border ${statusColors[status] || statusColors.pending}`}>
                                      {status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ═══════════════
          FOOTER
          ═══════════════ */}
      <footer className="mt-24 py-8 border-t border-zinc-800/30 text-center px-4 relative z-10">
        <p className="text-[11px] text-zinc-500 max-w-2xl mx-auto leading-loose">
          By using CoachingMatch, you agree to our{" "}
          <button
            id="tos-link"
            onClick={() => setActiveModal("tos")}
            className="text-zinc-400 hover:text-indigo-400 underline underline-offset-4 decoration-slate-700 hover:decoration-indigo-500/50 transition-colors mx-1"
          >
            Terms of Service
          </button>
          .
        </p>
      </footer>
    </div>
  );
}

/* ─── Nav Button Component ─── */
function NavBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "text-white bg-zinc-800"
          : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
      }`}
    >
      {children}
    </button>
  );
}
