'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
    const body = isSignUp ? { email, password, name } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Force page refresh and redirect to landing page
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f1f2d] flex flex-col justify-center items-center relative overflow-hidden px-4">
      {/* Background Glowing Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#6a2153]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#3f122f]/10 blur-[120px] pointer-events-none" />

      {/* Floating UI Elements for premium aesthetic */}
      <div className="w-full max-w-md z-10">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6a2153] flex items-center justify-center text-[#f5e2de] shadow-[0_0_20px_rgba(106,33,83,0.4)]">
              <span className="material-symbols-outlined font-bold text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-[#f5e2de] font-display">
              Weave Intelligence
            </span>
          </div>
        </div>

        {/* Card Panel */}
        <div className="bg-[#1d3a4d] border border-[#2a4a5e] rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-[#f5e2de]">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-sm text-[#9f8f99] mt-1.5">
              {isSignUp ? 'Start transcribing and analyzing your meetings.' : 'Sign in to access your dashboard.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex gap-2 items-start">
              <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-[#dfccc5] mb-1.5" htmlFor="name">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="Alex Rivers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0f1f2d] border border-[#2a4a5e] rounded-xl text-sm text-[#eaeaea] placeholder-[#9f8f99]/50 focus:outline-none focus:border-[#6a2153] transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#dfccc5] mb-1.5" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f1f2d] border border-[#2a4a5e] rounded-xl text-sm text-[#eaeaea] placeholder-[#9f8f99]/50 focus:outline-none focus:border-[#6a2153] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#dfccc5] mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f1f2d] border border-[#2a4a5e] rounded-xl text-sm text-[#eaeaea] placeholder-[#9f8f99]/50 focus:outline-none focus:border-[#6a2153] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 btn-primary-cta disabled:opacity-50 text-[#f5e2de] font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-[#f5e2de]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[#9f8f99]">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError('');
                  }}
                  className="text-[#b4a7af] hover:text-[#f5e2de] font-medium transition-colors ml-0.5"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError('');
                  }}
                  className="text-[#b4a7af] hover:text-[#f5e2de] font-medium transition-colors ml-0.5"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
