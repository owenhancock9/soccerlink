"use client";

import React, { useState } from "react";
import { signUp } from "@/app/actions/auth";
import Link from "next/link";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("player");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(formData: FormData) {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-slate-100 relative flex items-center justify-center px-4 py-12">
      {/* Ambient Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] bg-indigo-600/[0.04] rounded-full blur-[120px]" />
        <div className="absolute -bottom-[30%] -right-[20%] w-[50%] h-[50%] bg-violet-600/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10 anim-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/">
            <h1 className="text-2xl font-black tracking-tighter gradient-text inline-block cursor-pointer">
              COACH_MATCHING
            </h1>
          </Link>
          <p className="text-slate-500 text-sm mt-2">Create your account</p>
        </div>

        {/* Signup Card */}
        <div className="glass-card p-8 hover:transform-none">
          <form action={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-rose-950/30 border border-rose-900/40 text-rose-400 text-sm p-4 rounded-xl anim-fade-in">
                {error}
              </div>
            )}

            {/* Role Selector */}
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">
                I am a...
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole("player")}
                  className={`p-4 rounded-xl border text-sm font-semibold transition-all duration-300 ${
                    selectedRole === "player"
                      ? "bg-indigo-600/15 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-900/20"
                      : "bg-slate-950/40 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  <span className="text-2xl block mb-2">👤</span>
                  Player
                  <p className="text-[10px] font-normal mt-1 opacity-60">
                    Find a coach
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("coach")}
                  className={`p-4 rounded-xl border text-sm font-semibold transition-all duration-300 ${
                    selectedRole === "coach"
                      ? "bg-emerald-600/15 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-900/20"
                      : "bg-slate-950/40 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  <span className="text-2xl block mb-2">⚽</span>
                  Coach
                  <p className="text-[10px] font-normal mt-1 opacity-60">
                    Train players
                  </p>
                </button>
              </div>
              <input type="hidden" name="role" value={selectedRole} />
            </div>

            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2"
              >
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                placeholder="Alex Rivera"
                className="w-full p-4 bg-slate-950/60 border border-slate-700/50 rounded-xl focus:ring-2 ring-indigo-500/50 outline-none text-white placeholder:text-slate-600 transition-all duration-300 focus:bg-slate-900/80 focus:border-indigo-500/30 text-sm"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full p-4 bg-slate-950/60 border border-slate-700/50 rounded-xl focus:ring-2 ring-indigo-500/50 outline-none text-white placeholder:text-slate-600 transition-all duration-300 focus:bg-slate-900/80 focus:border-indigo-500/30 text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full p-4 bg-slate-950/60 border border-slate-700/50 rounded-xl focus:ring-2 ring-indigo-500/50 outline-none text-white placeholder:text-slate-600 transition-all duration-300 focus:bg-slate-900/80 focus:border-indigo-500/30 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full p-4 bg-slate-950/60 border border-slate-700/50 rounded-xl focus:ring-2 ring-indigo-500/50 outline-none text-white placeholder:text-slate-600 transition-all duration-300 focus:bg-slate-900/80 focus:border-indigo-500/30 text-sm"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className={`glow-btn w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg relative z-10 active:scale-[0.97] ${
                selectedRole === "coach"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25"
                  : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/25"
              } disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600`}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                `Sign Up as ${selectedRole === "coach" ? "Coach" : "Player"}`
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-800/60" />
            <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
              Already have an account?
            </span>
            <div className="flex-1 h-px bg-slate-800/60" />
          </div>

          {/* Login Link */}
          <Link
            href="/login"
            className="block w-full py-4 rounded-xl font-semibold text-sm text-center transition-all duration-300 bg-slate-800/60 text-slate-300 border border-slate-700/50 hover:bg-slate-700/60 hover:text-white hover:border-slate-600 active:scale-[0.97]"
          >
            Sign In Instead
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-600 mt-8">
          By signing up, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
