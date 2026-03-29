"use client";

import React, { useState } from "react";
import { signIn } from "@/app/actions/auth";
import Link from "next/link";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-[var(--bg-primary)] text-slate-100 relative flex items-center justify-center px-4">
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
          <p className="text-slate-500 text-sm mt-2">Sign in to your account</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 hover:transform-none">
          <form action={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-rose-950/30 border border-rose-900/40 text-rose-400 text-sm p-4 rounded-xl anim-fade-in">
                {error}
              </div>
            )}

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
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full p-4 bg-slate-950/60 border border-slate-700/50 rounded-xl focus:ring-2 ring-indigo-500/50 outline-none text-white placeholder:text-slate-600 transition-all duration-300 focus:bg-slate-900/80 focus:border-indigo-500/30 text-sm"
              />
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="glow-btn w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 py-4 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/25 relative z-10 active:scale-[0.97]"
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
            <div className="flex-1 h-px bg-slate-800/60" />
            <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
              New here?
            </span>
            <div className="flex-1 h-px bg-slate-800/60" />
          </div>

          {/* Sign Up Link */}
          <Link
            href="/signup"
            className="block w-full py-4 rounded-xl font-semibold text-sm text-center transition-all duration-300 bg-slate-800/60 text-slate-300 border border-slate-700/50 hover:bg-slate-700/60 hover:text-white hover:border-slate-600 active:scale-[0.97]"
          >
            Create an Account
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-600 mt-8">
          By signing in, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
