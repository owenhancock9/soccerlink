"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/app/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import { getCoaches, getMyCoachProfile, getAllCoachesAdmin, banCoach, unbanCoach, type CoachProfileData } from "@/app/actions/coaches";
import { createBooking, getCoachBookings, getMyBookings, confirmSession, submitRating, getAllBookingsAdmin } from "@/app/actions/bookings";
import { createStripeConnectAccount } from "@/app/actions/stripe";
import { uploadVodForBooking } from "@/app/actions/upload";

/* ─── Constants ─── */
const PLATFORM_CUT = 0.13;

/* ─── Scheduling Helpers ─── */
interface AvailabilitySlot {
  day: string;
  start: string;
  end: string;
}

/* ─── Base Coach interface ─── */
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

/* ─── Admin Coach extends Coach ─── */
interface AdminCoach extends Coach {
  id: string;
  email: string;
  banned: boolean;
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

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Coach Card ─── */
function CoachCard({
  coach,
  index,
  onBook,
  onViewProfile,
}: {
  coach: Coach;
  index: number;
  onBook: (c: Coach) => void;
  onViewProfile: (c: Coach) => void;
}) {
  return (
    <div
      className="glass-card p-6 flex flex-col justify-between group cursor-pointer border border-[var(--border-default)] hover:border-[var(--accent)] bg-white rounded-lg transition-all duration-200"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => onViewProfile(coach)}
    >
      <div>
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-lg bg-gradient-to-br ${coach.gradient} flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden`}
            >
              {coach.avatarUrl ? (
                <Image src={coach.avatarUrl} alt={coach.name} width={48} height={48} className="w-full h-full object-cover" />
              ) : (
                coach.avatar
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-lg font-bold text-[var(--text-primary)] leading-tight">
                  {titleCase(coach.name)}
                </h3>
                {coach.verified && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-[var(--accent-subtle)] text-[var(--accent)] px-2 py-0.5 rounded border border-[var(--accent)]/20 font-bold uppercase tracking-wider">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                    Verified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Stars rating={coach.rating} />
                  <span className="text-[var(--text-primary)] font-semibold font-mono text-xs">
                    {coach.rating}
                  </span>
                </div>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  {coach.reviews} reviews
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xl font-bold text-[var(--text-primary)] font-mono">
              ${coach.rate}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mt-0.5">per session</span>
          </div>
        </div>

        {/* Location */}
        {coach.location && (
          <div className="flex items-center gap-1.5 mb-3 text-[var(--text-secondary)]">
            <span className="text-xs">📍</span>
            <span className="text-xs">{coach.location}</span>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-5">
          <span className="text-xs text-[var(--text-secondary)] px-2.5 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)] font-medium">
            {coach.role}
          </span>
          <span className="text-xs text-[var(--accent)] px-2.5 py-1 rounded bg-[var(--accent-subtle)] border border-[var(--accent)]/10 font-semibold">
            {coach.style}
          </span>
        </div>

        {/* Bio */}
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3 mb-5">
          {coach.bio || "Experienced coach available for sessions and video analysis."}
        </p>

        {/* Availability */}
        {coach.availability && coach.availability.length > 0 && (
          <div className="mb-5 bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-default)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">Availability</span>
              <span className="text-[10px] text-[var(--accent)] font-bold">Active</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {coach.availability.map((slot: AvailabilitySlot, i: number) => (
                <div
                  key={i}
                  className="flex flex-col items-center bg-white border border-[var(--border-default)] rounded px-3 py-1.5 min-w-[70px] shadow-sm"
                >
                  <span className="text-[10px] text-[var(--text-muted)] font-medium mb-0.5">{slot.day?.substring(0, 3)}</span>
                  <span className="text-[11px] text-[var(--text-primary)] font-mono font-bold">{slot.start}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Book Button */}
      <button
        id={`book-coach-${coach.id}`}
        onClick={(e) => { e.stopPropagation(); onBook(coach); }}
        className="gradient-btn w-full py-3 text-sm"
      >
        Book Session
      </button>
    </div>
  );
}

/* ─── Coach Profile Modal ─── */
function CoachProfileModal({
  coach,
  onClose,
  onBook,
  isPlayer,
  isAdmin,
  onBan,
  onUnban,
}: {
  coach: Coach | AdminCoach;
  onClose: () => void;
  onBook?: (c: Coach) => void;
  isPlayer: boolean;
  isAdmin: boolean;
  onBan?: (id: string) => void;
  onUnban?: (id: string) => void;
}) {
  const adminCoach = isAdmin ? (coach as AdminCoach) : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-6 bg-black/50 backdrop-blur-sm anim-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white border border-[var(--border-default)] rounded-t-2xl md:rounded-lg overflow-hidden shadow-2xl anim-fade-in-up max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero / Profile Photo */}
        <div className={`relative h-72 bg-gradient-to-br ${coach.gradient} shrink-0`}>
          {coach.avatarUrl ? (
            <Image src={coach.avatarUrl} alt={coach.name} width={672} height={288} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-8xl font-black text-white/20">{coach.avatar}</span>
            </div>
          )}
          {/* Subtle bottom gradient for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/60 to-transparent" />
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors text-sm font-bold"
          >
            ✕
          </button>
          {/* Name overlay */}
          <div className="absolute bottom-5 left-6 right-6">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-black text-[var(--text-primary)]">{titleCase(coach.name)}</h2>
              {coach.verified && (
                <span className="text-[10px] bg-[var(--accent)] text-white px-2.5 py-1 rounded font-bold uppercase tracking-wider">✓ Verified</span>
              )}
              {adminCoach?.banned && (
                <span className="text-[10px] bg-red-600 text-white px-2.5 py-1 rounded font-bold uppercase tracking-wider">Banned</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Stars rating={coach.rating} />
              <span className="text-[var(--text-secondary)] text-xs font-semibold font-mono">{coach.rating}</span>
              <span className="text-[var(--text-muted)] text-xs font-medium">· {coach.reviews} reviews</span>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5 bg-[var(--bg-secondary)]">
          {/* Rate + Position + Location row */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-white border border-[var(--border-default)] rounded-lg px-4 py-3 flex flex-col items-center shadow-sm">
              <span className="text-xl font-black text-[var(--text-primary)] font-mono">${coach.rate}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mt-0.5">per session</span>
            </div>
            {coach.role && (
              <div className="bg-[var(--accent-subtle)] border border-[var(--accent)]/20 rounded-lg px-4 py-3 flex flex-col items-center shadow-sm">
                <span className="text-sm font-bold text-[var(--accent)]">{coach.role}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mt-0.5">Position</span>
              </div>
            )}
            {coach.experience && (
              <div className="bg-white border border-[var(--border-default)] rounded-lg px-4 py-3 flex flex-col items-center shadow-sm">
                <span className="text-sm font-bold text-[var(--text-secondary)]">{coach.experience}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mt-0.5">Experience</span>
              </div>
            )}
          </div>

          {/* Location */}
          {coach.location && (
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-medium">
              <span>📍</span>
              <span className="text-sm">{coach.location}</span>
            </div>
          )}

          {/* Bio */}
          {coach.bio && (
            <div className="bg-white border border-[var(--border-default)] rounded-lg p-5 shadow-sm">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold mb-3">About</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{coach.bio}</p>
            </div>
          )}

          {/* Availability */}
          {coach.availability && coach.availability.length > 0 && (
            <div className="bg-white border border-[var(--border-default)] rounded-lg p-5 shadow-sm">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold mb-3">Availability</p>
              <div className="flex flex-wrap gap-2">
                {coach.availability.map((slot: AvailabilitySlot, i: number) => (
                  <div key={i} className="flex flex-col items-center bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-4 py-2">
                    <span className="text-[10px] text-[var(--text-muted)] font-semibold">{slot.day}</span>
                    <span className="text-xs text-[var(--text-primary)] font-mono font-bold mt-0.5">{slot.start} – {slot.end}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlight Reel */}
          {coach.highlightUrl && (
            <a
              href={coach.highlightUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 bg-white border border-[var(--border-default)] hover:border-[var(--accent)] rounded-lg p-4 transition-colors shadow-sm group/video"
            >
              <div className="w-10 h-10 bg-[var(--accent-subtle)] border border-[var(--accent)]/20 rounded flex items-center justify-center text-[var(--accent)] group-hover/video:bg-[var(--accent)] group-hover/video:text-white transition-all">
                ▶
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Watch Highlight Reel</p>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">Opens in new tab</p>
              </div>
            </a>
          )}

          {/* Admin-only section */}
          {isAdmin && adminCoach && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-5 space-y-4 shadow-sm">
              <p className="text-[10px] text-red-600 uppercase tracking-widest font-bold">Admin Controls</p>
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <span>📧</span>
                <span className="font-mono text-xs">{adminCoach.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] px-3 py-1.5 rounded font-bold uppercase tracking-wider ${
                  adminCoach.stripeConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-400 border border-gray-250"
                }`}>
                  {adminCoach.stripeConnected ? "Stripe ✓ Connected" : "Stripe ✗ Not Connected"}
                </span>
              </div>
              {adminCoach.banned ? (
                <button
                  onClick={() => onUnban?.(adminCoach.id)}
                  className="w-full py-3 bg-white hover:bg-gray-50 text-gray-700 border border-[var(--border-default)] rounded text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Restore Access
                </button>
              ) : (
                <button
                  onClick={() => onBan?.(adminCoach.id)}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Ban Coach
                </button>
              )}
            </div>
          )}
        </div>

        {/* Book button footer (players only) */}
        {isPlayer && onBook && (
          <div className="p-4 border-t border-[var(--border-default)] bg-white shrink-0">
            <button
              onClick={() => { onClose(); onBook(coach as Coach); }}
              className="w-full py-4 gradient-btn font-bold text-sm"
            >
              Book a Session — ${coach.rate}/hr
            </button>
          </div>
        )}
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

  const [isSyncingStripe, setIsSyncingStripe] = useState(false);
  const [isInitiatingStripe, setIsInitiatingStripe] = useState(false);

  async function refreshStripeStatus() {
    setIsSyncingStripe(true);
    const profileResult = await getMyCoachProfile();
    if (profileResult) {
      const p = profileResult as CoachProfileData;
      setStripeOnboarded(!!p.stripe_onboarding_complete);
      if (p.stripe_onboarding_complete) {
        setBookingMessage({ type: "success", text: "Stripe Connection Verified! You are now live." });
      } else if (p.dbError) {
        setBookingMessage({ type: "error", text: `Database Issue: ${p.dbError}` });
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
        const p = profileResult as CoachProfileData | null;
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
  const [selectedProfileCoach, setSelectedProfileCoach] = useState<Coach | AdminCoach | null>(null);
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
        const p = profileResult as CoachProfileData | null;
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
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] relative">

      {/* ═══════════════
          MODALS
          ═══════════════ */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-white border-2 border-black p-6 md:p-8 rounded-none max-w-5xl w-full relative anim-scale-in overflow-hidden shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              id="modal-close"
              onClick={closeModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-none bg-[var(--bg-secondary)] hover:bg-black hover:text-white border border-[var(--border-default)] flex items-center justify-center text-[var(--text-primary)] transition-colors z-20"
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
                        className={`w-16 h-16 rounded-none bg-gradient-to-br ${selectedCoach.gradient} flex items-center justify-center text-white font-bold text-2xl border border-black/10 overflow-hidden`}
                      >
                        {selectedCoach.avatarUrl ? (
                          <Image src={selectedCoach.avatarUrl} alt={selectedCoach.name} width={64} height={64} className="w-full h-full object-cover" />
                        ) : (
                          selectedCoach.avatar
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">
                          {selectedCoach.name}
                        </h2>
                        {selectedCoach.verified && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-none border border-indigo-200 font-bold uppercase tracking-wider">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                            Verified
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-[var(--text-secondary)] font-semibold mb-2">
                        {selectedCoach.experience || "Experienced Coach"}
                      </p>

                      <div className="flex items-center gap-2 text-sm">
                        <Stars rating={selectedCoach.rating} />
                        <span className="font-bold text-[var(--text-primary)]">
                          {selectedCoach.rating}
                        </span>
                        <span className="text-[var(--text-muted)] text-xs font-medium">({selectedCoach.reviews} reviews)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] px-2.5 py-1 rounded-none bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                      {selectedCoach.role}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] px-2.5 py-1 rounded-none bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
                      {selectedCoach.style}
                    </span>
                  </div>

                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6 bg-[var(--bg-secondary)]/50 p-4 rounded-none border border-[var(--border-default)] whitespace-pre-wrap">
                    {selectedCoach.bio}
                  </p>

                  <div className="space-y-4">
                    {selectedCoach.availability && selectedCoach.availability.length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-3">
                          Weekly Availability
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCoach.availability.map((slot: AvailabilitySlot, i: number) => (
                            <span
                              key={i}
                              className="text-xs bg-[var(--bg-secondary)] text-[var(--text-secondary)] px-3 py-1.5 rounded-none border border-[var(--border-default)] font-mono font-semibold flex items-center gap-1.5"
                            >
                              <span className="text-[var(--text-muted)] font-bold">{slot.day}</span>
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
                        className="flex items-center justify-center gap-2 w-full bg-white border border-black hover:bg-black hover:text-white text-black py-3 rounded-none text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                      >
                        ▶ Watch Highlight Reel
                      </a>
                    )}
                  </div>
                </div>

                <div className="md:w-[20rem] shrink-0">
                  <div className="bg-white border-2 border-black p-6 h-full">
                    <h3 className="text-[var(--text-primary)] font-bold text-lg mb-6 uppercase tracking-wider">
                      Book Session
                    </h3>

                    <div className="space-y-6">
                      {/* Step 1: Date Picker */}
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold block mb-3">
                          1. Pick a Date
                        </label>
                        <div className="grid grid-cols-7 gap-1 text-center bg-[var(--bg-secondary)] p-2 rounded-none border border-[var(--border-default)]">
                          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                            <div key={`day-${i}`} className="text-[10px] text-[var(--text-muted)] font-bold py-1.5">
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
                                  className={`h-8 w-8 flex items-center justify-center rounded-none text-xs font-bold transition-all ${
                                    isSel
                                      ? "bg-[var(--accent)] text-white"
                                      : "text-[var(--text-secondary)] hover:bg-white hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-default)]"
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
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold block mb-3">
                          2. Select Time
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {getAvailableSlots(selectedCoach.availability || [], new Date(selectedYear || 2025, selectedMonth ?? 0, selectedDate || 1)).length > 0 ? (
                            getAvailableSlots(selectedCoach.availability || [], new Date(selectedYear || 2025, selectedMonth ?? 0, selectedDate || 1)).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setSelectedTime(t)}
                                className={`py-3 rounded-none text-xs font-bold uppercase tracking-wider transition-all border ${selectedTime === t
                                    ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                                    : "bg-white border-[var(--border-default)] text-[var(--text-secondary)] hover:border-black hover:text-[var(--text-primary)]"
                                  }`}
                              >
                                {t}
                              </button>
                            ))
                          ) : (
                            <div className="col-span-2 py-6 bg-[var(--bg-secondary)] rounded-none border border-[var(--border-default)] border-dashed text-center">
                              <p className="text-xs text-[var(--text-muted)] font-medium">No availability on this day</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedDate && selectedTime ? (
                        <div className="anim-fade-in pt-6 border-t border-[var(--border-default)]">
                          <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                              <span className="text-[var(--text-secondary)] font-medium">Coaching Session</span>
                              <span className="text-[var(--text-primary)] font-bold">${selectedCoach.rate}.00</span>
                            </div>
                             <div className="flex justify-between text-sm">
                              <span className="text-[var(--text-secondary)] font-medium">Service Fee</span>
                              <span className="text-[var(--text-primary)] font-bold">${Math.round(selectedCoach.rate * PLATFORM_CUT)}.00</span>
                            </div>
                            <div className="flex justify-between items-end pt-3 border-t border-[var(--border-default)]">
                              <span className="text-[var(--text-primary)] font-bold text-sm uppercase tracking-wider">Total</span>
                              <span className="text-[var(--text-primary)] text-xl font-bold">${selectedCoach.rate + Math.round(selectedCoach.rate * PLATFORM_CUT)}.00</span>
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
                            className="gradient-btn w-full py-3.5 text-xs font-bold uppercase tracking-wider rounded-none disabled:opacity-50"
                          >
                            {bookingLoading ? "Connecting..." : "Book Now"}
                          </button>

                          <div className="mt-5 flex flex-col items-center gap-2">
                            <Image src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" width={80} height={16} className="h-4 opacity-40 grayscale" />
                            <p className="text-[10px] text-[var(--text-muted)] text-center font-medium leading-relaxed">
                              Payment secured. Released when both parties confirm.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-12 text-center text-[var(--text-muted)] opacity-40">
                          <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <p className="text-xs font-bold uppercase tracking-wider">Select date and time</p>
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
                  <div className="w-10 h-10 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-none flex items-center justify-center text-lg border border-[var(--border-default)]">📜</div>
                  <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Terms of Service
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="p-5 bg-white rounded-none border border-[var(--border-default)] shadow-xs">
                    <strong className="text-[var(--text-primary)] text-sm block mb-2 font-bold uppercase tracking-wider">1. Two-Way Confirmation System</strong>
                    <p className="text-[var(--text-secondary)] text-sm leading-relaxed">To ensure security for both sides, session funds are held in CoachingMatch&apos;s secure vault. After your session is completed, both the coach and the player must click &quot;Confirm Session Complete&quot; for funds to be released. If either party does not confirm, the funds remain held and our support team will assist.</p>
                  </div>
                  <div className="p-5 bg-red-50 rounded-none border border-red-200 shadow-xs">
                    <strong className="text-red-800 text-sm block mb-2 font-bold uppercase tracking-wider">2. Off-Platform Protection</strong>
                    <p className="text-red-700 text-sm leading-relaxed font-medium">Attempting to book coaching sessions outside of CoachingMatch is strictly prohibited. This is for your own safety; sessions outside our portal are not protected by our escrow guarantee and will result in immediate permanent account suspension.</p>
                  </div>
                  <div className="p-5 bg-white rounded-none border border-[var(--border-default)] shadow-xs">
                    <strong className="text-amber-800 text-sm block mb-2 font-bold uppercase tracking-wider">3. Reviews &amp; Ratings</strong>
                    <p className="text-[var(--text-secondary)] text-sm leading-relaxed">After a session is completed, players are encouraged to leave a star rating and review. This helps future players make informed decisions and helps coaches build their reputation on the platform.</p>
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
          className="text-lg font-bold text-[var(--text-primary)] cursor-pointer tracking-tight"
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
          Coaching<span className="text-[var(--accent)] font-extrabold">Match</span>
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

          <div className="h-5 w-px bg-gray-200" />

          {currentUser.isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)]/15 flex items-center justify-center text-[var(--accent)] font-bold text-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-[var(--text-secondary)] font-medium">
                  {currentUser.name}
                </span>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-xs text-[var(--text-secondary)] hover:text-red-500 px-3 py-1.5 rounded hover:bg-red-50/50 transition-colors font-medium"
                >
                  Sign Out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="gradient-btn text-xs font-bold px-4 py-2 rounded"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          id="mobile-menu-toggle"
          className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-colors"
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
            <div className={`bg-white border rounded p-4 flex items-center justify-between gap-4 shadow-lg ${
              bookingMessage.type === "error"
                ? "border-red-500 text-red-600"
                : "border-emerald-500 text-emerald-600"
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{bookingMessage.type === "error" ? "🚨" : "✅"}</span>
                <p className="text-sm font-semibold">{bookingMessage.text}</p>
              </div>
              <button
                onClick={() => setBookingMessage(null)}
                className="w-7 h-7 rounded hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ── VIEW 1: DISCOVERY ── */}
        {view === "discovery" && currentUser.role === "player" && (
          <section className="anim-fade-in-up pb-32">
            {/* Split Hero Section */}
            <div className="pt-8 md:pt-16 pb-16 grid md:grid-cols-12 gap-8 items-center">
              {/* Left Column: Vinted Card */}
              <div className="md:col-span-5 bg-white border border-[var(--border-default)] rounded p-6 md:p-8 shadow-sm flex flex-col justify-center min-h-[350px] relative overflow-visible z-20">
                <h1 className="text-3xl font-extrabold text-[var(--text-primary)] leading-tight tracking-tight mb-4">
                  Ready to level up <br />
                  your <span className="text-[var(--accent)] font-black">soccer game?</span>
                </h1>

                <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
                  Connect with experienced coaches for personalized training sessions, film analysis, and skill development.
                </p>

                {/* Redesigned Search & Filters Container */}
                <div className="w-full relative overflow-visible space-y-3">
                  <div className="relative w-full">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[var(--text-tertiary)]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input
                      id="coach-search"
                      className="w-full vinted-input pl-11 placeholder:text-[var(--text-tertiary)] text-sm"
                      placeholder="Search by position, style, or coach name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      id="filter-toggle"
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={`flex-1 flex items-center justify-between px-4 py-2.5 rounded text-xs font-semibold border transition-all ${
                        isFilterOpen || activeFilter !== "All Roles"
                          ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]"
                          : "bg-white border-[var(--border-default)] text-[var(--text-secondary)] hover:border-gray-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        {activeFilter === "All Roles" ? "Filter by Position" : activeFilter}
                      </div>
                      <span className={`text-[8px] transition-transform ${isFilterOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                  </div>

                  {isFilterOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border-default)] rounded p-2.5 z-30 shadow-lg anim-scale-in grid grid-cols-1 gap-1">
                      {["All Roles", "Forward", "Midfielder", "Defender", "Goalkeeper"].map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setActiveFilter(f);
                            setIsFilterOpen(false);
                          }}
                          className={`w-full py-2 px-3 rounded text-left text-xs font-medium transition-all ${
                            activeFilter === f
                              ? "bg-[var(--accent-subtle)] text-[var(--accent)] font-bold"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Dynamic Action Image */}
              <div className="md:col-span-7 h-[380px] w-full rounded overflow-hidden shadow-sm border border-[var(--border-default)] hidden md:block relative bg-[var(--bg-secondary)]">
                <Image
                  src="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80"
                  alt="Soccer Coaching"
                  fill
                  sizes="(max-width: 768px) 100vw, 800px"
                  priority
                  className="object-cover"
                />
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
                  onViewProfile={(c) => setSelectedProfileCoach(c)}
                />
              ))}
            </div>

            {filteredCoaches.length === 0 && allCoaches.length === 0 && coachesLoaded && (
              <div className="text-center py-24 anim-fade-in glass-card border-dashed">
                <p className="text-6xl mb-6">🏟️</p>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Coaches Available Yet</h3>
                <p className="text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed text-xs">
                  Be the first coach to create a profile and share your training specialty.
                </p>
                {!currentUser.isAuthenticated && (
                  <Link
                    href="/signup"
                    className="inline-block mt-8 gradient-btn px-8 py-3 text-xs"
                  >
                    Register as Coach →
                  </Link>
                )}
              </div>
            )}

            {filteredCoaches.length === 0 && allCoaches.length > 0 && (
              <div className="text-center py-24 anim-fade-in glass-card">
                <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider mb-4">
                  0 RESULTS FOUND FOR QUERY
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setActiveFilter("All Roles");
                  }}
                  className="text-[var(--accent)] text-xs font-bold uppercase tracking-wider hover:underline decoration-2"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* Tactical Lifecycle Section */}
            <div className="mt-24 mb-16">
              <div className="text-center mb-12">
                <span className="text-xs font-semibold text-[var(--accent)] mb-3 inline-block uppercase tracking-wider">How It Works</span>
                <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)] mb-3">Simple &amp; Secure</h2>
                <p className="text-[var(--text-secondary)] text-sm max-w-md mx-auto">Book a session, train together, and both confirm when you&apos;re done.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="glass-card p-6 bg-white rounded">
                  <div className="text-2xl mb-4">🎯</div>
                  <h4 className="text-base font-bold text-[var(--text-primary)] mb-2">Find a Coach</h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Browse verified coaches by position, style, and availability. Pick one that fits your goals and book a time that works for you.</p>
                </div>

                <div className="glass-card p-6 bg-white rounded">
                  <div className="text-2xl mb-4">🔐</div>
                  <h4 className="text-base font-bold text-[var(--text-primary)] mb-2">Secure Payment</h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Your payment is held securely until the session is complete. Both you and the coach confirm it happened, then the coach gets paid.</p>
                </div>

                <div className="glass-card p-6 bg-white rounded">
                  <div className="text-2xl mb-4">📊</div>
                  <h4 className="text-base font-bold text-[var(--text-primary)] mb-2">Get Better</h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Train with your coach, get personalized feedback, and watch your game improve. Leave a review to help other players find great coaches.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── VIEW 2: VOD PORTAL ── */}
        {view === "session" && currentUser.role === "player" && (
          <div className="space-y-6 anim-fade-in-up">
            <h2 className="text-xl font-bold mb-6 text-[var(--text-primary)]">
              My Sessions
            </h2>

            {/* bookingMessage was here, now moved to global top */}

            {realBookings.map((b: Booking) => (
              <div key={b.id} className="glass-card p-6 md:p-8 relative hover:transform-none bg-white">
                <div className="flex flex-col gap-6">

                  {/* Top: Info Row */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                        Session with Coach {b.coach?.full_name || "Unknown"}
                      </h3>
                      <p className="text-[var(--text-secondary)] text-sm mb-3">
                        {new Date(b.session_date).toLocaleDateString()} at {b.session_time}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider border ${
                          b.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          b.status === "confirmed" ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--border-default)]" :
                          b.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)]"
                        }`}>
                          {b.status === "pending" ? "Awaiting Checkout" :
                           b.status === "confirmed" ? "Session Paid — Confirm When Done" :
                           b.status === "completed" ? "Completed ✓" :
                           b.status}
                        </span>
                        <span className="font-mono text-[var(--accent)] font-bold">${b.total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Two-Way Confirmation Status */}
                  {b.status === "confirmed" && (
                    <div className="bg-[var(--bg-secondary)] rounded p-5 border border-[var(--border-default)]">
                      <p className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-4">Session Confirmation Status</p>
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className={`rounded p-4 border text-center ${b.coach_confirmed_at ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]" : "bg-white border-[var(--border-default)] text-[var(--text-secondary)]"}`}>
                          <p className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-2">Coach</p>
                          <p className={`text-sm font-semibold ${b.coach_confirmed_at ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                            {b.coach_confirmed_at ? "✓ Confirmed" : "⏳ Pending"}
                          </p>
                        </div>
                        <div className={`rounded p-4 border text-center ${b.player_confirmed_at ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]" : "bg-white border-[var(--border-default)] text-[var(--text-secondary)]"}`}>
                          <p className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-2">You (Player)</p>
                          <p className={`text-sm font-semibold ${b.player_confirmed_at ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                            {b.player_confirmed_at ? "✓ Confirmed" : "⏳ Pending"}
                          </p>
                        </div>
                      </div>

                      {/* Player Confirm Button */}
                      {!b.player_confirmed_at && (
                        <button
                          onClick={() => handleConfirmSession(b.id)}
                          disabled={confirmingSession === b.id}
                          className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded font-medium text-sm transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                          {confirmingSession === b.id ? "Confirming..." : "✓ Confirm Session Complete"}
                        </button>
                      )}
                      {!!b.player_confirmed_at && !b.coach_confirmed_at && (
                        <p className="text-center text-amber-600 text-xs font-bold">Waiting for coach to confirm...</p>
                      )}
                    </div>
                  )}

                  {/* Rating Form (After completion) */}
                  {b.status === "completed" && !b.player_rating && (
                    <div className="bg-amber-50/50 rounded p-6 border border-amber-200">
                      <p className="text-sm font-semibold text-[var(--text-primary)] mb-4">Rate Your Session</p>
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
                                : "text-gray-300"
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
                            className="w-full p-4 bg-white border border-[var(--border-default)] rounded text-[var(--text-primary)] text-sm placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] resize-none"
                          />
                          <button
                            onClick={() => handleSubmitRating(b.id)}
                            disabled={submittingRating}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded font-semibold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                          >
                            {submittingRating ? "Submitting..." : `Submit ${ratingValue}-Star Review`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show existing rating */}
                  {!!b.player_rating && (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="text-amber-400">{"★".repeat(b.player_rating)}{"☆".repeat(5 - b.player_rating)}</span>
                      <span className="font-bold">Your Review</span>
                      {!!b.player_review && <span className="italic text-xs">&mdash; &quot;{b.player_review}&quot;</span>}
                    </div>
                  )}

                  {/* Optional: VOD Upload (separate feature, not gating payment) */}
                  {b.status === "confirmed" && (
                    <div className="border-t border-[var(--border-default)] pt-4">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider mb-3">Optional: Upload Match Footage for Analysis</p>
                      <div className="flex gap-3">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded font-semibold text-xs transition-all cursor-pointer border border-dashed ${
                          uploadingVod === b.id
                            ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]"
                            : "bg-white text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--accent)] hover:border-[var(--border-hover)]"
                        }`}>
                          {uploadingVod === b.id ? "Uploading..." : "📎 Upload MP4"}
                          <input type="file" accept="video/*" className="hidden" disabled={!!uploadingVod} onChange={(e) => handleVodUpload(e, b.id)} />
                        </label>
                        {!!b.vod_url && (
                          <a href={b.vod_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 py-3 px-4 bg-white text-[var(--text-primary)] rounded font-semibold text-xs hover:bg-[var(--bg-secondary)] transition-colors border border-[var(--border-default)]">
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
              <div className="text-center py-20 glass-card bg-white">
                <p className="text-[var(--text-secondary)] mb-4">You haven&apos;t booked any sessions yet.</p>
                <button onClick={() => setView("discovery")} className="text-[var(--accent)] font-semibold hover:text-[var(--accent-hover)]">
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
              <div className="glass-card p-6 border-amber-200 bg-amber-50/50 relative overflow-hidden anim-fade-in">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded flex items-center justify-center text-xl shrink-0">⚠️</div>
                    <div>
                      <p className="font-semibold text-lg tracking-tight text-[var(--text-primary)] mb-1">Financial Link Missing</p>
                      <p className="text-xs font-medium text-[var(--text-secondary)] leading-relaxed max-w-xl">
                        You must complete your Stripe onboarding to receive session payouts. Your profile is currently hidden from players until this connection is verified.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button
                      onClick={refreshStripeStatus}
                      disabled={isSyncingStripe}
                      className="flex-1 md:flex-none bg-white border border-[var(--border-default)] hover:border-[var(--accent)] text-[var(--text-primary)] px-6 py-3 rounded text-[10px] font-semibold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSyncingStripe ? <span className="w-3 h-3 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" /> : "Refresh Status"}
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
                      className="flex-1 md:flex-none bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 px-6 py-3 rounded text-[10px] font-semibold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
                        } catch {
                          setBookingMessage({ type: "error", text: "Something went wrong connecting to Stripe. Please try again." });
                        } finally {
                          setIsInitiatingStripe(false);
                        }
                      }}
                      disabled={isInitiatingStripe}
                      className="flex-1 md:flex-none gradient-btn px-6 py-3 rounded text-[10px] font-semibold uppercase tracking-wider transition-all block text-center disabled:opacity-50"
                    >
                      {isInitiatingStripe ? "Processing..." : "Complete Setup"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
                  Coach Dashboard
                </h2>
                <p className="text-[var(--text-secondary)] text-xs">
                  Your Dashboard
                </p>
              </div>
              <div className="flex gap-4">
                <div className="glass-card px-6 py-3 bg-white border-[var(--border-default)]">
                  <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider mb-1">Total Career Revenue</p>
                  <p className="text-xl font-semibold text-[var(--accent)] font-mono">
                    ${realBookings
                      .filter((b: Booking) => b.status === "completed")
                      .reduce((acc: number, b: Booking) => acc + Number(b.amount || 0), 0)
                      .toFixed(2)}
                  </p>
                </div>
                <Link
                  href="/coach/edit"
                  className="outline-btn px-6 py-3 flex items-center gap-2 group/edit font-semibold uppercase text-[9px] tracking-wider"
                >
                  Edit Profile
                  <svg className="w-3 h-3 text-[var(--accent)] group-hover/edit:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
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
                  color: "text-orange-600",
                },
                {
                  label: "Net Earnings",
                  val: `$${realBookings
                    .filter((b: Booking) => !!b.payout_id)
                    .reduce((sum: number, b: Booking) => sum + Number(b.amount || 0) * (1 - PLATFORM_CUT), 0)
                    .toFixed(2)}`,
                  color: "text-[var(--accent)]",
                },
                {
                  label: "Sessions",
                  val: realBookings.length.toString(),
                  color: "text-[var(--text-primary)]",
                },
                {
                  label: "Platform Fee",
                  val: `$${realBookings
                    .filter((b: Booking) => b.payout_id)
                    .reduce((sum, b: Booking) => sum + Number(b.amount || 0) * PLATFORM_CUT, 0)
                    .toFixed(2)}`,
                  color: "text-[var(--text-muted)]",
                },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-6 bg-white">
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold tracking-wider mb-3">{stat.label}</p>
                  <p className={`text-2xl font-semibold font-mono ${stat.color}`}>{stat.val}</p>
                </div>
              ))}
            </div>

            {/* Action Queue */}
            <div>
              <h3 className="text-sm font-semibold mb-6 text-[var(--text-secondary)] flex items-center gap-3 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]" />
                Sessions Requiring Action
              </h3>
              {realBookings.filter((b: Booking) => b.status === 'confirmed' && !b.coach_confirmed_at).length > 0 ? (
                <div className="grid gap-4">
                  {realBookings.filter((b: Booking) => b.status === 'confirmed' && !b.coach_confirmed_at).map((booking: Booking) => (
                    <div key={booking.id} className="glass-card overflow-hidden bg-white group/action relative border-l-4 border-l-[var(--accent)]">
                      <div className="p-6 md:p-8">
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-5">
                          <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)] flex items-center justify-center text-[var(--accent)] text-lg font-bold">
                              {booking.player_name?.charAt(0) || "P"}
                            </div>
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">{booking.player_name || "Player"}</h4>
                                <span className="text-[9px] bg-[var(--accent-subtle)] text-[var(--accent)] px-2.5 py-1 rounded border border-[var(--accent)] font-semibold uppercase tracking-wider">Confirm Session</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <p className="text-xs text-[var(--text-muted)] font-bold font-mono opacity-80">{booking.player_email}</p>
                                <span className="w-1 h-1 rounded-full bg-[var(--border-default)]" />
                                <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Session: {new Date(booking.session_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-3 py-1.5 rounded font-semibold uppercase tracking-wider border ${
                              booking.player_confirmed_at 
                                ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]"
                                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)]"
                            }`}>
                              Player: {booking.player_confirmed_at ? "✓ Confirmed" : "Pending"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleConfirmSession(booking.id)}
                          disabled={confirmingSession === booking.id}
                          className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded font-medium text-sm transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                          {confirmingSession === booking.id ? "Confirming..." : "✓ Confirm Session Complete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card p-12 text-center border-dashed bg-white">
                  <div className="w-12 h-12 bg-[var(--bg-secondary)] rounded flex items-center justify-center mx-auto mb-4 border border-[var(--border-default)]">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <p className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">No sessions awaiting confirmation. You&apos;re all caught up!</p>
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
                  <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2">
                    Admin <span className="text-[var(--accent)]">Dashboard</span>
                  </h2>
                  <p className="text-[var(--text-secondary)] text-[10px] font-semibold uppercase tracking-wider opacity-80">
                    Platform Overview & Management
                  </p>
                </div>
              </div>

              {/* ── Admin Tabs ── */}
              <div className="flex gap-2 mb-10 border-b border-[var(--border-default)] pb-4">
                {(["overview", "coaches", "bookings"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setAdminTab(tab)}
                    className={`px-5 py-2.5 rounded text-[11px] font-semibold uppercase tracking-wider transition-all ${
                      adminTab === tab
                        ? "bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] border border-transparent"
                    }`}
                  >
                    {tab === "overview" ? "📊 Overview" : tab === "coaches" ? "👥 Coaches" : "📅 Bookings"}
                  </button>
                ))}
              </div>

              {adminLoading ? (
                <div className="glass-card p-24 text-center bg-white">
                  <div className="w-10 h-10 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-6" />
                  <p className="text-[var(--text-secondary)] text-[10px] font-semibold uppercase tracking-wider">Loading data...</p>
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
                            color: "text-[var(--accent)]",
                            unit: "SIGNED UP",
                          },
                          {
                            label: "Active Coaches",
                            val: adminCoaches.filter((c: AdminCoach) => !c.banned).length.toString(),
                            color: "text-[var(--accent)]",
                            unit: "LIVE",
                          },
                          {
                            label: "Total Bookings",
                            val: adminBookings.length.toString(),
                            color: "text-[var(--accent)]",
                            unit: "ALL TIME",
                          },
                          {
                            label: "Revenue (Platform)",
                            val: "$" + adminBookings
                              .filter((b) => b.status === "completed" || b.status === "confirmed")
                              .reduce((sum, b) => sum + Math.round(((Number(b.rate)) || 0) * PLATFORM_CUT), 0)
                              .toString(),
                            color: "text-[var(--text-primary)]",
                            unit: "EARNED",
                          },
                        ].map((stat, i) => (
                          <div key={i} className="glass-card p-6 bg-white relative overflow-hidden group/stat">
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold tracking-wider mb-4">
                              {stat.label}
                            </p>
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className={`text-4xl font-semibold font-mono ${stat.color}`}>{stat.val}</span>
                              <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{stat.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Upcoming Sessions */}
                      <div>
                        <h3 className="text-sm font-semibold mb-6 text-[var(--text-secondary)] flex items-center gap-4 uppercase tracking-wider">
                          <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)] flex items-center justify-center p-0.5">
                            <span className="w-full h-full rounded-full bg-[var(--accent)]" />
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
                              <div className="glass-card p-12 text-center border-dashed bg-white">
                                <p className="text-3xl mb-4 opacity-30">📅</p>
                                <p className="text-[var(--text-secondary)] text-sm font-bold">No upcoming sessions scheduled</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {upcoming.map((b, i) => {
                                const coach = b.coach as Record<string, string> | null;
                                const player = b.player as Record<string, string> | null;
                                return (
                                  <div key={i} className="glass-card p-5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[var(--accent)]/30">
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)] flex items-center justify-center text-sm">
                                        📅
                                      </div>
                                      <div>
                                        <p className="text-[var(--text-primary)] font-bold text-sm">
                                          {new Date(String(b.session_date)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                          {!!b.session_time && <span className="text-[var(--text-secondary)] ml-2">@ {String(b.session_time)}</span>}
                                        </p>
                                        <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                                          {coach?.full_name || "Unknown Coach"} → {player?.full_name || String(b.player_name) || "Player"}
                                          {!!b.location && <span className="ml-2 text-[var(--accent)]/70">📍 {String(b.location)}</span>}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[var(--text-primary)] font-semibold font-mono">${Number(b.rate)}</span>
                                      <span className={`text-[9px] px-3 py-1 rounded font-semibold uppercase tracking-wider border ${
                                        b.status === "confirmed"
                                          ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent)]"
                                          : "bg-amber-550/10 text-amber-700 border-amber-200"
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
                        <h3 className="text-sm font-semibold mb-6 text-[var(--text-secondary)] flex items-center gap-4 uppercase tracking-wider">
                          <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-500 flex items-center justify-center p-0.5">
                            <span className="w-full h-full rounded-full bg-emerald-500" />
                          </span>
                          Recently Completed
                        </h3>
                        {(() => {
                          const completed = adminBookings
                            .filter((b) => b.status === "completed")
                            .slice(0, 5);

                          if (completed.length === 0) {
                            return (
                              <div className="glass-card p-12 text-center border-dashed bg-white">
                                <p className="text-3xl mb-4 opacity-30">✅</p>
                                <p className="text-[var(--text-secondary)] text-sm font-bold">No completed sessions yet</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {completed.map((b, i) => {
                                const coach = b.coach as Record<string, string> | null;
                                const player = b.player as Record<string, string> | null;
                                return (
                                  <div key={i} className="glass-card p-5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 opacity-80">
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-sm">
                                        ✅
                                      </div>
                                      <div>
                                        <p className="text-[var(--text-primary)] font-bold text-sm">
                                          {new Date(String(b.session_date)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </p>
                                        <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                                          {coach?.full_name || "Coach"} → {player?.full_name || String(b.player_name) || "Player"}
                                          {!!b.player_rating && <span className="ml-2 text-amber-400">{"★".repeat(Number(b.player_rating))}</span>}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[var(--text-secondary)] font-bold font-mono text-sm">${Number(b.rate)}</span>
                                      <span className="text-[9px] text-[var(--text-muted)] font-bold">→ ${Math.round((Number(b.rate)) * PLATFORM_CUT)} fee</span>
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
                              className={`glass-card overflow-hidden transition-all duration-300 cursor-pointer group/personnel ${coach.banned ? "opacity-60 border-red-900/40 bg-red-500/[0.01]" : "hover:border-indigo-500/30"}`}
                              onClick={() => setSelectedProfileCoach(coach as unknown as Coach)}
                            >
                              <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
                                <div className="flex items-center gap-6">
                                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${coach.gradient} flex items-center justify-center text-white font-semibold text-xl relative z-10 border border-white/10 ${coach.banned ? "grayscale" : ""} overflow-hidden`}>
                                    {coach.avatarUrl ? (
                                      <Image src={coach.avatarUrl} alt={coach.name} width={56} height={56} className="w-full h-full object-cover" />
                                    ) : (
                                      coach.avatar
                                    )}

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

      {/* ═══════════════
          COACH PROFILE MODAL
          ═══════════════ */}
      {selectedProfileCoach && (
        <CoachProfileModal
          coach={selectedProfileCoach}
          onClose={() => setSelectedProfileCoach(null)}
          onBook={currentUser.role === "player" ? (c) => { setSelectedProfileCoach(null); handleBookingClick(c); } : undefined}
          isPlayer={currentUser.role === "player"}
          isAdmin={currentUser.role === "admin"}
          onBan={async (id) => {
            setBanningCoach(id);
            await banCoach(id);
            const updated = await getAllCoachesAdmin();
            setAdminCoaches(updated as unknown as AdminCoach[]);
            const publicCoaches = await getCoaches();
            setDbCoaches(publicCoaches as unknown as Coach[]);
            setBanningCoach(null);
            setSelectedProfileCoach(null);
          }}
          onUnban={async (id) => {
            setBanningCoach(id);
            await unbanCoach(id);
            const updated = await getAllCoachesAdmin();
            setAdminCoaches(updated as unknown as AdminCoach[]);
            const publicCoaches = await getCoaches();
            setDbCoaches(publicCoaches as unknown as Coach[]);
            setBanningCoach(null);
            setSelectedProfileCoach(null);
          }}
        />
      )}
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
      className={`px-3.5 py-2 rounded text-sm font-medium transition-all ${
        active
          ? "text-[var(--accent)] bg-[var(--accent-subtle)] font-bold"
          : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-secondary)]"
      }`}
    >
      {children}
    </button>
  );
}
