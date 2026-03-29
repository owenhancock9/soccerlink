"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";
import { signOut } from "@/app/actions/auth";
import { getCoaches, getMyCoachProfile } from "@/app/actions/coaches";
import { createBooking, getCoachBookings } from "@/app/actions/bookings";
import { createStripeConnectAccount } from "@/app/actions/stripe";

/* ─── Mock Data ─── */
const COACHES = [
  {
    id: 1,
    name: "Coach Ricardo",
    style: "Tiki-Taka",
    role: "Midfield",
    rate: 60,
    verified: true,
    rating: 4.9,
    reviews: 124,
    bio: "Ex-Academy coach. Focus on vision, scanning, and first touch.",
    avatar: "R",
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    id: 2,
    name: "Coach Marco",
    style: "Gegenpressing",
    role: "Tactical",
    rate: 45,
    verified: true,
    rating: 4.7,
    reviews: 89,
    bio: "High intensity fitness, pressing triggers, and transition play.",
    avatar: "M",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    id: 3,
    name: "Coach Sarah",
    style: "Target Man",
    role: "Striker",
    rate: 55,
    verified: false,
    rating: 4.5,
    reviews: 42,
    bio: "Finishing specialist. Aerial duels and hold-up play.",
    avatar: "S",
    gradient: "from-rose-500 to-pink-600",
  },
  {
    id: 4,
    name: "Coach Diego",
    style: "Catenaccio",
    role: "Defense",
    rate: 50,
    verified: true,
    rating: 5.0,
    reviews: 210,
    bio: "Master the art of defending. Positioning, 1v1s, and clearing lines.",
    avatar: "D",
    gradient: "from-emerald-500 to-teal-600",
  },
];

const PLAYER_STATS = { technical: 88, tactical: 75, physical: 92, mental: 81 };
const PLATFORM_CUT = 0.13;

/* ─── Coach's Player Roster ─── */
const MY_PLAYERS = [
  {
    id: 1,
    name: "Alex Rivera",
    position: "Midfielder",
    avatar: "A",
    gradient: "from-indigo-500 to-violet-600",
    sessions: 12,
    lastActive: "2 hours ago",
    status: "vod-pending" as const,
    stats: { technical: 88, tactical: 75, physical: 92, mental: 81 },
    nextSession: "Oct 15 at 2:00 PM",
    vodsSubmitted: 8,
  },
  {
    id: 2,
    name: "Jordan Mills",
    position: "Striker",
    avatar: "J",
    gradient: "from-amber-500 to-orange-600",
    sessions: 7,
    lastActive: "Yesterday",
    status: "vod-pending" as const,
    stats: { technical: 82, tactical: 68, physical: 95, mental: 73 },
    nextSession: "Oct 16 at 10:00 AM",
    vodsSubmitted: 5,
  },
  {
    id: 3,
    name: "Liam Chen",
    position: "Center Back",
    avatar: "L",
    gradient: "from-emerald-500 to-teal-600",
    sessions: 19,
    lastActive: "3 days ago",
    status: "up-to-date" as const,
    stats: { technical: 71, tactical: 89, physical: 88, mental: 90 },
    nextSession: "Oct 18 at 6:30 PM",
    vodsSubmitted: 14,
  },
  {
    id: 4,
    name: "Sofia Reyes",
    position: "Winger",
    avatar: "S",
    gradient: "from-rose-500 to-pink-600",
    sessions: 4,
    lastActive: "1 week ago",
    status: "up-to-date" as const,
    stats: { technical: 91, tactical: 66, physical: 85, mental: 70 },
    nextSession: "Oct 20 at 2:00 PM",
    vodsSubmitted: 3,
  },
  {
    id: 5,
    name: "Marcus Johnson",
    position: "Goalkeeper",
    avatar: "M",
    gradient: "from-cyan-500 to-blue-600",
    sessions: 9,
    lastActive: "5 hours ago",
    status: "vod-pending" as const,
    stats: { technical: 78, tactical: 83, physical: 90, mental: 86 },
    nextSession: "Oct 14 at 10:00 AM",
    vodsSubmitted: 7,
  },
];

