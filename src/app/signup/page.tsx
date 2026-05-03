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
    <div className="min-h-screen bg-[var(--bg-primary)] text-zinc-100 flex items-center justify-center px-4 py-12">

      <div className="w-full max-w-md relative z-10 anim-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/">
            <h1 className="text-xl font-bold text-white inline-block cursor-pointer">
              CoachingMatch
            </h1>
          </Link>
          <p className="text-zinc-500 text-sm mt-2">Create your account</p>
        </div>

        {/* Signup Card */}
        <div className="glass-card p-8 hover:transform-none">
          <form action={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-950/30 border border-red-900/40 text-red-400 text-sm p-3 rounded-lg anim-fade-in">
                {error}
              </div>
            )}

            {/* Role Selector */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-3">
                I am a...
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole("player")}
                  className={`p-4 rounded-lg border text-sm font-medium transition-colors ${
                    selectedRole === "player"
                      ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400"
                      : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"
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
                  className={`p-4 rounded-lg border text-sm font-medium transition-colors ${
                    selectedRole === "coach"
                      ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400"
                      : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"
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
                className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2"
              >
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                placeholder="Alex Rivera"
                className="w-full p-4 bg-zinc-950/60 border border-zinc-700/50 rounded-xl focus:ring-2 ring-indigo-500/50 outline-none text-white placeholder:text-zinc-600 transition-all duration-300 focus:bg-zinc-900/80 focus:border-indigo-500/30 text-sm"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full p-4 bg-zinc-950/60 border border-zinc-700/50 rounded-xl focus:ring-2 ring-indigo-500/50 outline-none text-white placeholder:text-zinc-600 transition-all duration-300 focus:bg-zinc-900/80 focus:border-indigo-500/30 text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2"
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
                  className="w-full p-4 bg-zinc-950/60 border border-zinc-700/50 rounded-xl focus:ring-2 ring-indigo-500/50 outline-none text-white placeholder:text-zinc-600 transition-all duration-300 focus:bg-zinc-900/80 focus:border-indigo-500/30 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2"
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
                  className="w-full p-4 bg-zinc-950/60 border border-zinc-700/50 rounded-xl focus:ring-2 ring-indigo-500/50 outline-none text-white placeholder:text-zinc-600 transition-all duration-300 focus:bg-zinc-900/80 focus:border-indigo-500/30 text-sm"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 py-3.5 rounded-lg font-medium text-sm transition-colors active:scale-[0.98]"
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
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-500">
              Already have an account?
            </span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Login Link */}
          <Link
            href="/login"
            className="block w-full py-3 rounded-lg font-medium text-sm text-center transition-colors bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-white"
          >
            Sign In Instead
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 mt-6">
          By signing up, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
