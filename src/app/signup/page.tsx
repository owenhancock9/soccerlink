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
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md relative z-10 anim-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] inline-block cursor-pointer">
              Coaching<span className="text-[var(--accent)]">Match</span>
            </h1>
          </Link>
          <p className="text-[var(--text-muted)] text-sm mt-1">Create your athlete or trainer profile</p>
        </div>

        {/* Signup Card */}
        <div className="bg-white border border-[var(--border-default)] rounded-[4px] p-8 shadow-sm">
          <form action={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-[4px] font-semibold anim-fade-in">
                {error}
              </div>
            )}

            {/* Role Selector */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-3">
                I want to join as a...
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole("player")}
                  className={`p-4 rounded-[4px] border text-sm font-bold transition-all ${
                    selectedRole === "player"
                      ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]"
                      : "bg-white border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <span className="text-2xl block mb-1">👤</span>
                  Player
                  <p className="text-[10px] font-medium mt-0.5 opacity-80">
                    Book elite training
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("coach")}
                  className={`p-4 rounded-[4px] border text-sm font-bold transition-all ${
                    selectedRole === "coach"
                      ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]"
                      : "bg-white border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <span className="text-2xl block mb-1">⚽</span>
                  Coach
                  <p className="text-[10px] font-medium mt-0.5 opacity-80">
                    Earn coaching revenue
                  </p>
                </button>
              </div>
              <input type="hidden" name="role" value={selectedRole} />
            </div>

            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-2"
              >
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                placeholder="Alex Rivera"
                className="w-full p-3.5 bg-white border border-[var(--border-default)] rounded-[4px] focus:ring-2 focus:ring-[var(--accent)]/15 focus:border-[var(--accent)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all text-sm font-semibold"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full p-3.5 bg-white border border-[var(--border-default)] rounded-[4px] focus:ring-2 focus:ring-[var(--accent)]/15 focus:border-[var(--accent)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all text-sm font-semibold"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-2"
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
                  className="w-full p-3.5 bg-white border border-[var(--border-default)] rounded-[4px] focus:ring-2 focus:ring-[var(--accent)]/15 focus:border-[var(--accent)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all text-sm font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-sm"
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold mb-2"
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
                  className="w-full p-3.5 bg-white border border-[var(--border-default)] rounded-[4px] focus:ring-2 focus:ring-[var(--accent)]/15 focus:border-[var(--accent)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all text-sm font-semibold"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white py-3.5 rounded-[4px] font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                `Sign Up as ${selectedRole === "coach" ? "Coach" : "Player"}`
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[var(--border-default)]" />
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
              Already have an account?
            </span>
            <div className="flex-1 h-px bg-[var(--border-default)]" />
          </div>

          {/* Login Link */}
          <Link
            href="/login"
            className="block w-full py-3.5 rounded-[4px] font-bold text-xs uppercase tracking-wider text-center transition-all bg-white text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent-subtle)] active:scale-[0.99]"
          >
            Sign In Instead
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[var(--text-muted)] font-semibold mt-8 uppercase tracking-wider">
          By signing up, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
