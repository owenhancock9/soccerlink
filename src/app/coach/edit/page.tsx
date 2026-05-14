"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
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
  type TimeSlot = { day: string; start: string; end: string };
  const [availability, setAvailability] = useState<TimeSlot[]>([]);
  const [profileData, setProfileData] = useState<any>(null);

  const [stripeOnboarded, setStripeOnboarded] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
    setProfileData(data);
    if (data?.stripe_onboarding_complete) {
      setStripeOnboarded(true);
      setMessage({ type: "success", text: "Stripe connection verified!" });
    } else if (data?.error) {
      setMessage({ type: "error", text: `Database Issue: ${data.error}` });
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
          // Fallback handle for old string format if any exists, but primarily expect JSON
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
      setProfileData(data);
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
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Unknown error connecting to Stripe" });
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
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-slate-100 relative px-4 py-8">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] bg-emerald-600/[0.04] rounded-full blur-[120px]" />
        <div className="absolute -bottom-[30%] -right-[20%] w-[50%] h-[50%] bg-teal-600/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10 anim-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white mb-2">
              EDIT <span className="text-pink-400">PROFILE</span>
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] opacity-80">
              Edit your coach profile
            </p>
          </div>
          <Link
            href="/"
            className="group flex items-center gap-2 bg-slate-900/80 border border-slate-800 text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:border-slate-700 transition-all shadow-xl"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            Back to Home
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Messages */}
          {message && (
            <div
              className={`p-4 rounded-xl text-sm border anim-fade-in ${
                message.type === "success"
                  ? "bg-emerald-950/30 border-emerald-900/40 text-pink-400"
                  : "bg-rose-950/30 border-rose-900/40 text-rose-400"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Style & Specialty Grid */}

          {/* Profile Picture */}
          <div className="glass-card p-8 group/card">
            <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-5 ml-1">
              📸 Profile Picture
            </label>
            <div className="flex items-center gap-8">
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-black text-3xl shadow-2xl cursor-pointer group/pfp overflow-hidden border-2 border-white/10 hover:border-pink-400/50 transition-all"
              >
                {uploadingAvatar ? (
                  <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="group-hover/pfp:scale-110 transition-transform">{style?.[0] || specialty?.[0] || "?"}</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/pfp:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-xs font-black uppercase tracking-widest">Change</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-1">{avatarUrl ? "Looking good!" : "Add a profile photo"}</p>
                <p className="text-[10px] text-slate-500 font-medium">JPG, PNG, or WebP · Max 5MB</p>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className="text-[10px] text-rose-400 font-black uppercase tracking-widest mt-2 hover:underline"
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

          {/* Position */}
          <div className="glass-card p-8 group/card">
            <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-5 ml-1">
              Position
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SPECIALTIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpecialty(s)}
                  className={`px-3 py-3 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all duration-300 border-2 ${
                    specialty === s
                      ? "bg-pink-400/10 border-pink-400/50 text-pink-400 shadow-[0_0_20px_rgba(236,132,191,0.15)]"
                      : "bg-slate-950 border-slate-800/60 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Hourly Rate */}
          <div className="glass-card p-8 group/card overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-400/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
            <div className="flex justify-between items-center mb-6">
              <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black ml-1">
                Hourly Rate
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-3xl font-black text-white tracking-tighter">
                  ${rate}.00
                </span>
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">/ HR</span>
              </div>
            </div>
            <div className="relative h-12 flex items-center">
              <input
                type="range"
                min="20"
                max="250"
                step="5"
                value={rate}
                onChange={(e) => setRate(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-950 rounded-full appearance-none cursor-pointer accent-pink-400 ring-1 ring-slate-800/50 shadow-inner"
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-2 px-1">
              <span>Min $20</span>
              <span>Average</span>
              <span>Max $250</span>
            </div>
          </div>

          {/* Bio & Details */}
          <div className="glass-card p-8 space-y-10">
            {/* Bio */}
            <div>
              <label
                htmlFor="bio"
                className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-4 ml-1"
              >
                Your Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={300}
                placeholder="Tell players about yourself and your coaching style..."
                className="w-full p-5 bg-slate-950/80 border border-slate-800 rounded-2xl focus:ring-2 ring-pink-400/20 outline-none text-white text-[15px] leading-relaxed placeholder:text-slate-700 transition-all duration-300 focus:border-pink-400/30 resize-none"
              />
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">300 characters max</span>
                <span className={`text-[10px] font-black ${bio.length > 250 ? 'text-pink-400' : 'text-slate-600'}`}>
                  {bio.length}/300
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Experience */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-4 ml-1">
                  Experience Level
                </label>
                <div className="relative group/select">
                  <select
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full p-4 bg-slate-950 border border-slate-800 rounded-[1.25rem] appearance-none focus:ring-2 ring-pink-400/20 outline-none text-white text-sm font-bold tracking-tight cursor-pointer"
                  >
                    <option value="" className="bg-slate-900">Select experience...</option>
                    <option value="Pro/Semi-Pro Player" className="bg-slate-900">Pro / Semi-Pro Player</option>
                    <option value="College Player (D1/D2/D3)" className="bg-slate-900">College Player (D1/D2/D3)</option>
                    <option value="Certified Youth Coach" className="bg-slate-900">Certified Coach</option>
                    <option value="High School Varsity" className="bg-slate-900">High School Varsity</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover/select:text-pink-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Highlight Video Upload */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-4 ml-1">
                  🎬 Highlight Clip (15 sec)
                </label>

                {highlightUrl ? (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                      <video
                        src={highlightUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-pink-400 bg-pink-400/10 px-3 py-1 rounded-full border border-pink-400/20">
                          Live Preview
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setHighlightUrl("");
                          }}
                          className="text-[9px] font-black uppercase tracking-widest text-rose-400 bg-rose-400/10 px-3 py-1 rounded-full border border-rose-400/20 hover:bg-rose-400/20 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => videoInputRef.current?.click()}
                    className="relative cursor-pointer border-2 border-dashed border-slate-800 hover:border-pink-400/40 rounded-2xl p-8 text-center transition-all duration-500 hover:bg-pink-400/[0.02] group/upload"
                  >
                    {uploadingVideo ? (
                      <div className="flex flex-col items-center gap-3">
                        <span className="w-8 h-8 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-pink-400">Uploading...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 mx-auto mb-3 bg-slate-900 rounded-2xl flex items-center justify-center text-2xl border border-slate-800 group-hover/upload:border-pink-400/30 group-hover/upload:scale-110 transition-all">
                          🎥
                        </div>
                        <p className="text-sm font-bold text-slate-400 mb-1">Upload a 15-second highlight clip</p>
                        <p className="text-[10px] text-slate-600 font-medium">
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
                      setMessage({ type: "success", text: "Highlight video uploaded! It will show on your coach card." });
                    }
                    setUploadingVideo(false);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-4 ml-1">
                📍 Training Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Memorial Park, Houston TX"
                className="w-full p-4 bg-slate-950 border border-slate-800 rounded-[1.25rem] focus:ring-2 ring-pink-400/20 outline-none text-white text-sm font-medium transition-all focus:border-pink-400/30 placeholder:text-slate-700"
              />
              <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-2 ml-1">Where do you normally hold sessions?</p>
            </div>

            {/* Availability */}
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-6 ml-1">
                 Weekly Availability
              </label>
              <div className="grid gap-4">
                {DAYS_OF_WEEK.map((day) => {
                  const daySlots = availability.filter((s) => s.day === day);
                  const isSelected = daySlots.length > 0;

                  return (
                    <div
                      key={day}
                      className={`flex flex-col gap-5 p-6 rounded-2xl border transition-all duration-500 ${
                        isSelected
                          ? "bg-slate-950/80 border-pink-400/40 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
                          : "bg-slate-950/20 border-slate-900 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleDay(day)}
                          className="flex items-center gap-4 cursor-pointer group/toggle"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                            isSelected ? "bg-pink-400 text-white shadow-[0_0_15px_rgba(236,132,191,0.4)]" : "bg-slate-900 text-slate-600 border border-slate-800"
                          }`}>
                            <span className="text-[11px] font-black transition-transform group-hover/toggle:scale-110">{day.toUpperCase()}</span>
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? "text-pink-400" : "text-slate-600"}`}>
                            {isSelected ? `${daySlots.length} Slots Active` : "Closed"}
                          </span>
                        </button>
                        
                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => addSlot(day)}
                            className="text-[10px] bg-pink-400/10 text-pink-400 px-3 py-1.5 rounded-lg border border-pink-400/20 font-black uppercase tracking-widest hover:bg-pink-400/20 transition-all flex items-center gap-2"
                          >
                            <span>Add Break</span>
                            <span className="text-sm">+</span>
                          </button>
                        )}
                      </div>

                      {isSelected && (
                        <div className="grid gap-3 anim-fade-in pl-1 sm:pl-14">
                          {availability.map((s, idx) => {
                            if (s.day !== day) return null;
                            return (
                              <div key={`${day}-${idx}`} className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800 animate-slide-in">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="time"
                                    value={s.start}
                                    onChange={(e) => {
                                      setAvailability(
                                        availability.map((slot, i) => (i === idx ? { ...slot, start: e.target.value } : slot)),
                                      );
                                    }}
                                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 outline-none focus:border-pink-400/50 text-white font-mono font-bold text-xs transition-all"
                                  />
                                  <span className="text-slate-700 font-bold text-[10px] uppercase">to</span>
                                  <input
                                    type="time"
                                    value={s.end}
                                    onChange={(e) => {
                                      setAvailability(
                                        availability.map((slot, i) => (i === idx ? { ...slot, end: e.target.value } : slot)),
                                      );
                                    }}
                                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 outline-none focus:border-pink-400/50 text-white font-mono font-bold text-xs transition-all"
                                  />
                                </div>
                                
                                {daySlots.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSlot(idx)}
                                    className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
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
          <div className="glass-card p-8 border-cyan-500/20 bg-cyan-500/[0.02] relative overflow-hidden group/payout">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
            <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-5 ml-1">
              Payment Setup
            </label>
            {stripeOnboarded ? (
              <div className="flex items-center gap-5 text-pink-400 bg-pink-400/5 p-6 rounded-[1.5rem] border border-pink-400/20 shadow-xl">
                <div className="w-12 h-12 bg-pink-400/20 rounded-2xl flex items-center justify-center text-xl">✅</div>
                <div>
                  <p className="font-black text-base tracking-tight text-white">Stripe Connected</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-pink-400/60 mt-1">Ready to receive payments</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start gap-5 text-amber-400 bg-amber-500/5 p-6 rounded-[1.5rem] border border-amber-500/20">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-xl shrink-0">⚠️</div>
                  <div>
                    <p className="font-black text-base tracking-tight text-white mb-1">Payment Setup Needed</p>
                    <p className="text-xs font-medium text-slate-400 leading-relaxed">Connect your bank account through Stripe to get paid for sessions.</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    type="button"
                    disabled={connectingStripe}
                    onClick={handleStripeConnect}
                    className="flex-1 bg-white text-black hover:bg-slate-200 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 shadow-xl flex items-center justify-center gap-3 group/stripe"
                  >
                    {connectingStripe ? "Connecting..." : "Connect Stripe"}
                    <svg className="w-4 h-4 transition-transform group-hover/stripe:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={refreshStripeStatus}
                    className="flex-1 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-white py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 shadow-xl flex items-center justify-center gap-3 group/sync"
                  >
                    {isSyncing ? (
                       <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 transition-transform group-hover/sync:rotate-180 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    )}
                    Refresh Connection Status
                  </button>

                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={async () => {
                      const { resetStripeConnection } = await import('@/app/actions/stripe');
                      if (confirm("This will completely erase your current Stripe connection so you can start the process over. Are you sure you want to restart?")) {
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
                    className="flex-shrink bg-red-500/10 border border-red-500/50 hover:bg-red-500/20 text-red-500 py-4 px-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 shadow-xl flex items-center justify-center group/reset"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div className="glass-card p-10 group/preview relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-400/[0.02] blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-8">
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em] font-black">
                Marketplace Preview
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl relative">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-pink-400/10">
                    {style?.[0] || specialty?.[0] || "?"}
                  </div>
                  <div>
                    <h3 className="font-black text-xl tracking-tighter text-white mb-1.5">Coach You</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] bg-slate-900 text-slate-400 px-3 py-1 rounded-full border border-slate-800 font-bold uppercase tracking-widest leading-none">
                         {specialty || "POSITION"}
                       </span>
                       <span className="text-[9px] bg-pink-400/10 text-pink-400 px-3 py-1 rounded-full border border-pink-400/20 font-bold uppercase tracking-widest leading-none">
                         {style || "STYLE"}
                       </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white tracking-widest leading-none mb-1">
                    ${rate}
                  </div>
                  <div className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">PER HOUR</div>
                </div>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed font-medium italic opacity-80 border-l-2 border-pink-400/30 pl-4 py-1">
                {bio || "Your bio will show here for players to read..."}
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="gradient-btn w-full py-6 text-base uppercase tracking-[0.4em] shadow-[0_20px_50px_rgba(236,132,191,0.3)] hover:shadow-[0_30px_70px_rgba(236,132,191,0.4)] transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:grayscale mb-20"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-4">
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Saving...
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
