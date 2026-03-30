"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { updateCoachProfile, getMyCoachProfile } from "@/app/actions/coaches";
import { createStripeConnectAccount } from "@/app/actions/stripe";

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

  const [experience, setExperience] = useState("");
  const [highlightUrl, setHighlightUrl] = useState("");
  type TimeSlot = { day: string; start: string; end: string };
  const [availability, setAvailability] = useState<TimeSlot[]>([]);
  const [profileData, setProfileData] = useState<any>(null);

  const [stripeOnboarded, setStripeOnboarded] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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
        setExperience(data.experience || "");
        setHighlightUrl(data.highlight_reel_url || "");
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
    const res = await createStripeConnectAccount(window.location.origin);
    if (res?.url) {
      window.location.href = res.url;
    } else {
      setMessage({ type: "error", text: res?.error || "Failed to initialize Stripe Connect." });
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
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
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
              PROFILE <span className="text-emerald-500">LAB</span>
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] opacity-80">
              Configure your marketplace presence
            </p>
          </div>
          <Link
            href="/"
            className="group flex items-center gap-2 bg-slate-900/80 border border-slate-800 text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-2xl text-slate-400 hover:text-white hover:border-slate-700 transition-all shadow-xl"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            Back to Arena
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Messages */}
          {message && (
            <div
              className={`p-4 rounded-xl text-sm border anim-fade-in ${
                message.type === "success"
                  ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-400"
                  : "bg-rose-950/30 border-rose-900/40 text-rose-400"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Style & Specialty Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Playing Style */}
            <div className="glass-card p-8 group/card">
              <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-5 ml-1">
                Athetic Philosophy
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    className={`px-3 py-3 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all duration-300 border-2 ${
                      style === s
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "bg-slate-950 border-slate-800/60 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Specialty Position */}
            <div className="glass-card p-8 group/card">
              <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-5 ml-1">
                Dominant Specialty
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SPECIALTIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpecialty(s)}
                    className={`px-3 py-3 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all duration-300 border-2 ${
                      specialty === s
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "bg-slate-950 border-slate-800/60 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hourly Rate */}
          <div className="glass-card p-8 group/card overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
            <div className="flex justify-between items-center mb-6">
              <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black ml-1">
                Contract Rate
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
                className="w-full h-1.5 bg-slate-950 rounded-full appearance-none cursor-pointer accent-emerald-500 ring-1 ring-slate-800/50 shadow-inner"
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-2 px-1">
              <span>Min $20</span>
              <span>Academy Standard</span>
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
                Mission Statement & Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={300}
                placeholder="What defines your coaching style? (e.g. Focus on ball mastery and tactical awareness)"
                className="w-full p-5 bg-slate-950/80 border border-slate-800 rounded-2xl focus:ring-2 ring-emerald-500/20 outline-none text-white text-[15px] leading-relaxed placeholder:text-slate-700 transition-all duration-300 focus:border-emerald-500/30 resize-none"
              />
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Maximum Impact: 300 Characters</span>
                <span className={`text-[10px] font-black ${bio.length > 250 ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {bio.length}/300
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Experience */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-4 ml-1">
                  Professional Pedigree
                </label>
                <div className="relative group/select">
                  <select
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full p-4 bg-slate-950 border border-slate-800 rounded-[1.25rem] appearance-none focus:ring-2 ring-emerald-500/20 outline-none text-white text-sm font-bold tracking-tight cursor-pointer"
                  >
                    <option value="" className="bg-slate-900">Select Credentials...</option>
                    <option value="Pro/Semi-Pro Player" className="bg-slate-900">Elite: Pro / Semi-Pro</option>
                    <option value="College Player (D1/D2/D3)" className="bg-slate-900">High Level Collegiate</option>
                    <option value="Certified Youth Coach" className="bg-slate-900">Tactical: Certified Coach</option>
                    <option value="High School Varsity" className="bg-slate-900">Varsity Veteran</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover/select:text-emerald-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Highlight URL */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-4 ml-1">
                  Reel Evidence (URL)
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                  </div>
                  <input
                    type="url"
                    value={highlightUrl}
                    onChange={(e) => setHighlightUrl(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="w-full p-4 pl-12 bg-slate-950 border border-slate-800 rounded-[1.25rem] focus:ring-2 ring-emerald-500/20 outline-none text-white text-sm font-medium transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Availability */}
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-6 ml-1">
                 Weekly Operation Schedule
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
                          ? "bg-slate-950/80 border-emerald-500/40 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
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
                            isSelected ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "bg-slate-900 text-slate-600 border border-slate-800"
                          }`}>
                            <span className="text-[11px] font-black transition-transform group-hover/toggle:scale-110">{day.toUpperCase()}</span>
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? "text-emerald-400" : "text-slate-600"}`}>
                            {isSelected ? `${daySlots.length} Slots Active` : "Closed"}
                          </span>
                        </button>
                        
                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => addSlot(day)}
                            className="text-[10px] bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-2"
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
                                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 outline-none focus:border-emerald-500/50 text-white font-mono font-bold text-xs transition-all"
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
                                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 outline-none focus:border-emerald-500/50 text-white font-mono font-bold text-xs transition-all"
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
              Escrow & Payout Integration
            </label>
            {stripeOnboarded ? (
              <div className="flex items-center gap-5 text-emerald-400 bg-emerald-500/5 p-6 rounded-[1.5rem] border border-emerald-500/20 shadow-xl">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-xl">✅</div>
                <div>
                  <p className="font-black text-base tracking-tight text-white">Stripe Vault Connected</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-400/60 mt-1">Operational & Ready for Deposits</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start gap-5 text-amber-400 bg-amber-500/5 p-6 rounded-[1.5rem] border border-amber-500/20">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-xl shrink-0">⚠️</div>
                  <div>
                    <p className="font-black text-base tracking-tight text-white mb-1">Financial Link Missing</p>
                    <p className="text-xs font-medium text-slate-400 leading-relaxed">You must connect your bank profile via Stripe to receive session payments. All funds are secured in escrow until session completion.</p>
                    <div className="mt-4 p-3 bg-red-900/50 text-red-100 text-[10px] font-mono whitespace-pre-wrap rounded-md border border-red-500/50">
                        RAW PROFILE DATA:
                        {JSON.stringify(profileData || { nullOrUndefined: true }, null, 2)}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    type="button"
                    disabled={connectingStripe}
                    onClick={handleStripeConnect}
                    className="flex-1 bg-white text-black hover:bg-slate-200 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 shadow-xl flex items-center justify-center gap-3 group/stripe"
                  >
                    {connectingStripe ? "Processing Link..." : "Stripe Connection Flow"}
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
                </div>
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div className="glass-card p-10 group/preview relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/[0.02] blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em] font-black">
                Marketplace Preview
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl relative">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-emerald-500/10">
                    {style?.[0] || specialty?.[0] || "?"}
                  </div>
                  <div>
                    <h3 className="font-black text-xl tracking-tighter text-white mb-1.5">Coach You</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] bg-slate-900 text-slate-400 px-3 py-1 rounded-full border border-slate-800 font-bold uppercase tracking-widest leading-none">
                         {specialty || "POSITION"}
                       </span>
                       <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-bold uppercase tracking-widest leading-none">
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
              <p className="text-slate-400 text-sm leading-relaxed font-medium italic opacity-80 border-l-2 border-emerald-500/30 pl-4 py-1">
                {bio || "Your mission statement will be displayed here for all prospective athletes..."}
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="gradient-btn w-full py-6 text-base uppercase tracking-[0.4em] shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:shadow-[0_30px_70px_rgba(16,185,129,0.4)] transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:grayscale mb-20"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-4">
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Encrypting Profile...
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
