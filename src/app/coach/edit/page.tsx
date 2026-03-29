"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";
import { updateCoachProfile } from "@/app/actions/coaches";

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

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("coach_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setStyle(data.style || "");
        setSpecialty(data.specialty || "");
        setRate(data.rate || 50);
        setBio(data.bio || "");
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData();
    formData.set("style", style);
    formData.set("specialty", specialty);
    formData.set("rate", rate.toString());
    formData.set("bio", bio);

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

      <div className="max-w-2xl mx-auto relative z-10 anim-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Edit <span className="text-emerald-400">Coach Profile</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              This is how players will see you in the marketplace.
            </p>
          </div>
          <Link
            href="/"
            className="bg-slate-800/60 border border-slate-700/50 text-sm font-medium px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/60 transition-all"
          >
            ← Back
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

          {/* Playing Style */}
          <div className="glass-card p-6 hover:transform-none">
            <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">
              Playing Style
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                    style === s
                      ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-900/20"
                      : "bg-slate-900/40 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Specialty Position */}
          <div className="glass-card p-6 hover:transform-none">
            <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">
              Specialty Position
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SPECIALTIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpecialty(s)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                    specialty === s
                      ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-900/20"
                      : "bg-slate-900/40 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Hourly Rate */}
          <div className="glass-card p-6 hover:transform-none">
            <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">
              Hourly Rate
            </label>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-black text-emerald-400 font-mono">
                ${rate}
              </span>
              <span className="text-slate-600 text-sm">/hr</span>
            </div>
            <input
              type="range"
              min="20"
              max="200"
              step="5"
              value={rate}
              onChange={(e) => setRate(parseInt(e.target.value))}
              className="w-full mt-4 accent-emerald-500 h-2 bg-slate-800 rounded-full appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>$20</span>
              <span>$200</span>
            </div>
          </div>

          {/* Bio */}
          <div className="glass-card p-6 hover:transform-none">
            <label
              htmlFor="bio"
              className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3"
            >
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={300}
              placeholder="Describe your coaching experience and what players can expect..."
              className="w-full p-4 bg-slate-950/60 border border-slate-700/50 rounded-xl focus:ring-2 ring-emerald-500/50 outline-none text-white placeholder:text-slate-600 transition-all duration-300 focus:bg-slate-900/80 focus:border-emerald-500/30 text-sm resize-none"
            />
            <p className="text-[10px] text-slate-600 mt-1 text-right">
              {bio.length}/300
            </p>
          </div>

          {/* Live Preview */}
          <div className="glass-card p-6 hover:transform-none">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-4">
              Live Preview
            </p>
            <div className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-900/30">
                    C
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Coach You</h3>
                    <div className="text-[10px] text-slate-500">
                      {specialty || "Position"} · {style || "Style"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono text-white">
                    ${rate}
                  </span>
                  <span className="text-[10px] text-slate-500">/hr</span>
                </div>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                {bio || "Your bio will appear here..."}
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !style || !specialty}
            className="glow-btn w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 py-4 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/25 active:scale-[0.97]"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