/* ─── Admin: Coach Session Data ─── */
const COACH_SESSIONS = [
  {
    coachId: 1,
    name: "Coach Ricardo",
    avatar: "R",
    gradient: "from-indigo-500 to-violet-600",
    verified: true,
    rating: 4.9,
    totalSessions: 124,
    activePlayers: 8,
    totalEarnings: 7440,
    platformFees: 967.2,
    schedule: [
      {
        day: "Mon",
        time: "10:00 AM",
        player: "Alex Rivera",
        status: "confirmed" as const,
      },
      {
        day: "Wed",
        time: "2:00 PM",
        player: "Liam Chen",
        status: "confirmed" as const,
      },
      {
        day: "Fri",
        time: "6:30 PM",
        player: "Sofia Reyes",
        status: "pending" as const,
      },
    ],
  },
  {
    coachId: 2,
    name: "Coach Marco",
    avatar: "M",
    gradient: "from-cyan-500 to-blue-600",
    verified: true,
    rating: 4.7,
    totalSessions: 89,
    activePlayers: 5,
    totalEarnings: 4005,
    platformFees: 520.65,
    schedule: [
      {
        day: "Tue",
        time: "10:00 AM",
        player: "Jordan Mills",
        status: "confirmed" as const,
      },
      {
        day: "Thu",
        time: "2:00 PM",
        player: "Marcus Johnson",
        status: "confirmed" as const,
      },
    ],
  },
  {
    coachId: 3,
    name: "Coach Sarah",
    avatar: "S",
    gradient: "from-rose-500 to-pink-600",
    verified: false,
    rating: 4.5,
    totalSessions: 42,
    activePlayers: 3,
    totalEarnings: 2310,
    platformFees: 300.3,
    schedule: [
      {
        day: "Mon",
        time: "6:30 PM",
        player: "Alex Rivera",
        status: "disputed" as const,
      },
      {
        day: "Sat",
        time: "10:00 AM",
        player: "Jordan Mills",
        status: "pending" as const,
      },
    ],
  },
  {
    coachId: 4,
    name: "Coach Diego",
    avatar: "D",
    gradient: "from-emerald-500 to-teal-600",
    verified: true,
    rating: 5.0,
    totalSessions: 210,
    activePlayers: 12,
    totalEarnings: 10500,
    platformFees: 1365,
    schedule: [
      {
        day: "Mon",
        time: "10:00 AM",
        player: "Liam Chen",
        status: "confirmed" as const,
      },
      {
        day: "Tue",
        time: "6:30 PM",
        player: "Marcus Johnson",
        status: "confirmed" as const,
      },
      {
        day: "Wed",
        time: "10:00 AM",
        player: "Sofia Reyes",
        status: "confirmed" as const,
      },
      {
        day: "Fri",
        time: "2:00 PM",
        player: "Alex Rivera",
        status: "pending" as const,
      },
    ],
  },
];

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

  /* ── Fetch Coaches from DB ── */
  useEffect(() => {
    async function loadCoaches() {
      const coaches = await getCoaches();
      if (coaches.length > 0) {
        setDbCoaches(coaches as unknown as Coach[]);
      }
      setCoachesLoaded(true);
    }
    loadCoaches();
  }, []);

  /* ── Fetch Coach Bookings & Details (for coach dashboard) ── */
  useEffect(() => {
    if (currentUser.role === "coach" && currentUser.isAuthenticated) {
      getCoachBookings().then((bookings) => {
        setRealBookings(bookings);
      });
      getMyCoachProfile().then((profile) => {
        if (profile) {
          setStripeOnboarded(profile.stripe_onboarding_complete);
        }
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
  const allCoaches =
    coachesLoaded && dbCoaches.length > 0 ? dbCoaches : COACHES;
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

            {filteredCoaches.length === 0 && (
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
          <div className="grid lg:grid-cols-3 gap-6 anim-fade-in-up">
            {/* Left: Video + Notes */}
            <div className="lg:col-span-2 space-y-6">
              {/* Video Player */}
              <div className="aspect-video bg-black/60 rounded-2xl border border-slate-800/50 flex items-center justify-center relative overflow-hidden group cursor-pointer glass-card p-0">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 to-violet-900/10 group-hover:from-indigo-900/20 group-hover:to-violet-900/20 transition-all duration-500" />
                <div className="text-center z-10 transition-transform duration-500 group-hover:scale-110">
                  <span className="text-5xl block mb-3 text-white/60 group-hover:text-white/90 transition-colors float-dot">
                    ▶
                  </span>
                  <p className="text-slate-500 font-mono text-xs tracking-wider uppercase">
                    Play VOD Review
                  </p>
                </div>
              </div>

              {/* Coach Notes */}
              <div className="glass-card p-6 md:p-7 hover:transform-none">
                <h3 className="font-bold text-sm mb-5 text-indigo-400 flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-pulse" />
                  Coach Notes
                </h3>
                <ul className="space-y-3 text-sm text-slate-300">
                  {[
                    {
                      time: "01:45",
                      note: "Body shape was closed when receiving. Open up your hips to see the full picture.",
                    },
                    {
                      time: "03:22",
                      note: "Great scanning before the pass. This is exactly the habit to build.",
                    },
                    {
                      time: "07:10",
                      note: "First touch too heavy under pressure. Cushion it with the inside of your foot.",
                    },
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/40 flex flex-col sm:flex-row gap-2 sm:gap-4 transition-all duration-200 hover:bg-slate-950/60 hover:border-slate-700/40"
                    >
                      <span className="text-indigo-400 font-mono font-bold text-xs shrink-0 mt-0.5 bg-indigo-500/10 px-2 py-1 rounded-md w-fit">
                        {item.time}
                      </span>
                      <p className="leading-relaxed">{item.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: Player Profile */}
            <div className="glass-card p-7 h-fit relative overflow-hidden hover:transform-none">
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-600/5 to-transparent pointer-events-none" />
              <div className="text-center mb-7 relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 mx-auto rounded-2xl mb-4 flex items-center justify-center text-3xl font-black shadow-xl shadow-indigo-600/20 rotate-3 hover:rotate-0 transition-transform duration-300">
                  A
                </div>
                <h2 className="text-xl font-extrabold uppercase tracking-tight">
                  Alex Rivera
                </h2>
                <p className="text-[10px] text-indigo-400 font-semibold tracking-[0.2em] uppercase mt-2 bg-indigo-900/15 inline-block px-3 py-1 rounded-full border border-indigo-500/15">
                  Midfielder
                </p>
              </div>
              <div className="relative z-10">
                <StatBar
                  label="Technical"
                  value={PLAYER_STATS.technical}
                  color="bg-indigo-500"
                  delay={100}
                />
                <StatBar
                  label="Tactical"
                  value={PLAYER_STATS.tactical}
                  color="bg-cyan-500"
                  delay={200}
                />
                <StatBar
                  label="Physical"
                  value={PLAYER_STATS.physical}
                  color="bg-emerald-500"
                  delay={300}
                />
                <StatBar
                  label="Mental"
                  value={PLAYER_STATS.mental}
                  color="bg-amber-500"
                  delay={400}
                />
              </div>
            </div>
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

            {/* Stripe Connect Banner */}
            {stripeOnboarded === false && (
              <div className="glass-card bg-indigo-950/30 border-indigo-900/40 p-5 md:p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 anim-fade-in-up">
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
                      alert("Failed to connect to Stripe.");
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
                  val: "$180.00",
                  color: "text-orange-400",
                  icon: "🔒",
                },
                {
                  label: "Available Payout",
                  val: "$425.50",
                  color: "text-emerald-400",
                  icon: "💰",
                },
                {
                  label: "Pending VODs",
                  val: "3",
                  color: "text-white",
                  icon: "📹",
                },
                {
                  label: "Platform Fee Paid",
                  val: "$65.50",
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
            <div className="glass-card overflow-hidden hover:transform-none">
              <div className="p-5 md:p-6 flex flex-col md:flex-row justify-between md:items-center border-b border-slate-800/50 gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                    <p className="font-bold">Alex Rivera (Midfielder)</p>
                  </div>
                  <p className="text-sm text-slate-400 ml-5">
                    Match footage uploaded 2 hours ago. Needs review.
                  </p>
                </div>
                <button className="bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-emerald-900/20 active:scale-[0.97] shrink-0">
                  Start VOD Review
                </button>
              </div>
              <div className="p-5 md:p-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <p className="font-bold">Jordan Mills (Striker)</p>
                  </div>
                  <p className="text-sm text-slate-400 ml-5">
                    Submitted game film yesterday. Awaiting your breakdown.
                  </p>
                </div>
                <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700/50 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97] shrink-0">
                  Review Later
                </button>
              </div>
            </div>

            {/* ── My Players ── */}
            <h3 className="text-base font-bold mb-4 mt-10 text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              My Players
              <span className="text-[10px] bg-slate-800/80 text-slate-500 px-2 py-0.5 rounded-full font-mono ml-1">
                {MY_PLAYERS.length}
              </span>
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
              {MY_PLAYERS.map((player) => (
                <div
                  key={player.id}
                  className="glass-card p-5 md:p-6 group relative overflow-hidden"
                >
                  {/* Subtle gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4 relative z-10">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${player.gradient} flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                    >
                      {player.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-white truncate">
                        {player.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="bg-slate-800/80 text-slate-300 text-[10px] px-2.5 py-0.5 rounded-lg font-semibold uppercase tracking-wider">
                          {player.position}
                        </span>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${
                            player.status === "vod-pending"
                              ? "bg-orange-500/10 text-orange-400 border-orange-500/25"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                          }`}
                        >
                          {player.status === "vod-pending"
                            ? "⏳ VOD PENDING"
                            : "✓ UP TO DATE"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mini Stats */}
                  <div className="grid grid-cols-4 gap-2 mb-4 relative z-10">
                    {[
                      {
                        label: "TEC",
                        val: player.stats.technical,
                        color: "text-indigo-400",
                      },
                      {
                        label: "TAC",
                        val: player.stats.tactical,
                        color: "text-cyan-400",
                      },
                      {
                        label: "PHY",
                        val: player.stats.physical,
                        color: "text-emerald-400",
                      },
                      {
                        label: "MEN",
                        val: player.stats.mental,
                        color: "text-amber-400",
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="text-center bg-slate-950/40 rounded-lg py-2 border border-slate-800/30"
                      >
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">
                          {s.label}
                        </p>
                        <p
                          className={`font-mono font-extrabold text-sm ${s.color}`}
                        >
                          {s.val}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Meta Info */}
                  <div className="space-y-2 text-sm relative z-10">
                    <div className="flex justify-between text-slate-400">
                      <span>Sessions</span>
                      <span className="text-white font-semibold font-mono">
                        {player.sessions}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>VODs Submitted</span>
                      <span className="text-white font-semibold font-mono">
                        {player.vodsSubmitted}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Next Session</span>
                      <span className="text-indigo-400 font-medium text-xs">
                        {player.nextSession}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Last Active</span>
                      <span className="text-slate-500 text-xs">
                        {player.lastActive}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    id={`view-player-${player.id}`}
                    className="w-full mt-5 py-3 rounded-xl font-semibold text-sm transition-all duration-300 bg-slate-800/60 text-slate-300 border border-slate-700/50 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-500 group-hover:shadow-lg group-hover:shadow-emerald-600/20 active:scale-[0.97] relative z-10"
                  >
                    View Player Profile
                  </button>
                </div>
              ))}
            </div>
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
                    val: COACH_SESSIONS.length.toString(),
                    color: "text-indigo-400",
                    icon: "⚽",
                  },
                  {
                    label: "Total Sessions",
                    val: COACH_SESSIONS.reduce(
                      (a, c) => a + c.totalSessions,
                      0,
                    ).toString(),
                    color: "text-white",
                    icon: "📊",
                  },
                  {
                    label: "Revenue (Fees)",
                    val: `$${COACH_SESSIONS.reduce((a, c) => a + c.platformFees, 0).toFixed(0)}`,
                    color: "text-emerald-400",
                    icon: "💰",
                  },
                  {
                    label: "Active Disputes",
                    val: "1",
                    color: "text-rose-400",
                    icon: "⚠️",
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

            {/* ── Coach Roster & Sessions ── */}
            <div>
              <h3 className="text-base font-bold mb-4 text-slate-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Coach Roster & Sessions
              </h3>
              <div className="space-y-5 stagger-children">
                {COACH_SESSIONS.map((coach) => (
                  <div
                    key={coach.coachId}
                    className="glass-card overflow-hidden hover:transform-none"
                  >
                    {/* Coach Header Row */}
                    <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/40">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${coach.gradient} flex items-center justify-center text-white font-bold text-base shadow-lg shrink-0`}
                        >
                          {coach.avatar}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-bold text-white">
                              {coach.name}
                            </h4>
                            {coach.verified ? (
                              <span className="text-[9px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/25 font-semibold">
                                ✓ VERIFIED
                              </span>
                            ) : (
                              <span className="text-[9px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/25 font-semibold">
                                ✗ UNVERIFIED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <Stars rating={coach.rating} />
                            <span className="font-medium">{coach.rating}</span>
                            <span>·</span>
                            <span>{coach.activePlayers} active players</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                            Total Sessions
                          </p>
                          <p className="font-mono font-bold text-white">
                            {coach.totalSessions}
                          </p>
                        </div>
                        <div className="h-8 w-px bg-slate-800/60 hidden md:block" />
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                            Earnings
                          </p>
                          <p className="font-mono font-bold text-emerald-400">
                            ${coach.totalEarnings.toLocaleString()}
                          </p>
                        </div>
                        <div className="h-8 w-px bg-slate-800/60 hidden md:block" />
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                            Fees Collected
                          </p>
                          <p className="font-mono font-bold text-slate-500">
                            ${coach.platformFees.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Session Schedule */}
                    <div className="p-5 md:p-6">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">
                        Upcoming Sessions
                      </p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {coach.schedule.map((session, si) => (
                          <div
                            key={si}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors duration-200 ${
                              session.status === "confirmed"
                                ? "bg-emerald-950/15 border-emerald-900/30 hover:border-emerald-700/40"
                                : session.status === "disputed"
                                  ? "bg-rose-950/15 border-rose-900/30 hover:border-rose-700/40"
                                  : "bg-slate-950/40 border-slate-800/40 hover:border-slate-700/50"
                            }`}
                          >
                            <div className="shrink-0">
                              <span
                                className={`w-2 h-2 rounded-full block ${
                                  session.status === "confirmed"
                                    ? "bg-emerald-500"
                                    : session.status === "disputed"
                                      ? "bg-rose-500 animate-pulse"
                                      : "bg-amber-500"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {session.player}
                              </p>
                              <p className="text-xs text-slate-500">
                                <span className="font-mono font-medium text-slate-400">
                                  {session.day}
                                </span>{" "}
                                · {session.time}
                              </p>
                            </div>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider shrink-0 ${
                                session.status === "confirmed"
                                  ? "text-emerald-400 bg-emerald-500/10"
                                  : session.status === "disputed"
                                    ? "text-rose-400 bg-rose-500/10"
                                    : "text-amber-400 bg-amber-500/10"
                              }`}
                            >
                              {session.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Active Disputes ── */}
            <div className="bg-rose-950/15 border border-rose-900/30 p-6 md:p-8 rounded-2xl">
              <h2 className="text-xl font-bold text-rose-400 flex items-center gap-3 mb-6">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.4)]" />
                Active Disputes
              </h2>
              <div className="bg-slate-950/60 rounded-xl border border-slate-800/50 overflow-hidden">
                <div className="p-5 md:p-7 flex flex-col lg:flex-row justify-between gap-6">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-rose-500/15 text-rose-400 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                        Flagged
                      </span>
                      <p className="font-bold">Session #88214A</p>
                    </div>
                    <p className="text-slate-400 text-sm mb-3">
                      Coach Sarah vs. Player Alex
                    </p>
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-rose-900/20">
                      <p className="text-sm text-slate-300 italic leading-relaxed">
                        &quot;Coach requested payment via CashApp before
                        reviewing the footage.&quot;
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5 w-full lg:w-auto bg-slate-900/40 p-4 rounded-xl border border-slate-800/40">
                    <button className="bg-slate-800/80 hover:bg-rose-600 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]">
                      Ban Coach (Circumvention)
                    </button>
                    <button className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]">
                      Refund Player Escrow
                    </button>
                  </div>
                </div>
              </div>
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
