"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import { getCoaches, getMyCoachProfile, getAllCoachesAdmin, banCoach, unbanCoach } from "@/app/actions/coaches";
import { createBooking, getCoachBookings, getMyBookings, updateBookingStatus } from "@/app/actions/bookings";
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
function StatBar({
  label,
  value,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  color: string;
  delay?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="mb-4 group cursor-default">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-400 uppercase tracking-widest font-medium text-[10px]">
          {label}
        </span>
        <span
          className={`font-mono font-bold text-sm transition-all duration-300 group-hover:scale-110 origin-right ${color.replace("bg-", "text-")}`}
        >
          {value}
        </span>
      </div>
      <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden ring-1 ring-slate-700/50">
        <div
          className={`h-full ${color} rounded-full transition-all duration-1000`}
          style={{
            width: mounted ? `${value}%` : "0%",
            transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
    </div>
  );
}

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
      className="glass-card p-6 flex flex-col justify-between group"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div>
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${coach.gradient} flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
          >
            {coach.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-base font-bold text-white truncate">
                {coach.name}
              </h3>
              {coach.verified && (
                <span className="shrink-0 text-[9px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/25 font-semibold tracking-wide">
                  ✓ VERIFIED
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Stars rating={coach.rating} />
              <span className="text-xs text-slate-400 font-medium tracking-wide">
                {coach.rating}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 font-medium">
                {coach.reviews} reviews
              </span>
            </div>
            {coach.experience && (
              <div className="mt-2 text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                {coach.experience}
              </div>
            )}
          </div>
          <span className="text-xl font-extrabold text-white shrink-0">
            ${coach.rate}
            <span className="text-[10px] text-slate-500 font-normal">/hr</span>
          </span>
        </div>

        {/* Tags */}
        <div className="flex gap-2 mb-3">
          <span className="bg-slate-800/80 text-slate-300 text-[10px] px-2.5 py-1 rounded-lg font-semibold uppercase tracking-wider">
            {coach.role}
          </span>
          <span className="text-indigo-400/80 text-[11px] font-mono font-medium bg-indigo-500/5 px-2 py-1 rounded-lg">
            {coach.style}
          </span>
        </div>

        {/* Bio */}
        <p className="text-sm text-slate-400 leading-relaxed mb-5 line-clamp-3">
          {coach.bio}
        </p>

        {coach.availability && coach.availability.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {coach.availability.map((day, i) => (
              <span
                key={i}
                className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-mono"
              >
                {day}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        id={`book-coach-${coach.id}`}
        onClick={() => onBook(coach)}
        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 bg-slate-800/60 text-slate-300 border border-slate-700/50 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 group-hover:shadow-lg group-hover:shadow-indigo-600/20 active:scale-[0.97]"
      >
        Check Availability
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
  const [authLoading, setAuthLoading] = useState(true);

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
  const [realBookings, setRealBookings] = useState<Record<string, unknown>[]>(
    [],
  );

  /* ── Coach Context ── */
  const [stripeOnboarded, setStripeOnboarded] = useState<boolean | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);

  /* ── Detect Stripe Setup Success ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") === "success" && currentUser.role === "coach") {
      getMyCoachProfile().then((profile: any) => {
        if (profile) setStripeOnboarded(profile.stripe_onboarding_complete);
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
      setAdminLoading(true);
      getAllCoachesAdmin().then((coaches) => {
        setAdminCoaches(coaches as unknown as AdminCoach[]);
        setAdminLoading(false);
      });
    }
  }, [currentUser.role, currentUser.isAuthenticated]);

  /* ── Fetch Coach Bookings & Details (for coach dashboard) ── */
  useEffect(() => {
    if (currentUser.role === "coach" && currentUser.isAuthenticated) {
      getCoachBookings().then((bookings: Record<string, unknown>[]) => {
        setRealBookings(bookings);
      });
      getMyCoachProfile().then((profile: any) => {
        if (profile) {
          setStripeOnboarded(profile.stripe_onboarding_complete);
        }
      });
    } else if (currentUser.role === "player" && currentUser.isAuthenticated) {
      getMyBookings().then((bookings: Record<string, unknown>[]) => {
        setRealBookings(bookings);
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
          onClick={closeModal}
        >
          <div
            className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700/60 p-7 md:p-8 rounded-2xl max-w-md w-full shadow-2xl shadow-black/40 relative anim-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              id="modal-close"
              onClick={closeModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm"
            >
              ✕
            </button>

            {/* Schedule Modal */}
            {activeModal === "schedule" && selectedCoach && (
              <div className="anim-fade-in">
                <div className="flex gap-4 mb-6">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${selectedCoach.gradient} flex items-center justify-center text-white font-black text-2xl shadow-lg shrink-0`}
                  >
                    {selectedCoach.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-white">
                        {selectedCoach.name}
                      </h2>
                      {selectedCoach.verified && (
                        <span className="text-[9px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/25 font-semibold shrink-0">
                          ✓ VERIFIED
                        </span>
                      )}
                    </div>

                    {selectedCoach.experience && (
                      <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-2">
                        {selectedCoach.experience}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Stars rating={selectedCoach.rating} />
                      <span className="font-medium text-white">
                        {selectedCoach.rating}
                      </span>
                      <span>({selectedCoach.reviews} reviews)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-6">
                  <span className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
                    {selectedCoach.role}
                  </span>
                  <span className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
                    {selectedCoach.style}
                  </span>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed mb-6 bg-slate-900/40 p-4 rounded-xl border border-slate-800/60">
                  {selectedCoach.bio}
                </p>

                {selectedCoach.availability &&
                  selectedCoach.availability.length > 0 && (
                    <div className="mb-6">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">
                        Standard Availability
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedCoach.availability.map((day, i) => (
                          <span
                            key={i}
                            className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700 font-mono"
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {selectedCoach.highlightUrl && (
                  <div className="mb-6">
                    <a
                      href={selectedCoach.highlightUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-red-600/10 border border-red-500/30 text-red-500 hover:bg-red-600/20 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    >
                      <span>▶</span> Watch Highlight Reel
                    </a>
                  </div>
                )}

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1.5 mb-5 text-center text-sm">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div
                      key={`day-${i}`}
                      className="text-slate-500 font-semibold text-xs py-1"
                    >
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: 14 }).map((_, i) => {
                    const date = i + 10;
                    const isSelected = selectedDate === date;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(date)}
                        className={`p-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105"
                            : "hover:bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {date}
                      </button>
                    );
                  })}
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div className="grid grid-cols-3 gap-2.5 mb-7 anim-fade-in-up">
                    {["10:00 AM", "2:00 PM", "6:30 PM"].map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                          selectedTime === time
                            ? "bg-indigo-500/15 border-indigo-500 text-indigo-400 shadow-inner"
                            : "border-slate-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  id="continue-to-escrow"
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setActiveModal("checkout")}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed py-3.5 rounded-xl font-bold text-sm transition-all duration-300 shadow-lg shadow-indigo-600/20 disabled:shadow-none active:scale-[0.97]"
                >
                  Continue to Escrow →
                </button>
              </div>
            )}

            {/* Checkout Modal */}
            {activeModal === "checkout" && selectedCoach && (
              <div className="anim-fade-in">
                <h3 className="text-lg font-bold mb-4">Secure Checkout</h3>
                <div className="bg-slate-800/40 p-4 rounded-xl mb-5 text-sm border border-slate-700/40 space-y-1.5">
                  <p className="text-slate-300">
                    Coach:{" "}
                    <strong className="text-white">{selectedCoach.name}</strong>
                  </p>
                  <p className="text-slate-300">
                    Time:{" "}
                    <strong className="text-white">
                      Oct {selectedDate} at {selectedTime}
                    </strong>
                  </p>
                </div>

                <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/60 mb-6 font-mono text-sm space-y-3">
                  <div className="flex justify-between text-slate-300">
                    <span>Session Rate</span>
                    <span className="text-white font-medium">
                      ${selectedCoach.rate}.00
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Platform Fee</span>
                    <span>
                      ${(selectedCoach.rate * PLATFORM_CUT).toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t border-slate-800 pt-3 flex justify-between font-bold text-lg">
                    <span className="text-slate-200">Total Escrow</span>
                    <span className="text-emerald-400">
                      ${selectedCoach.rate}.00
                    </span>
                  </div>
                </div>

                {bookingMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs mb-4 border anim-fade-in ${
                      bookingMessage.type === "success"
                        ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-400"
                        : "bg-rose-950/30 border-rose-900/40 text-rose-400"
                    }`}
                  >
                    {bookingMessage.text}
                  </div>
                )}
                <button
                  id="pay-stripe"
                  disabled={bookingLoading || !currentUser.isAuthenticated}
                  onClick={async () => {
                    if (!currentUser.isAuthenticated) {
                      setBookingMessage({
                        type: "error",
                        text: "Please sign in to book a session.",
                      });
                      return;
                    }
                    setBookingLoading(true);
                    setBookingMessage(null);
                    
                    if (typeof selectedCoach.id === "number") {
                      setBookingMessage({
                        type: "error",
                        text: "These are just mock profiles! Scroll down or search for the REAL coach account you just created to test booking.",
                      });
                      setBookingLoading(false);
                      return;
                    }

                    const formData = new FormData();
                    formData.set("coachId", String(selectedCoach.id));
                    formData.set(
                      "sessionDate",
                      `2025-10-${String(selectedDate).padStart(2, "0")}`,
                    );
                    formData.set("sessionTime", selectedTime || "10:00 AM");
                    formData.set("rate", String(selectedCoach.rate));
                    const result = await createBooking(formData);
                    if (result.error) {
                      setBookingMessage({ type: "error", text: result.error });
                      setBookingLoading(false);
                    } else if (result.url) {
                      // Redirect to Stripe Checkout
                      window.location.href = result.url;
                    } else {
                      setBookingMessage({
                        type: "error",
                        text: "Stripe error: No checkout URL returned.",
                      });
                      setBookingLoading(false);
                    }
                  }}
                  className="glow-btn w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/25 relative z-10 active:scale-[0.97]"
                >
                  {bookingLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Redirecting to Stripe...
                    </span>
                  ) : !currentUser.isAuthenticated ? (
                    "Sign In to Book"
                  ) : (
                    "Pay via Stripe →"
                  )}
                </button>
              </div>
            )}

            {/* TOS Modal */}
            {activeModal === "tos" && (
              <div className="anim-fade-in">
                <h3 className="text-lg font-bold mb-5 gradient-text inline-block">
                  Terms of Service
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/50 text-slate-300">
                    <strong className="text-white">1. Escrow Vault:</strong>{" "}
                    Funds held until review completion.
                  </p>
                  <p className="p-4 bg-rose-950/20 text-rose-200 rounded-xl border border-rose-900/30">
                    <strong>2. Anti-Circumvention:</strong> Off-platform
                    payments = IP ban.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════
          NAVIGATION
          ═══════════════ */}
      <nav className="max-w-6xl mx-auto flex justify-between items-center bg-slate-900/60 backdrop-blur-2xl p-4 md:px-6 md:rounded-2xl border-b md:border border-slate-800/50 sticky top-0 md:top-4 z-40 md:mt-4">
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
            {/* Search Bar */}
            <div className="mb-10 flex flex-col md:flex-row gap-4 items-end relative z-20">
              <div className="w-full max-w-md">
                <h2 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">
                  Hire a <span className="gradient-text">Pro</span>
                </h2>
                <div className="relative group">
                  <input
                    id="coach-search"
                    type="text"
                    placeholder="Search coaches, styles, or roles..."
                    className="w-full p-4 bg-slate-900/60 border border-slate-700/50 rounded-xl focus:ring-2 ring-indigo-500/50 outline-none text-white shadow-lg placeholder:text-slate-500 transition-all duration-300 focus:bg-slate-900/80 focus:border-indigo-500/30"
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    🔍
                  </div>
                </div>
              </div>

              {/* Filter Dropdown */}
              <div className="relative w-full md:w-auto">
                <button
                  id="filter-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterOpen(!isFilterOpen);
                  }}
                  className="w-full bg-slate-900/60 border border-slate-700/50 px-5 py-4 rounded-xl font-semibold text-sm flex justify-between items-center gap-3 hover:bg-slate-800/80 text-slate-300 transition-all duration-200"
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
            
            {realBookings.map((b: any) => (
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
                    {(b.status === "reviewed" || b.status === "vod_submitted" || b.status === "confirmed") && b.status !== "completed" && (
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
                <p className="text-slate-400 mb-4">You haven't booked any sessions yet.</p>
                <button onClick={() => setView("discovery")} className="text-indigo-400 font-semibold hover:text-indigo-300">
                  Find a Coach →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── VIEW 3: COACH DASHBOARD ── */}
        {view === "dashboard" && currentUser.role === "coach" && (
          <div className="anim-fade-in-up">
            <div className="flex items-center gap-3 mb-7">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Welcome back,{" "}
                <span className="gradient-text">Coach {currentUser.name}</span>
              </h2>
              <span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-500/20 font-semibold shrink-0">
                ✓ VERIFIED
              </span>
              <Link
                href="/coach/edit"
                className="ml-auto bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold px-4 py-2 rounded-xl hover:bg-emerald-600/25 transition-all"
              >
                Edit My Profile
              </Link>
            </div>

            {/* Stripe Connect Banner (Show if not true) */}
            {stripeOnboarded !== true && (
              <div className="glass-card bg-indigo-950/40 border-indigo-500/30 p-5 md:p-8 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 anim-fade-in-up shadow-lg shadow-indigo-600/10">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                    Connect your bank account
                  </h3>
                  <p className="text-slate-400 text-sm max-w-lg">
                    To receive payouts from your coaching sessions, you need to
                    securely connect a bank account via Stripe Connect.
                  </p>
                </div>
                <button
                  disabled={connectingStripe}
                  onClick={async () => {
                    setConnectingStripe(true);
                    const res = await createStripeConnectAccount();
                    if (res?.url) {
                      window.location.href = res.url;
                    } else {
                      alert(res?.error || "Failed to connect to Stripe.");
                      setConnectingStripe(false);
                    }
                  }}
                  className="shrink-0 bg-white text-black hover:bg-slate-200 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-[0.97]"
                >
                  {connectingStripe ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-slate-400/30 border-t-black animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    "Setup Payouts →"
                  )}
                </button>
              </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 stagger-children">
              {[
                {
                  label: "Escrow Pending",
                  val: `$${realBookings
                    .filter((b) => b.status === "completed" && !b.payout_id)
                    .reduce((sum, b) => sum + Number(b.amount || 0), 0)
                    .toFixed(2)}`,
                  color: "text-orange-400",
                  icon: "🔒",
                },
                {
                  label: "Total Earned",
                  val: `$${realBookings
                    .filter((b) => b.payout_id)
                    .reduce((sum, b) => sum + Number(b.amount || 0) * (1 - PLATFORM_CUT), 0)
                    .toFixed(2)}`,
                  color: "text-emerald-400",
                  icon: "💰",
                },
                {
                  label: "Total Sessions",
                  val: realBookings.length.toString(),
                  color: "text-white",
                  icon: "📹",
                },
                {
                  label: "Platform Fee Paid",
                  val: `$${realBookings
                    .filter((b) => b.payout_id)
                    .reduce((sum, b) => sum + Number(b.amount || 0) * PLATFORM_CUT, 0)
                    .toFixed(2)}`,
                  color: "text-slate-500",
                  icon: "📊",
                },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs">{stat.icon}</span>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                      {stat.label}
                    </p>
                  </div>
                  <p
                    className={`text-xl md:text-2xl font-mono font-extrabold ${stat.color}`}
                  >
                    {stat.val}
                  </p>
                </div>
              ))}
            </div>

            {/* Action Queue */}
            <h3 className="text-base font-bold mb-4 text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              Action Required
            </h3>
            {realBookings.filter(b => b.status === 'completed' && !b.vod_url).length > 0 ? (
              <div className="glass-card overflow-hidden hover:transform-none">
                {realBookings.filter(b => b.status === 'completed' && !b.vod_url).map((booking: any) => (
                  <div key={booking.id} className="p-5 md:p-6 flex flex-col md:flex-row justify-between md:items-center border-b border-slate-800/50 last:border-0 gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                        <p className="font-bold">{(booking.profiles as any)?.full_name || "Anonymous Player"}</p>
                      </div>
                      <p className="text-sm text-slate-400 ml-5">
                        Session on {new Date(booking.session_date).toLocaleDateString()}. Payment confirmed. Awaiting video review.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                       <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-emerald-900/20 active:scale-[0.97] shrink-0 text-white">
                        {uploadingVod === booking.id ? "Uploading..." : "Upload VOD Breakdown"}
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
              <div className="glass-card p-8 text-center bg-slate-900/20 border-dashed border-slate-800">
                <p className="text-slate-500 text-sm">No pending actions. You're all caught up!</p>
              </div>
            )}

            {/* ── My Orders & Players ── */}
            <h3 className="text-base font-bold mb-4 mt-10 text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              My Orders & Players
              <span className="text-[10px] bg-slate-800/80 text-slate-500 px-2 py-0.5 rounded-full font-mono ml-1">
                {realBookings.length}
              </span>
            </h3>
            {realBookings.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
                {realBookings.map((booking: any) => (
                  <div
                    key={booking.id}
                    className="glass-card p-5 md:p-6 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                    {/* Header */}
                    <div className="flex items-start gap-4 mb-4 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                        {(booking.profiles as any)?.full_name?.charAt(0) || "P"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">
                          {(booking.profiles as any)?.full_name || "Anonymous Player"}
                        </h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          Session Date: {new Date(booking.session_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Stats/Status */}
                    <div className="space-y-2 mt-4 relative z-10">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Status</span>
                        <span className={`font-bold ${
                          booking.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {booking.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Amount</span>
                        <span className="text-white font-mono">${booking.amount}</span>
                      </div>
                    </div>

                    {/* Action Payout */}
                    {!booking.payout_id && booking.status === 'completed' && booking.vod_url && (
                      <button
                        onClick={() => handleReleaseFunds(booking.id)}
                        disabled={!!releasingFunds}
                        className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                      >
                        {releasingFunds === booking.id ? "Processing..." : `Release $${(Number(booking.amount) * (1 - PLATFORM_CUT)).toFixed(2)}`}
                      </button>
                    )}
                    {booking.payout_id && (
                      <div className="w-full mt-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center py-2 rounded-xl text-[10px] font-bold">
                        ✓ FUNDS RELEASED
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-12 text-center bg-slate-900/10 border-dashed border-slate-800">
                <p className="text-4xl mb-4">🛒</p>
                <p className="text-slate-300 font-semibold mb-2">No players yet</p>
                <p className="text-slate-500 text-sm">When players book and pay for your sessions, they will appear here.</p>
              </div>
            )}
          </div>
        )}

        {/* ── VIEW 4: ADMIN CONSOLE ── */}
        {view === "admin" && currentUser.role === "admin" && (
          <div className="anim-fade-in-up space-y-10">
            {/* ── Admin Overview Metrics ── */}
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-7">
                Platform <span className="gradient-text">Admin</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
                {[
                  {
                    label: "Total Coaches",
                    val: adminCoaches.length.toString(),
                    color: "text-indigo-400",
                    icon: "⚽",
                  },
                  {
                    label: "Active",
                    val: adminCoaches.filter((c: AdminCoach) => !c.banned).length.toString(),
                    color: "text-emerald-400",
                    icon: "✓",
                  },
                  {
                    label: "Banned",
                    val: adminCoaches.filter((c: AdminCoach) => c.banned).length.toString(),
                    color: "text-rose-400",
                    icon: "🚫",
                  },
                  {
                    label: "Stripe Connected",
                    val: adminCoaches.filter((c: AdminCoach) => c.stripeConnected).length.toString(),
                    color: "text-white",
                    icon: "💳",
                  },
                ].map((stat, i) => (
                  <div key={i} className="glass-card p-4 md:p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs">{stat.icon}</span>
                      <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                        {stat.label}
                      </p>
                    </div>
                    <p
                      className={`text-xl md:text-2xl font-mono font-extrabold ${stat.color}`}
                    >
                      {stat.val}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Coach Roster ── */}
            <div>
              <h3 className="text-base font-bold mb-4 text-slate-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Coach Roster
              </h3>
              {adminLoading ? (
                <div className="glass-card p-12 text-center">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-slate-400 text-sm">Loading coaches...</p>
                </div>
              ) : adminCoaches.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <p className="text-4xl mb-4">🏟️</p>
                  <p className="text-slate-300 font-semibold mb-2">No coaches registered yet</p>
                  <p className="text-slate-500 text-sm">When coaches sign up and create their profiles, they will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4 stagger-children">
                  {adminCoaches.map((coach: AdminCoach) => (
                    <div
                      key={coach.id}
                      className={`glass-card overflow-hidden hover:transform-none transition-all duration-300 ${coach.banned ? "opacity-60 border-rose-900/40" : ""}`}
                    >
                      <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${coach.gradient} flex items-center justify-center text-white font-bold text-base shadow-lg shrink-0 ${coach.banned ? "grayscale" : ""}`}
                          >
                            {coach.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <h4 className="font-bold text-white">
                                {coach.name}
                              </h4>
                              {coach.banned ? (
                                <span className="text-[9px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/25 font-semibold">
                                  🚫 BANNED
                                </span>
                              ) : coach.verified ? (
                                <span className="text-[9px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/25 font-semibold">
                                  ✓ VERIFIED
                                </span>
                              ) : (
                                <span className="text-[9px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/25 font-semibold">
                                  UNVERIFIED
                                </span>
                              )}
                              {coach.stripeConnected && (
                                <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/25 font-semibold">
                                  💳 STRIPE
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <Stars rating={coach.rating} />
                              <span className="font-medium">{coach.rating}</span>
                              <span>·</span>
                              <span>${coach.rate}/session</span>
                              <span>·</span>
                              <span className="text-slate-600">{coach.email}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {coach.banned ? (
                            <button
                              onClick={async () => {
                                setBanningCoach(coach.id);
                                await unbanCoach(coach.id);
                                const updated = await getAllCoachesAdmin();
                                setAdminCoaches(updated as unknown as AdminCoach[]);
                                // Also refresh the public coaches list
                                const publicCoaches = await getCoaches();
                                setDbCoaches(publicCoaches as unknown as Coach[]);
                                setBanningCoach(null);
                              }}
                              disabled={banningCoach === coach.id}
                              className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] border border-emerald-500/25 disabled:opacity-50"
                            >
                              {banningCoach === coach.id ? "Unbanning..." : "Unban Coach"}
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                setBanningCoach(coach.id);
                                await banCoach(coach.id);
                                const updated = await getAllCoachesAdmin();
                                setAdminCoaches(updated as unknown as AdminCoach[]);
                                // Also refresh the public coaches list
                                const publicCoaches = await getCoaches();
                                setDbCoaches(publicCoaches as unknown as Coach[]);
                                setBanningCoach(null);
                              }}
                              disabled={banningCoach === coach.id}
                              className="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] border border-rose-500/25 disabled:opacity-50"
                            >
                              {banningCoach === coach.id ? "Banning..." : "Ban Coach"}
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
