"use client";

import React, { useState } from "react";
import { signIn } from "@/app/actions/auth";
import Link from "next/link";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-zinc-100 flex items-center justify-center px-4">

      <div className="w-full max-w-md relative z-10 anim-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/">
            <h1 className="text-xl font-bold text-white inline-block cursor-pointer">
              CoachingMatch
            </h1>
          </Link>
          <p className="text-zinc-500 text-sm mt-2">Sign in to your account</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 hover:transform-none">
          <form action={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-950/30 border border-red-900/40 text-red-400 text-sm p-4 rounded-xl anim-fade-in">
                {error}
              </div>
            )}

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
                  placeholder="••••••••"
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

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 py-3.5 rounded-lg font-medium text-sm transition-colors active:scale-[0.98]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-zinc-800/60" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
              New here?
            </span>
            <div className="flex-1 h-px bg-zinc-800/60" />
          </div>

          {/* Sign Up Link */}
          <Link
            href="/signup"
            className="block w-full py-4 rounded-xl font-semibold text-sm text-center transition-all duration-300 bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/60 hover:text-white hover:border-zinc-600 active:scale-[0.97]"
          >
            Create an Account
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-zinc-600 mt-8">
          By signing in, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
