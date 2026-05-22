"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { updateCoachProfile, getMyCoachProfile } from "@/app/actions/coaches";
import { createStripeConnectAccount } from "@/app/actions/stripe";
import { uploadHighlightReel, uploadProfilePicture } from "@/app/actions/upload";

const STYLES = [
  "Tiki-Taka",
  "Gegenpressing",
  "Catenaccio",
  "Target Man",
  "Total Football",
  "Counter-Attack",
  "Possession",
];

const SPECIALTIES = [
  "Midfield",
  "Striker",
  "Defense",
  "Goalkeeper",
  "Tactical",
  "Winger",
  "All Positions",
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface TimeSlot {
  day: string;
  start: string;
  end: string;
}

interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    housenumber?: string;
  };
}

export default function EditCoachProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [style, setStyle] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [rate, setRate] = useState(50);
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");

  const [experience, setExperience] = useState("");
  const [highlightUrl, setHighlightUrl] = useState("");
  const [availability, setAvailability] = useState<TimeSlot[]>([]);

  const [stripeOnboarded, setStripeOnboarded] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  /* ── Address Autocomplete State (Photon / OpenStreetMap) ── */
  const [suggestions, setSuggestions] = useState<{ displayLines: string[]; place: string }[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Debounced Photon Autocomplete ── */
  const handleLocationInput = useCallback((value: string) => {
    setLocation(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    setSuggestionsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5&lang=en`
        );
        const data = await res.json();
        const results = (data.features || []).map((f: PhotonFeature) => {
          const p = f.properties;
          const name = p.name || p.street || "";
          const city = p.city || p.town || p.village || "";
          const state = p.state || "";
          const country = p.country || "";
          const line1 = [name, p.housenumber].filter(Boolean).join(" ");
          const line2 = [city, state, country].filter(Boolean).join(", ");
          return {
            place: [line1 || city, line2].filter(Boolean).join(", "),
            displayLines: [line1 || city || name, line2].filter(Boolean),
          };
        });
        setSuggestions(results);
        setSuggestionsOpen(results.length > 0);
      } catch (err) {
        console.warn("Photon autocomplete error:", err);
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 350);
  }, []);

  /* ── Click outside to close suggestions ── */
  useEffect(() => {
    if (!suggestionsOpen) return;
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [suggestionsOpen]);

  const addSlot = (day: string) => {
    setAvailability((prev) => [...prev, { day, start: "09:00", end: "17:00" }]);
  };

  const removeSlot = (index: number) => {
    setAvailability((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleDay = (day: string) => {
    const daySlots = availability.filter((s) => s.day === day);
    if (daySlots.length > 0) {
      setAvailability((prev) => prev.filter((s) => s.day !== day));
    } else {
      addSlot(day);
    }
  };

  async function refreshStripeStatus() {
    setIsSyncing(true);
    const data = await getMyCoachProfile();
    if (data?.stripe_onboarding_complete) {
      setStripeOnboarded(true);
      setMessage({ type: "success", text: "Stripe connection verified!" });
    } else if (data?.dbError) {
      setMessage({ type: "error", text: `Database Issue: ${data.dbError}` });
    } else if (data?.stripeDiagnostic) {
      setMessage({ type: "error", text: `Stripe Alert: ${data.stripeDiagnostic}. Ensure you finished the bank/identity steps.` });
    } else {
      setMessage({ 
        type: "error", 
        text: "Stripe reports onboarding is still incomplete. Please ensure you've finished all steps in the Stripe dashboard." 
      });
    }
    setIsSyncing(false);
  }

  useEffect(() => {
    async function loadProfile() {
      const data = await getMyCoachProfile();

      if (data) {
        setStyle(data.style || "");
        setSpecialty(data.specialty || "");
        setRate(data.rate || 50);
        setBio(data.bio || "");
        setLocation(data.location || "");
        setExperience(data.experience || "");
        setHighlightUrl(data.highlight_reel_url || "");
        setAvatarUrl(data.avatar_url || "");
        if (data.availability) {
          let slots: TimeSlot[] = [];
          if (Array.isArray(data.availability)) {
            slots = data.availability.map((s: { day?: string; start?: string; end?: string } | string) => {
              if (typeof s === 'string') {
                 const match = s.match(/^([A-Za-z]+):\s*(.*)\s*-\s*(.*)$/);
                 return match ? { day: match[1], start: match[2], end: match[3] } : null;
              }
              return s;
            }).filter(Boolean) as TimeSlot[];
          }
          setAvailability(slots);
        }
        setStripeOnboarded(data.stripe_onboarding_complete || false);
      }
      setLoading(false);
    }
    loadProfile();

    // Check for return from Stripe
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") === "success") {
       refreshStripeStatus();
       // Clear URL
       window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleStripeConnect() {
    setConnectingStripe(true);
    try {
      const res = await createStripeConnectAccount(window.location.origin);
      if (res?.url) {
        window.location.href = res.url;
      } else if (res?.alreadyComplete) {
        window.location.reload();
      } else {
        setMessage({ type: "error", text: res?.error || "Failed to initialize Stripe Connect." });
        setConnectingStripe(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error connecting to Stripe";
      setMessage({ type: "error", text: msg });
      setConnectingStripe(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData();
    formData.set("style", style);
    formData.set("specialty", specialty);
    formData.set("rate", rate.toString());
    formData.set("bio", bio);
    formData.set("experience", experience);
    formData.set("highlight_reel_url", highlightUrl);
    formData.set("availability", JSON.stringify(availability));
    formData.set("location", location);

    const result = await updateCoachProfile(formData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({
        type: "success",
        text: "Profile updated! Players can now find you.",
      });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] relative px-4 py-8">
      <div className="max-w-3xl mx-auto relative z-10 anim-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-1">
              Edit <span className="text-[var(--accent)]">Profile</span>
            </h1>
            <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
              Manage your coach training hub
            </p>
          </div>
          <Link
            href="/"
            className="group flex items-center gap-1.5 bg-white border border-[var(--border-default)] text-xs font-medium px-4 py-2 rounded-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all shadow-sm"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Home
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Messages */}
          {message && (
            <div
              className={`p-4 rounded-none text-sm border anim-fade-in ${
                message.type === "success"
                  ? "bg-[var(--accent-subtle)] border-[var(--accent)]/40 text-[var(--accent)] font-medium"
                  : "bg-red-50 border-red-200 text-red-700 font-medium"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Profile Picture & General details */}
          <div className="bg-white border border-[var(--border-default)] rounded-none p-6 shadow-sm">
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-4">
              📸 Profile Picture
            </label>
            <div className="flex items-center gap-6">
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="relative w-24 h-24 rounded-none bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] font-bold text-2xl shadow-sm cursor-pointer overflow-hidden border border-[var(--border-default)] hover:border-[var(--accent)] transition-all"
              >
                {uploadingAvatar ? (
                  <span className="w-6 h-6 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
                ) : avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Profile"
                    className="object-cover"
                    fill
                    sizes="96px"
                  />
                ) : (
                  <span className="text-[var(--text-muted)]">{style?.[0] || specialty?.[0] || "?"}</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold uppercase tracking-wider">Change</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)] mb-0.5">{avatarUrl ? "Looking good!" : "Add a profile photo"}</p>
                <p className="text-xs text-[var(--text-muted)] font-normal">JPG, PNG, or WebP · Max 5MB</p>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className="text-xs text-red-600 font-semibold uppercase mt-2 hover:underline tracking-wide"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingAvatar(true);
                setMessage(null);
                const fd = new FormData();
                fd.append("file", file);
                const result = await uploadProfilePicture(fd);
                if (result.error) {
                  setMessage({ type: "error", text: result.error });
                } else if (result.url) {
                  setAvatarUrl(result.url);
                  setMessage({ type: "success", text: "Profile photo updated!" });
                }
                setUploadingAvatar(false);
                e.target.value = "";
              }}
            />
          </div>

          {/* Specialty (Position) */}
          <div className="bg-white border border-[var(--border-default)] rounded-none p-6 shadow-sm">
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-4">
              ⚽ Specialties / Positions
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SPECIALTIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpecialty(s)}
                  className={`px-3 py-2.5 rounded-none text-xs font-semibold transition-all border ${
                    specialty === s
                      ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]"
                      : "bg-white border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Coaching Style */}
          <div className="bg-white border border-[var(--border-default)] rounded-none p-6 shadow-sm">
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-4">
              🧠 Primary Coaching Style
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STYLES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStyle(st)}
                  className={`px-3 py-2.5 rounded-none text-xs font-semibold transition-all border ${
                    style === st
                      ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]"
                      : "bg-white border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Hourly Rate */}
          <div className="bg-white border border-[var(--border-default)] rounded-none p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold">
                Hourly Rate
              </label>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  ${rate}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-bold">/ HR</span>
              </div>
            </div>
            <div className="relative h-10 flex items-center">
              <input
                type="range"
                min="20"
                max="250"
                step="5"
                value={rate}
                onChange={(e) => setRate(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-none appearance-none cursor-pointer accent-[var(--accent)] border border-[var(--border-default)]"
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-semibold uppercase mt-1">
              <span>Min $20</span>
              <span>Average</span>
              <span>Max $250</span>
            </div>
          </div>

          {/* Bio & Details */}
          <div className="bg-white border border-[var(--border-default)] rounded-none p-6 space-y-6 shadow-sm">
            {/* Bio */}
            <div>
              <label
                htmlFor="bio"
                className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-3"
              >
                Your Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={300}
                placeholder="Describe your credentials, methodology, and coaching philosophy..."
                className="w-full p-4 bg-white border border-[var(--border-default)] rounded-none focus:ring-2 focus:ring-[var(--accent)]/15 focus:border-[var(--accent)] outline-none text-[var(--text-primary)] text-sm leading-relaxed placeholder:text-[var(--text-tertiary)] transition-all resize-none"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] text-[var(--text-muted)] font-medium">300 characters max</span>
                <span className={`text-xs font-bold ${bio.length > 250 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                  {bio.length}/300
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Experience */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-3">
                  Experience Level
                </label>
                <div className="relative">
                  <select
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full p-3.5 bg-white border border-[var(--border-default)] rounded-none appearance-none focus:ring-2 focus:ring-[var(--accent)]/15 focus:border-[var(--accent)] outline-none text-[var(--text-primary)] text-sm font-semibold cursor-pointer"
                  >
                    <option value="">Select experience...</option>
                    <option value="Pro/Semi-Pro Player">Pro / Semi-Pro Player</option>
                    <option value="College Player (D1/D2/D3)">College Player (D1/D2/D3)</option>
                    <option value="Certified Youth Coach">Certified Coach</option>
                    <option value="High School Varsity">High School Varsity</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Highlight Video Upload */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-3">
                  🎬 Highlight Clip (15 sec)
                </label>

                {highlightUrl ? (
                  <div className="space-y-3">
                    <div className="relative rounded-none overflow-hidden border border-[var(--border-default)] bg-black">
                      <video
                        src={highlightUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-40 object-cover opacity-95"
                      />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] bg-white px-3 py-1 rounded-none border border-[var(--border-default)] shadow-sm">
                          Preview
                        </span>
                        <button
                          type="button"
                          onClick={() => setHighlightUrl("")}
                          className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-white px-3 py-1 rounded-none border border-[var(--border-default)] shadow-sm hover:bg-red-50 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => videoInputRef.current?.click()}
                    className="relative cursor-pointer border border-dashed border-[var(--border-default)] hover:border-[var(--accent)] rounded-none p-6 text-center transition-all bg-[var(--bg-secondary)]/50 hover:bg-white"
                  >
                    {uploadingVideo ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="w-6 h-6 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
                        <span className="text-xs font-semibold text-[var(--accent)]">Uploading video...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 mx-auto mb-2 bg-white rounded-none flex items-center justify-center text-xl border border-[var(--border-default)] shadow-sm">
                          🎥
                        </div>
                        <p className="text-xs font-bold text-[var(--text-secondary)] mb-0.5">Upload highlight clip</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-normal">
                          MP4, MOV, or WebM · Max 50MB
                        </p>
                      </>
                    )}
                  </div>
                )}

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingVideo(true);
                    setMessage(null);
                    const fd = new FormData();
                    fd.append("file", file);
                    const result = await uploadHighlightReel(fd);
                    if (result.error) {
                      setMessage({ type: "error", text: result.error });
                    } else if (result.url) {
                      setHighlightUrl(result.url);
                      setMessage({ type: "success", text: "Highlight video uploaded!" });
                    }
                    setUploadingVideo(false);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {/* Location with Autocomplete */}
            <div ref={suggestionsRef} className="relative">
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-3">
                📍 Training Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => handleLocationInput(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setSuggestionsOpen(true); }}
                  onKeyDown={(e) => { if (e.key === "Escape") setSuggestionsOpen(false); }}
                  placeholder="Start typing an address or training field name..."
                  className="w-full p-3.5 bg-white border border-[var(--border-default)] rounded-none focus:ring-2 focus:ring-[var(--accent)]/15 focus:border-[var(--accent)] outline-none text-[var(--text-primary)] text-sm font-semibold transition-all placeholder:text-[var(--text-tertiary)]"
                />
                {suggestionsLoading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <span className="w-4 h-4 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin block" />
                  </div>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {suggestionsOpen && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-[var(--border-default)] rounded-none overflow-hidden shadow-lg anim-fade-in">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setLocation(s.place || s.displayLines?.join(", ") || "");
                        setSuggestionsOpen(false);
                        setSuggestions([]);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border-default)]/50 last:border-b-0 flex items-start gap-2 group/suggestion"
                    >
                      <span className="text-[var(--accent)] text-sm shrink-0">📍</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {s.displayLines?.[0] || "Unknown"}
                        </p>
                        {s.displayLines?.[1] && (
                          <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                            {s.displayLines[1]}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                  <div className="px-4 py-2 bg-[var(--bg-secondary)]/50 border-t border-[var(--border-default)]">
                    <span className="text-[10px] text-[var(--text-muted)] font-medium">Powered by OpenStreetMap</span>
                  </div>
                </div>
              )}
            </div>

            {/* Availability */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-4">
                 Weekly Availability / Training Hours
              </label>
              <div className="grid gap-3">
                {DAYS_OF_WEEK.map((day) => {
                  const daySlots = availability.filter((s) => s.day === day);
                  const isSelected = daySlots.length > 0;

                  return (
                    <div
                      key={day}
                      className={`flex flex-col gap-4 p-4 rounded-none border transition-all ${
                        isSelected
                          ? "bg-white border-[var(--accent)] shadow-sm"
                          : "bg-[var(--bg-secondary)]/40 border-[var(--border-default)] opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleDay(day)}
                          className="flex items-center gap-3 cursor-pointer group/toggle"
                        >
                          <div className={`w-9 h-9 rounded-none flex items-center justify-center transition-all ${
                            isSelected ? "bg-[var(--accent)] text-white" : "bg-white text-[var(--text-secondary)] border border-[var(--border-default)]"
                          }`}>
                            <span className="text-[10px] font-bold">{day.toUpperCase()}</span>
                          </div>
                          <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                            {isSelected ? `${daySlots.length} slot${daySlots.length > 1 ? 's' : ''} active` : "Closed"}
                          </span>
                        </button>
                        
                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => addSlot(day)}
                            className="text-[10px] bg-[var(--accent-subtle)] text-[var(--accent)] px-2.5 py-1.5 rounded-none border border-[var(--accent)]/20 font-bold uppercase tracking-wider hover:bg-[var(--accent)]/10 transition-all flex items-center gap-1"
                          >
                            <span>Add Break</span>
                            <span className="text-xs">+</span>
                          </button>
                        )}
                      </div>

                      {isSelected && (
                        <div className="grid gap-2 anim-fade-in pl-1 sm:pl-12">
                          {availability.map((s, idx) => {
                            if (s.day !== day) return null;
                            return (
                              <div key={`${day}-${idx}`} className="flex items-center gap-3 bg-[var(--bg-secondary)]/50 p-2.5 rounded-none border border-[var(--border-default)] animate-slide-in">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="time"
                                    value={s.start}
                                    onChange={(e) => {
                                      setAvailability(
                                        availability.map((slot, i) => (i === idx ? { ...slot, start: e.target.value } : slot)),
                                      );
                                    }}
                                    className="bg-white border border-[var(--border-default)] rounded-none px-2 py-1 focus:ring-1 focus:ring-[var(--accent)] outline-none text-[var(--text-primary)] font-mono font-bold text-xs"
                                  />
                                  <span className="text-[var(--text-muted)] font-bold text-[10px] uppercase">to</span>
                                  <input
                                    type="time"
                                    value={s.end}
                                    onChange={(e) => {
                                      setAvailability(
                                        availability.map((slot, i) => (i === idx ? { ...slot, end: e.target.value } : slot)),
                                      );
                                    }}
                                    className="bg-white border border-[var(--border-default)] rounded-none px-2 py-1 focus:ring-1 focus:ring-[var(--accent)] outline-none text-[var(--text-primary)] font-mono font-bold text-xs"
                                  />
                                </div>
                                
                                {daySlots.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSlot(idx)}
                                    className="ml-auto w-6 h-6 rounded-none flex items-center justify-center text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 transition-all text-sm font-semibold"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stripe Payouts */}
          <div className="bg-white border border-[var(--border-default)] rounded-none p-6 relative overflow-hidden shadow-sm">
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-4">
              💳 Stripe Payment Dashboard
            </label>
            {stripeOnboarded ? (
              <div className="flex items-center gap-4 text-[var(--accent)] bg-[var(--accent-subtle)] p-5 rounded-none border border-[var(--accent)]/20">
                <div className="w-10 h-10 bg-white rounded-none flex items-center justify-center text-base border border-[var(--accent)]/10 shadow-sm">✅</div>
                <div>
                  <p className="font-bold text-sm text-[var(--text-primary)]">Stripe Connect Account Verified</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] mt-0.5">Live and ready to receive bookings and direct payouts</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-4 text-amber-700 bg-amber-50 p-5 rounded-none border border-amber-200">
                  <div className="w-10 h-10 bg-white rounded-none flex items-center justify-center text-lg shrink-0 border border-amber-200 shadow-sm">⚠️</div>
                  <div>
                    <p className="font-bold text-sm text-amber-800 mb-0.5">Payout Setup Required</p>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">To activate your public coach card and accept players, you must securely link your bank account or debit card via Stripe.</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={connectingStripe}
                    onClick={handleStripeConnect}
                    className="flex-1 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] py-3 rounded-none text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 group/stripe"
                  >
                    {connectingStripe ? "Connecting..." : "Connect Stripe Account"}
                    <svg className="w-4 h-4 transition-transform group-hover/stripe:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={refreshStripeStatus}
                    className="flex-1 bg-white border border-[var(--border-default)] hover:border-[var(--text-muted)] text-[var(--text-secondary)] py-3 rounded-none text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 group/sync"
                  >
                    {isSyncing ? (
                       <span className="w-4 h-4 border-2 border-[var(--text-muted)]/20 border-t-[var(--text-muted)] rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 transition-transform group-hover/sync:rotate-180 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    )}
                    Refresh Status
                  </button>

                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={async () => {
                      const { resetStripeConnection } = await import('@/app/actions/stripe');
                      if (confirm("Are you sure you want to delete and reset your linked Stripe account? This will restart the setup process.")) {
                         setIsSyncing(true);
                         const res = await resetStripeConnection();
                         if (res.success) {
                           window.location.reload();
                         } else {
                           setMessage({ type: "error", text: `Reset failed: ${res.error}` });
                           setIsSyncing(false);
                         }
                      }
                    }}
                    className="bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 py-3 px-4 rounded-none text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm flex items-center justify-center group/reset"
                    title="Reset Stripe connection"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div className="bg-white border border-[var(--border-default)] rounded-none p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-none bg-[var(--accent)] animate-pulse" />
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold">
                Marketplace Card Preview
              </p>
            </div>

            <div className="max-w-sm mx-auto bg-white border border-[var(--border-default)] rounded-none overflow-hidden shadow-sm hover:border-[var(--accent)] transition-all">
              <div className="relative h-48 bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-tertiary)] overflow-hidden">
                {highlightUrl ? (
                  <video
                    src={highlightUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Preview"
                    className="object-cover"
                    fill
                    sizes="350px"
                  />
                ) : (
                  <span className="text-5xl">⚽</span>
                )}
                <div className="absolute top-3 left-3 bg-white px-2 py-1 rounded-none text-[10px] font-bold text-[var(--text-primary)] border border-[var(--border-default)] shadow-xs">
                  {specialty || "POSITION"}
                </div>
                {style && (
                  <div className="absolute top-3 right-3 bg-[var(--accent)] text-white px-2 py-1 rounded-none text-[10px] font-bold shadow-xs">
                    {style}
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-base text-[var(--text-primary)] leading-tight">Coach You</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{location || "Training Location"}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg text-[var(--accent)]">${rate}</span>
                    <span className="text-[10px] text-[var(--text-muted)] block font-semibold leading-none">/ hr</span>
                  </div>
                </div>
                <p className="text-[var(--text-secondary)] text-xs line-clamp-2 leading-relaxed italic border-l border-[var(--border-default)] pl-2.5 py-0.5">
                  {bio || "Your profile bio will be displayed here for soccer players to browse..."}
                </p>
                <div className="mt-4 pt-3 border-t border-[var(--border-default)]/60 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs">
                    <span>★ 5.0</span>
                    <span className="text-[10px] font-normal">(0 sessions)</span>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">View Profile →</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white py-4 rounded-none text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 active:scale-[0.99] shadow-sm flex items-center justify-center"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Saving Profile...
              </span>
            ) : (
              "Save Profile & Go Live"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
