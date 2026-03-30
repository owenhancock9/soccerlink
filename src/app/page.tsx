"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import { getCoaches, getMyCoachProfile, getAllCoachesAdmin, banCoach, unbanCoach } from "@/app/actions/coaches";
import { createBooking, getCoachBookings, getMyBookings } from "@/app/actions/bookings";
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
  session_date: string;
  session_time: string;
  coach?: { full_name: string };
  player_name?: string;
  player_email?: string;
  vod_url?: string;
  payout_id?: string;
  [key: string]: unknown; // Index signature for safety with dynamic properties
}

/* ─── Star Renderer ─── */
function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <span className="inline-flex gap-[1px] text-amber-400 text-xs">
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
  gradient: string;
  experience?: string;
  highlightUrl?: string;
  availability?: string[];
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
      className="glass-card p-7 flex flex-col justify-between group overflow-visible relative border-slate-800/60 hover:border-indigo-500/30 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Background Glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${coach.gradient} opacity-[0.02] blur-3xl rounded-full -mr-16 -mt-16 group-hover:opacity-[0.05] transition-all duration-700`} />
      
      <div className="relative z-10">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${coach.gradient} flex items-center justify-center text-white font-black text-xl shadow-2xl shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 z-10 relative border border-white/10`}
              >
                {coach.avatar}
              </div>
              <div className={`absolute inset-0 bg-gradient-to-br ${coach.gradient} blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-700 rounded-full scale-125`} />
            </div>
            
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                <h3 className="text-xl font-black text-white tracking-tighter leading-none">
                  {coach.name}
                </h3>
                {coach.verified && (
                  <span className="shrink-0 flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-black uppercase tracking-[0.1em] shadow-sm shadow-emerald-500/5">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                    PRO
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                   <Stars rating={coach.rating} />
                   <span className="text-[11px] text-white font-black font-mono tracking-tighter">
                     {coach.rating}
                   </span>
                </div>
                <span className="w-1 h-1 rounded-full bg-slate-800" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-80 decoration-slate-700">
                  {coach.reviews} REVIEWS
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end leading-none">
            <span className="text-2xl font-black text-white font-mono tracking-tighter">
              ${coach.rate}
            </span>
            <span className="text-[9px] text-slate-600 uppercase font-black tracking-[0.2em] mt-1.5 opacity-60">PER SESSION</span>
          </div>
        </div>

        {/* Tactical Info */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="bg-slate-950/80 text-slate-300 text-[9px] px-3 py-1.5 rounded-lg font-black uppercase tracking-[0.15em] border border-slate-800/80 shadow-inner">
            {coach.role}
          </span>
          <span className="text-cyan-400 text-[10px] font-black font-mono uppercase tracking-widest bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20">
            {coach.style}
          </span>
        </div>

        {/* Narrative Bio */}
        <p className="text-sm text-slate-400/90 leading-relaxed mb-8 line-clamp-2 font-medium tracking-tight h-10 italic">
          &quot;{coach.bio}&quot;
        </p>

        {/* Digital Availability Rails */}
        {coach.availability && coach.availability.length > 0 && (
          <div className="mb-8 overflow-hidden relative group/rails">
            <div className="flex gap-2.5">
              {coach.availability.map((day) => (
                <div
                  key={day}
                  className="flex flex-col items-center bg-slate-950 border border-slate-800/60 rounded-xl px-4 py-2 min-w-[64px] transition-all group-hover/rails:border-indigo-500/20 group-hover/rails:bg-indigo-500/[0.02]"
                >
                  <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest mb-1.5">{day.split(" ")[0]}</span>
                  <span className="text-[10px] text-slate-300 font-black font-mono">{day.split(" ")[1] || "ANY"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Deployment Trigger (CTA) */}
      <div className="relative">
        <button
          id={`book-coach-${coach.id}`}
          onClick={() => onBook(coach)}
          className="relative w-full py-4.5 bg-white text-black hover:bg-slate-200 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] transition-all active:scale-[0.98] overflow-hidden group/btn shadow-[0_15px_30px_rgba(255,255,255,0.1)] hover:-translate-y-1"
        >
          {/* Shimmer Effect */}
          <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite] pointer-events-none" />
          Reserve Deployment
        </button>
      </div>
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

  const [isSyncingStripe, setIsSyncingStripe] = useState(false);

  async function refreshStripeStatus() {
    setIsSyncingStripe(true);
    const profile = await getMyCoachProfile();
    if (profile) {
      const p = profile as Record<string, unknown>;
      setStripeOnboarded(!!p.stripe_onboarding_complete);
      if (p.stripe_onboarding_complete) {
        setBookingMessage({ type: "success", text: "Stripe Connection Verified! You are now live." });
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
      getMyCoachProfile().then((profile) => {
        const p = profile as Record<string, unknown>;
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

  /* ── Admin State ── */
  const [adminCoaches, setAdminCoaches] = useState<AdminCoach[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [banningCoach, setBanningCoach] = useState<string | null>(null);

  /* ── Fetch Coaches from DB ── */
  useEffect(() => {
    async function loadCoaches() {
      const coaches = await getCoaches();
      setDbCoaches(coaches as unknown as Coach[]);
      setCoachesLoaded(true);
    }
    loadCoaches();
  }, []);

  /* ── Fetch Admin Coaches ── */
  useEffect(() => {
    if (currentUser.role === "admin" && currentUser.isAuthenticated) {
      getAllCoachesAdmin().then((coaches) => {
        setAdminCoaches(coaches as unknown as AdminCoach[]);
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
      getMyCoachProfile().then((profile) => {
        const p = profile as Record<string, unknown>;
        if (p?.stripe_onboarding_complete) {
          setStripeOnboarded(true);
        }
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
    setSelectedCoach(coach);
    setSelectedDate(null);
    setSelectedTime(null);
    setActiveModal("schedule");
  }, []);

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

  /* ═══════════════════
     RENDER
     ═══════════════════ */
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-slate-100 relative">
      {/* ── Ambient Background Glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] bg-indigo-600/[0.04] rounded-full blur-[120px]" />
        <div className="absolute -bottom-[30%] -right-[20%] w-[50%] h-[50%] bg-violet-600/[0.03] rounded-full blur-[120px]" />
      </div>

      {/* ═══════════════
          MODALS
          ═══════════════ */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={closeModal}
        >
          <div
            className="bg-slate-900 border border-slate-800 p-7 md:p-10 rounded-[2.5rem] max-w-5xl w-full shadow-[0_0_100px_rgba(0,0,0,0.8)] relative anim-scale-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Glows for Modal */}
            <div className="absolute -top-[20%] -right-[10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute -bottom-[20%] -left-[10%] w-[30%] h-[30%] bg-cyan-500/5 rounded-full blur-[60px] pointer-events-none" />

            <button
              id="modal-close"
              onClick={closeModal}
              className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all z-20 border border-slate-700/50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Schedule Modal */}
            {activeModal === "schedule" && selectedCoach && (
              <div className="anim-fade-in flex flex-col md:flex-row gap-10 relative z-10">
                {/* Left Side: Coach Info */}
                <div className="flex-1">
                  <div className="flex gap-6 mb-10">
                    <div className="relative shrink-0">
                      <div
                        className={`w-24 h-24 rounded-[2rem] bg-gradient-to-br ${selectedCoach.gradient} flex items-center justify-center text-white font-black text-4xl shadow-2xl relative z-10 border-2 border-white/10`}
                      >
                        {selectedCoach.avatar}
                      </div>
                      <div className={`absolute inset-0 bg-gradient-to-br ${selectedCoach.gradient} blur-3xl opacity-40 rounded-full`} />
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-3xl font-black text-white tracking-tighter">
                          {selectedCoach.name}
                        </h2>
                        {selectedCoach.verified && (
                          <span className="flex items-center gap-1.5 text-[10px] bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 font-black uppercase tracking-widest">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                            VERIFIED PRO
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-emerald-400/90 font-bold uppercase tracking-widest mb-3">
                        {selectedCoach.experience || "ELITE PERFORMANCE COACH"}
                      </p>

                      <div className="flex items-center gap-3 text-sm">
                        <Stars rating={selectedCoach.rating} />
                        <span className="font-extrabold text-white text-lg leading-none">
                          {selectedCoach.rating}
                        </span>
                        <span className="text-slate-500 font-bold uppercase tracking-tighter text-xs">({selectedCoach.reviews} reviews)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-8">
                    <span className="bg-slate-800/80 text-slate-200 text-[11px] px-4 py-2 rounded-xl font-black uppercase tracking-widest border border-slate-700/50 shadow-lg">
                      {selectedCoach.role}
                    </span>
                    <span className="bg-cyan-500/10 text-cyan-400 text-[11px] px-4 py-2 rounded-xl border border-cyan-500/20 font-black uppercase tracking-widest shadow-lg">
                      {selectedCoach.style}
                    </span>
                  </div>

                  <p className="text-slate-300 text-base leading-relaxed mb-10 bg-slate-950/30 p-6 rounded-[2rem] border border-slate-800/50 font-medium whitespace-pre-wrap">
                    {selectedCoach.bio}
                  </p>

                  <div className="space-y-6">
                    {selectedCoach.availability && selectedCoach.availability.length > 0 && (
                      <div>
                        <p className="text-[11px] text-slate-500 uppercase tracking-[0.3em] font-black mb-4 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Coach&apos;s Weekly Hours
                        </p>
                        <div className="flex flex-wrap gap-2.5">
                          {selectedCoach.availability.map((day, i) => (
                            <span
                              key={i}
                              className="text-xs bg-slate-950 text-slate-200 px-4 py-2.5 rounded-xl border-l-4 border-emerald-500 font-mono font-bold shadow-2xl flex items-center"
                            >
                              {day}
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
                        className="flex items-center justify-center gap-4 w-full bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-widest transition-all shadow-xl hover:-translate-y-1 hover:shadow-red-500/10 active:scale-[0.98]"
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                        Watch Highlight Reel
                      </a>
                    )}
                  </div>
                </div>

                {/* Right Side: Simple Selection & Receipt */}
                <div className="md:w-[22rem] shrink-0">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-[2.5rem] p-8 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden group/receipt h-full transition-all hover:border-emerald-500/20">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/[0.03] blur-3xl rounded-full -mr-24 -mt-24 pointer-events-none group-hover/receipt:bg-emerald-500/[0.08] transition-all duration-700" />
                    
                    <h3 className="text-white font-black text-xl mb-8 tracking-tighter flex items-center gap-3">
                       <span className="w-2 h-7 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                       Confirm Session
                    </h3>

                    <div className="space-y-10">
                      {/* Step 1: Date Picker */}
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black block mb-4 ml-1">
                          1 • Pick a Date
                        </label>
                        <div className="grid grid-cols-7 gap-1.5 text-center bg-slate-900/40 p-3 rounded-2xl border border-slate-800/60">
                          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                            <div key={`day-${i}`} className="text-[10px] text-slate-600 font-bold py-2">
                              {d}
                            </div>
                          ))}
                          {Array.from({ length: 14 }).map((_, i) => {
                            const dayVal = i + 10;
                            const isSel = selectedDate === dayVal;
                            return (
                              <button
                                key={i}
                                onClick={() => setSelectedDate(dayVal)}
                                className={`h-9 w-9 flex items-center justify-center rounded-xl text-[13px] font-black transition-all ${
                                  isSel
                                    ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-110 z-10"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                }`}
                              >
                                {dayVal}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Step 2: Time Slots */}
                      <div className={selectedDate ? "anim-fade-in" : "opacity-30 pointer-events-none transition-opacity"}>
                        <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black block mb-4 ml-1">
                          2 • Preferred Time
                        </label>
                        <div className="grid grid-cols-1 gap-2.5">
                          {["10:00 AM", "2:30 PM", "7:00 PM"].map((t) => (
                            <button
                              key={t}
                              onClick={() => setSelectedTime(t)}
                              className={`w-full py-3.5 rounded-2xl text-[13px] font-black tracking-wide transition-all border-2 ${
                                selectedTime === t
                                  ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]"
                                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 shadow-lg"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Step 3: Receipt */}
                      {selectedDate && selectedTime ? (
                        <div className="anim-fade-in pt-8 border-t-2 border-dashed border-slate-800/80">
                          <div className="space-y-4 mb-8">
                            <div className="flex justify-between text-sm font-bold">
                              <span className="text-slate-500 uppercase tracking-widest text-[10px]">Coaching Session</span>
                              <span className="text-white">${selectedCoach.rate}.00</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold">
                              <span className="text-slate-500 uppercase tracking-widest text-[10px]">Platform Vault Fee</span>
                              <span className="text-white">$7.00</span>
                            </div>
                            <div className="flex justify-between items-end pt-5 border-t border-slate-800/50">
                              <span className="text-slate-400 font-black uppercase text-[11px] tracking-[0.2em]">TOTAL DUE</span>
                              <span className="text-white text-3xl font-black tracking-tighter leading-none">${selectedCoach.rate + 7}.00</span>
                            </div>
                          </div>

                          {bookingMessage && (
                            <div className={`p-5 rounded-2xl text-xs font-black mb-6 border-2 flex items-start gap-3 ${
                              bookingMessage.type === "success" 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            }`}>
                              <span className="mt-0.5">{bookingMessage.type === "success" ? "✓" : "!"}</span>
                              {bookingMessage.text}
                            </div>
                          )}

                          <button
                            id="confirm-pay-btn"
                            disabled={bookingLoading}
                            onClick={async () => {
                              if (!currentUser.isAuthenticated) {
                                setBookingMessage({ type: "error", text: "Please sign in to proceed." });
                                return;
                              }
                              setBookingLoading(true);
                              setBookingMessage(null);
                              
                              const formData = new FormData();
                              formData.set("coachId", String(selectedCoach.id));
                              formData.set("sessionDate", `2025-10-${String(selectedDate).padStart(2, "0")}`);
                              formData.set("sessionTime", selectedTime || "10:00 AM");
                              formData.set("rate", String(selectedCoach.rate));
                              
                              const result = await createBooking(formData);
                              if (result.error) {
                                setBookingMessage({ type: "error", text: result.error });
                                setBookingLoading(false);
                              } else if (result.url) {
                                window.location.href = result.url;
                              }
                            }}
                            className="gradient-btn w-full py-5 text-[15px] uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(16,185,129,0.3)] hover:shadow-[0_25px_50px_rgba(16,185,129,0.4)] transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:grayscale group-hover/receipt:scale-[1.02]"
                          >
                            {bookingLoading ? "Connecting Securely..." : "Book Now"}
                          </button>
                          
                          <div className="mt-8 flex flex-col items-center gap-3">
                            <div className="flex items-center gap-4 opacity-40 grayscale hover:grayscale-0 transition-all">
                               <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-5 brightness-200" />
                            </div>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.25em] text-center leading-loose">
                              Funds Secured in Escrow Vault<br/>
                              Locked until Review Completed
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-20 text-center opacity-20">
                          <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <p className="text-[10px] uppercase font-black tracking-widest leading-loose">Complete steps above<br/>to calculate totals</p>
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
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center text-xl shadow-xl border border-indigo-500/30">📜</div>
                  <h3 className="text-3xl font-black text-white tracking-tighter">
                    Terms of <span className="gradient-text-accent">Platform</span>
                  </h3>
                </div>
                <div className="space-y-6">
                  <div className="p-8 bg-slate-950/60 rounded-[2rem] border border-slate-800 shadow-2xl">
                    <strong className="text-white text-lg block mb-3 uppercase tracking-tighter">1. The Escrow Vault System</strong>
                    <p className="text-slate-400 leading-relaxed font-medium">To ensure 100% security for players, your funds are held by CoachMatching&apos;s secure vault. Coaches only receive payment once they have uploaded your custom VOD breakdown. If no video is delivered, your funds are returned.</p>
                  </div>
                  <div className="p-8 bg-rose-950/10 rounded-[2rem] border border-rose-900/30 shadow-2xl">
                    <strong className="text-rose-400 text-lg block mb-3 uppercase tracking-tighter">2. Off-Platform Protection</strong>
                    <p className="text-rose-300/60 leading-relaxed font-medium">Attempting to book coaching sessions outside of CoachMatching is strictly prohibited. This is for your own safety; sessions outside our portal are not protected by our escrow guarantee and will result in immediate permanent account suspension.</p>
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
          className="text-lg font-black tracking-tighter gradient-text cursor-pointer"
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
          COACH_MATCHING
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
                  My VODs
                </NavBtn>
              </>
            )}
            {currentUser.role === "coach" && (
              <NavBtn
                active={view === "dashboard"}
                onClick={() => switchView("dashboard")}
                accent="emerald"
              >
                Coach Hub
              </NavBtn>
            )}
            {currentUser.role === "admin" && (
              <NavBtn
                active={view === "admin"}
                onClick={() => switchView("admin")}
                accent="rose"
              >
                Disputes
              </NavBtn>
            )}
          </div>

          <div className="h-5 w-px bg-slate-700/50" />

          {currentUser.isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg bg-gradient-to-br ${
                    currentUser.role === "coach"
                      ? "from-emerald-500 to-teal-600"
                      : currentUser.role === "admin"
                        ? "from-rose-500 to-pink-600"
                        : "from-indigo-500 to-violet-600"
                  } flex items-center justify-center text-white font-bold text-xs`}
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[11px] text-slate-400 font-medium max-w-[100px] truncate">
                  {currentUser.name}
                </span>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="bg-slate-800/70 border border-slate-700/50 text-[11px] font-medium px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/70 transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-[11px] font-semibold px-4 py-2 rounded-lg text-white transition-all shadow-lg shadow-indigo-600/20"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          id="mobile-menu-toggle"
          className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800/60 text-slate-400 hover:text-white transition-colors"
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
        <div className="md:hidden fixed inset-0 top-[68px] bg-slate-950/98 backdrop-blur-xl z-30 p-6 anim-fade-in-down">
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
                  className="text-left text-slate-300 hover:text-white transition-colors"
                >
                  My VODs
                </button>
              </>
            )}
            {currentUser.role === "coach" && (
              <button
                onClick={() => switchView("dashboard")}
                className="text-left text-emerald-400"
              >
                Coach Hub
              </button>
            )}
            {currentUser.role === "admin" && (
              <button
                onClick={() => switchView("admin")}
                className="text-left text-rose-400"
              >
                Admin
              </button>
            )}

            <hr className="border-slate-800/50 my-2" />
            {currentUser.isAuthenticated ? (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg bg-gradient-to-br ${
                      currentUser.role === "coach"
                        ? "from-emerald-500 to-teal-600"
                        : "from-indigo-500 to-violet-600"
                    } flex items-center justify-center text-white font-bold text-sm`}
                  >
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {currentUser.role}
                    </p>
                  </div>
                </div>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="text-left text-sm text-slate-400 hover:text-rose-400 transition-colors"
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
                  className="text-left text-slate-300 hover:text-white transition-colors"
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
        {/* ── VIEW 1: DISCOVERY ── */}
        {view === "discovery" && currentUser.role === "player" && (
          <section className="anim-fade-in-up">
            {/* Hero Section */}
            <div className="pt-12 md:pt-24 pb-16 relative z-20 overflow-hidden md:overflow-visible">
              <div className="absolute top-1/2 left-1/4 w-[70vw] md:w-[60vw] h-[70vw] md:h-[60vw] bg-emerald-600/[0.04] blur-[100px] rounded-full -translate-y-1/2 -z-10 animate-pulse pointer-events-none" />
              <div className="absolute top-1/4 right-1/4 w-[50vw] md:w-[40vw] h-[50vw] md:h-[40vw] bg-cyan-600/[0.03] blur-[120px] rounded-full -translate-y-1/2 -z-10 pointer-events-none" />
              
              <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter mb-6 text-white leading-[1.05] drop-shadow-2xl">
                Elevate Your <br className="hidden md:block"/> <span className="gradient-text-accent">Game.</span>
              </h1>
              <p className="text-slate-400 text-lg md:text-xl font-medium max-w-2xl leading-relaxed mb-12 drop-shadow-sm">
                Book 1-on-1 video breakdown and tactical review with verified professional players, college athletes, and elite coaches.
              </p>
              
              {/* Search & Filter Bar */}
              <div className="flex flex-col md:flex-row gap-4 items-center w-full max-w-3xl glass-card p-3 shadow-2xl">
                <div className="relative w-full group">
                  <input
                    id="coach-search"
                    type="text"
                    placeholder="Search coaches, styles, or roles..."
                    className="w-full pl-12 pr-4 py-4 bg-transparent outline-none text-white placeholder:text-slate-500 font-semibold text-lg transition-all"
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-focus-within:text-emerald-400 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                  </div>
                </div>

                <div className="h-10 w-px bg-slate-800 hidden md:block" />

                <div className="relative w-full md:w-auto md:min-w-[200px] shrink-0">
                  <button
                    id="filter-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFilterOpen(!isFilterOpen);
                    }}
                    className="w-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 px-5 py-4 rounded-xl font-bold text-[15px] flex justify-between items-center gap-3 text-slate-200 transition-all duration-300 hover:shadow-lg"
                  >
                  {activeFilter}
                  <span
                    className="text-xs transition-transform duration-200"
                    style={{
                      transform: isFilterOpen ? "rotate(180deg)" : "none",
                    }}
                  >
                    ▼
                  </span>
                </button>
                {isFilterOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-xl border border-slate-600/50 rounded-xl shadow-2xl shadow-black/30 overflow-hidden z-50 anim-fade-in-down">
                    {[
                      "All Roles",
                      "Striker",
                      "Midfield",
                      "Defense",
                      "Tactical",
                    ].map((role) => (
                      <button
                        key={role}
                        onClick={() => {
                          setActiveFilter(role);
                          setIsFilterOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm font-medium border-b border-slate-700/30 last:border-0 transition-colors duration-150 ${
                          activeFilter === role
                            ? "bg-indigo-600/15 text-indigo-400"
                            : "hover:bg-slate-700/50 text-slate-300"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coach Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-5 relative z-10 stagger-children">
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
              <div className="text-center py-20 anim-fade-in">
                <p className="text-6xl mb-6">🏟️</p>
                <h3 className="text-xl font-bold text-white mb-3">No Coaches Yet</h3>
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                  Be the first to join CoachMatching! Sign up as a coach to start offering your expertise to players worldwide.
                </p>
                {!currentUser.isAuthenticated && (
                  <Link
                    href="/signup"
                    className="inline-block mt-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300"
                  >
                    Sign Up as a Coach →
                  </Link>
                )}
              </div>
            )}

            {filteredCoaches.length === 0 && allCoaches.length > 0 && (
              <div className="text-center py-20 anim-fade-in">
                <p className="text-slate-500 text-lg font-medium">
                  No coaches found matching your criteria.
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setActiveFilter("All Roles");
                  }}
                  className="mt-3 text-indigo-400 text-sm hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── VIEW 2: VOD PORTAL ── */}
        {view === "session" && currentUser.role === "player" && (
          <div className="space-y-6 anim-fade-in-up">
            <h2 className="text-2xl font-extrabold tracking-tight mb-8">
              My <span className="gradient-text">Booked Sessions</span>
            </h2>
            
            {bookingMessage && (
              <div className={`p-4 rounded-xl mb-6 text-sm font-semibold border ${
                bookingMessage.type === "error" 
                  ? "bg-rose-950/40 text-rose-400 border-rose-900/50" 
                  : "bg-emerald-950/40 text-emerald-400 border-emerald-900/50"
              }`}>
                {bookingMessage.text}
              </div>
            )}
            
            {realBookings.map((b: Booking) => (
              <div key={b.id} className="glass-card p-6 md:p-8 relative hover:transform-none">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  
                  {/* Left: Info */}
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      Session with Coach {b.coach?.full_name || "Unknown"}
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">
                      {new Date(b.session_date).toLocaleDateString()} at {b.session_time}
                    </p>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                        b.status === "pending" || b.status === "confirmed" ? "bg-amber-950/30 text-amber-500 border-amber-900/50" :
                        b.status === "vod_submitted" ? "bg-indigo-950/30 text-indigo-400 border-indigo-900/50" :
                        b.status === "reviewed" ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/50" :
                        "bg-slate-900 text-slate-400 border-slate-700"
                      }`}>
                        {b.status === "pending" ? "Awaiting Checkout" : 
                         b.status === "confirmed" ? "Awaiting VOD Upload" :
                         b.status === "vod_submitted" ? "Coach is Reviewing" :
                         b.status === "reviewed" ? "Review Ready" : 
                         "Completed"}
                      </span>
                      
                      <span className="font-mono text-emerald-400 font-bold">${b.total}</span>
                    </div>
                  </div>
                  
                  {/* Right: Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 md:w-1/3">
                    {/* Upload VOD (If booking confirmed but no VOD yet) */}
                    {(b.status === "confirmed" || (b.status === "vod_submitted" && !b.vod_url)) && (
                      <div className="w-full">
                        <label className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all cursor-pointer border border-dashed ${
                          uploadingVod === b.id 
                            ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/50" 
                            : "bg-slate-900/50 text-indigo-400 border-indigo-500/30 hover:bg-slate-800 hover:border-indigo-400"
                        }`}>
                          {uploadingVod === b.id ? "Uploading..." : "Upload MP4 Match Footage"}
                          <input 
                            type="file" 
                            accept="video/mp4,video/x-m4v,video/*" 
                            className="hidden" 
                            disabled={uploadingVod === b.id}
                            onChange={(e) => handleVodUpload(e, b.id)}
                          />
                        </label>
                      </div>
                    )}
                    
                    {/* View VOD (If URL exists) */}
                    {b.vod_url && (
                      <a href={b.vod_url} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 text-white rounded-xl font-semibold text-sm hover:bg-slate-700 transition-colors border border-slate-700">
                        ▶ Watch VOD
                      </a>
                    )}
                    
                    {/* Release Funds (Only if reviewed or actually wanted by player) */}
                    {(b.status === "reviewed" || b.status === "vod_submitted" || b.status === "confirmed") && (
                      <button 
                        onClick={() => handleReleaseFunds(b.id)}
                        disabled={releasingFunds === b.id}
                        className="flex-1 py-3 px-4 bg-emerald-600/10 text-emerald-500 border border-emerald-500/30 rounded-xl font-semibold text-sm hover:bg-emerald-600/20 transition-all disabled:opacity-50"
                      >
                        {releasingFunds === b.id ? "Releasing..." : "Release Funds"}
                      </button>
                    )}
                  </div>
                  
                </div>
              </div>
            ))}
            
            {realBookings.length === 0 && (
              <div className="text-center py-20 glass-card">
                <p className="text-slate-400 mb-4">You haven&apos;t booked any sessions yet.</p>
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
                    <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-xl shrink-0">⚠️</div>
                    <div>
                      <p className="font-black text-lg tracking-tight text-white mb-1">Financial Link Missing</p>
                      <p className="text-xs font-medium text-slate-400 leading-relaxed max-w-xl">
                        You must complete your Stripe onboarding to receive session payouts. Your profile is currently hidden from players until this connection is verified.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button
                      onClick={refreshStripeStatus}
                      disabled={isSyncingStripe}
                      className="flex-1 md:flex-none bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSyncingStripe ? <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Refresh Status"}
                    </button>
                    <button
                      onClick={() => createStripeConnectAccount().then(res => res?.url && (window.location.href = res.url))}
                      className="flex-1 md:flex-none bg-white text-black hover:bg-slate-200 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl"
                    >
                      Complete Setup
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
               <div>
                  <h2 className="text-4xl font-black tracking-tighter text-white mb-2">
                    COACH <span className="text-emerald-500">TERMINAL</span>
                  </h2>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
                    Mission Control & Performance Tracking
                  </p>
               </div>
               <div className="flex gap-4">
                  <div className="glass-card px-6 py-3 border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Career Revenue</p>
                    <p className="text-xl font-black text-white font-mono">
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
                    <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">Edit Lab</span>
                    <svg className="w-3 h-3 text-indigo-400 group-hover/edit:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </Link>
               </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              {[
                {
                  label: "Escrow Locked",
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
                  color: "text-emerald-400",
                },
                {
                  label: "Deployments",
                  val: realBookings.length.toString(),
                  color: "text-white",
                },
                {
                  label: "Network Fee",
                  val: `$${realBookings
                    .filter((b: Booking) => b.payout_id)
                    .reduce((sum, b: Booking) => sum + Number(b.amount || 0) * PLATFORM_CUT, 0)
                    .toFixed(2)}`,
                  color: "text-slate-500",
                },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-6">
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">{stat.label}</p>
                  <p className={`text-2xl font-black font-mono tracking-tighter ${stat.color}`}>{stat.val}</p>
                </div>
              ))}
            </div>

            {/* Action Queue */}
            <div>
              <h3 className="text-sm font-black mb-6 text-slate-400 flex items-center gap-3 uppercase tracking-[0.2em]">
                <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)] animate-pulse" />
                Critical Actions
              </h3>
              {realBookings.filter((b: Booking) => b.status === 'completed' && !b.vod_url).length > 0 ? (
                <div className="grid gap-4">
                  {realBookings.filter((b: Booking) => b.status === 'completed' && !b.vod_url).map((booking: Booking) => (
                    <div key={booking.id} className="glass-card overflow-hidden group/action relative border-l-4 border-l-orange-500">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/[0.03] to-transparent pointer-events-none" />
                      <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between md:items-center gap-6">
                        <div className="flex items-center gap-6">
                           <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-orange-500 text-xl font-black shadow-2xl">
                             {booking.player_name?.charAt(0) || "P"}
                           </div>
                           <div>
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-lg font-black text-white tracking-tight">{booking.player_name || "Premium Athlete"}</h4>
                                <span className="text-[9px] bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-full border border-orange-500/30 font-black uppercase tracking-widest">Awaiting VOD</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <p className="text-xs text-slate-500 font-bold font-mono tracking-tighter opacity-80">{booking.player_email}</p>
                                <span className="w-1 h-1 rounded-full bg-slate-800" />
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Session: {new Date(booking.session_date).toLocaleDateString()}</p>
                              </div>
                           </div>
                        </div>
                        <label className="cursor-pointer bg-white text-black hover:bg-slate-200 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_15px_30px_rgba(255,255,255,0.1)] hover:-translate-y-1 active:translate-y-0 shrink-0 text-center">
                          {uploadingVod === booking.id ? "Syncing..." : "Upload Breakdown"}
                          <input
                            type="file"
                            className="hidden"
                            accept="video/*"
                            disabled={!!uploadingVod}
                            onChange={(e) => handleVodUpload(e, booking.id)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card p-12 text-center border-dashed border-slate-800 bg-slate-900/10 container-blur">
                  <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-800 shadow-2xl">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest">No pending operations. System optimal.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VIEW 4: ADMIN CONSOLE ── */}
        {view === "admin" && currentUser.role === "admin" && (
          <div className="anim-fade-in-up space-y-16">
            <div>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter text-white mb-2">
                    COMMAND <span className="gradient-text">CENTER</span>
                  </h2>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] opacity-80">
                    Platform Governance & System Oversight
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  {
                    label: "Network Capacity",
                    val: adminCoaches.length.toString(),
                    color: "text-indigo-400",
                    unit: "COACHES",
                    desc: "Registered Personnel"
                  },
                  {
                    label: "Active Nodes",
                    val: adminCoaches.filter((c: AdminCoach) => !c.banned).length.toString(),
                    color: "text-emerald-400",
                    unit: "OPERATIONAL",
                    desc: "Live in Marketplace"
                  },
                  {
                    label: "Restricted",
                    val: adminCoaches.filter((c: AdminCoach) => c.banned).length.toString(),
                    color: "text-rose-400",
                    unit: "OFFLINE",
                    desc: "Policy Violations"
                  },
                  {
                    label: "Economic Link",
                    val: adminCoaches.filter((c: AdminCoach) => c.stripeConnected).length.toString(),
                    color: "text-white",
                    unit: "STRIPE",
                    desc: "Payout Integrated"
                  },
                ].map((stat, i) => (
                  <div key={i} className="glass-card p-6 relative overflow-hidden group/stat">
                    <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl rounded-full -mr-12 -mt-12 opacity-10 transition-all group-hover/stat:opacity-20 ${stat.color === 'text-indigo-400' ? 'bg-indigo-500' : stat.color === 'text-emerald-400' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mb-4">
                      {stat.label}
                    </p>
                    <div className="flex items-baseline gap-2 mb-1">
                       <span className={`text-4xl font-black font-mono tracking-tighter ${stat.color}`}>{stat.val}</span>
                       <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{stat.unit}</span>
                    </div>
                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-2">{stat.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Coach Roster ── */}
            <div>
              <h3 className="text-sm font-black mb-8 text-slate-400 flex items-center gap-4 uppercase tracking-[0.3em]">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500/30 border border-indigo-500 flex items-center justify-center p-0.5">
                   <span className="w-full h-full rounded-full bg-indigo-500" />
                </span>
                Personnel Registry
              </h3>
              
              {adminLoading ? (
                <div className="glass-card p-24 text-center">
                  <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6" />
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Accessing Secure Database...</p>
                </div>
              ) : adminCoaches.length === 0 ? (
                <div className="glass-card p-20 text-center border-dashed border-slate-800">
                  <p className="text-5xl mb-6 opacity-30">🏟️</p>
                  <p className="text-slate-400 font-black uppercase tracking-widest mb-2">Zero Personnel Found</p>
                  <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Platform is currently in pre-operational state.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {adminCoaches.map((coach: AdminCoach) => (
                    <div
                      key={coach.id}
                      className={`glass-card overflow-hidden transition-all duration-500 group/personnel ${coach.banned ? "opacity-60 border-rose-900/40 bg-rose-500/[0.01]" : "hover:border-indigo-500/30"}`}
                    >
                      <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                           <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${coach.gradient} flex items-center justify-center text-white font-black text-xl shadow-2xl relative z-10 border border-white/10 ${coach.banned ? "grayscale" : ""}`}>
                             {coach.avatar}
                           </div>
                           <div>
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h4 className="text-xl font-black text-white tracking-tighter">
                                  {coach.name}
                                </h4>
                                <div className="flex gap-2">
                                  {coach.banned ? (
                                    <span className="text-[9px] bg-rose-500/10 text-rose-400 px-3 py-1 rounded-lg border border-rose-500/20 font-black tracking-widest">DENIED</span>
                                  ) : (
                                    <>
                                      {coach.verified ? (
                                        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-500/20 font-black tracking-widest leading-none flex items-center">✓ VERIFIED</span>
                                      ) : (
                                        <span className="text-[9px] bg-slate-800 text-slate-500 px-3 py-1 rounded-lg border border-slate-700/50 font-black tracking-widest leading-none flex items-center">PENDING</span>
                                      )}
                                      {coach.stripeConnected && (
                                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/20 font-black tracking-widest leading-none flex items-center">CREDENTIALED</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><Stars rating={coach.rating} /> {coach.rating}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-800" />
                                <span>${coach.rate}/SESSION</span>
                                <span className="w-1 h-1 rounded-full bg-slate-800" />
                                <span className="text-slate-600 lowercase font-mono">{coach.email}</span>
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
                              className="bg-emerald-500 text-black hover:bg-emerald-400 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl disabled:opacity-50"
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
                              className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-rose-500/30 hover:border-transparent disabled:opacity-50"
                            >
                              {banningCoach === coach.id ? "TERMINATING..." : "REVOKE ACCESS"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ═══════════════
          FOOTER
          ═══════════════ */}
      <footer className="mt-24 py-8 border-t border-slate-800/30 text-center px-4 relative z-10">
        <p className="text-[11px] text-slate-500 max-w-2xl mx-auto leading-loose">
          By using CoachMatching, you agree to our{" "}
          <button
            id="tos-link"
            onClick={() => setActiveModal("tos")}
            className="text-slate-400 hover:text-indigo-400 underline underline-offset-4 decoration-slate-700 hover:decoration-indigo-500/50 transition-colors mx-1"
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
  accent = "indigo",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: "indigo" | "emerald" | "rose";
}) {
  const colors = {
    indigo: active
      ? "text-indigo-400 bg-indigo-500/10"
      : "text-slate-400 hover:text-white hover:bg-slate-800/60",
    emerald: active
      ? "text-emerald-400 bg-emerald-500/10"
      : "text-slate-400 hover:text-white hover:bg-slate-800/60",
    rose: active
      ? "text-rose-400 bg-rose-500/10"
      : "text-slate-400 hover:text-white hover:bg-slate-800/60",
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${colors[accent]}`}
    >
      {children}
    </button>
  );
}
