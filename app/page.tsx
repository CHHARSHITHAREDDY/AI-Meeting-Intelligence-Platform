'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Play, 
  Pause,
  SkipBack,
  SkipForward,
  Sparkles, 
  Terminal, 
  ChevronDown,
  Volume2,
  Mic,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Zap,
  Layers
} from 'lucide-react';

export default function LandingPage() {
  const [stage, setStage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [alexText, setAlexText] = useState('');
  const [samText, setSamText] = useState('');
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);

  const fullAlexText = "We need to finalize the Q3 roadmap by Friday.";
  const fullSamText = "I can commit to the API refactor, but the dashboard will spill over.";

  const handlePlayPause = () => {
    setIsPlaying(prev => !prev);
  };

  const handleNextStage = () => {
    setStage(prev => (prev >= 4 ? 0 : prev + 1));
  };

  const handlePrevStage = () => {
    setStage(prev => (prev <= 0 ? 4 : prev - 1));
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.user) setUser(data.user); })
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    let timer: NodeJS.Timeout;
    if (stage === 0) {
      setAlexText(''); setSamText('');
      timer = setTimeout(() => setStage(1), 1200);
    } else if (stage === 1) {
      let i = 0;
      const interval = setInterval(() => {
        if (i <= fullAlexText.length) { setAlexText(fullAlexText.substring(0, i)); i++; }
        else { clearInterval(interval); setStage(2); }
      }, 35);
      return () => clearInterval(interval);
    } else if (stage === 2) {
      timer = setTimeout(() => {
        let i = 0;
        const interval = setInterval(() => {
          if (i <= fullSamText.length) { setSamText(fullSamText.substring(0, i)); i++; }
          else { clearInterval(interval); setStage(3); }
        }, 35);
        return () => clearInterval(interval);
      }, 800);
    } else if (stage === 3) {
      timer = setTimeout(() => setStage(4), 2200);
    } else if (stage === 4) {
      timer = setTimeout(() => setStage(0), 5500);
    }
    return () => clearTimeout(timer);
  }, [stage, isPlaying]);

  const tickerItems = [
    "Who committed to what?", "Endless status meetings", "Decisions lost in slack",
    "No searchable memory", "Action items falling through", "Forgotten risks",
    "Who committed to what?", "Endless status meetings", "Decisions lost in slack",
    "No searchable memory", "Action items falling through", "Forgotten risks",
  ];

  return (
    <div 
      ref={containerRef} 
      className="min-h-screen bg-[#162939] text-[#f5e2de] relative overflow-hidden flex flex-col font-sans selection:bg-[#6a2153]/30 selection:text-[#f5e2de]"
      style={{
        backgroundImage: "url('/image-2.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Lush Ambient Gradient Overlay */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(22, 41, 57, 0.75) 0%, rgba(22, 41, 57, 0.30) 50%, rgba(22, 41, 57, 0.50) 100%)'
        }}
      />

      {/* Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl border-b border-[#9f8f99]/15 bg-[#162939]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#6a2153] via-[#9f8f99] to-[#3f122f] flex items-center justify-center text-[#f5e2de] shadow-[0_0_20px_rgba(106,33,83,0.35)] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined font-bold text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
            </div>
            <div>
              <span className="text-lg font-bold font-display tracking-tight text-[#f5e2de]">Weave</span>
              <p className="text-[9px] text-[#dfccc5] uppercase tracking-widest font-mono -mt-1">Intelligence Platform</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#dfccc5]">
            <a href="#platform" className="hover:text-[#b4a7af] transition-colors">Platform</a>
            <a href="#features" className="hover:text-[#b4a7af] transition-colors">Features</a>
            <a href="#enterprise" className="hover:text-[#b4a7af] transition-colors">Enterprise</a>
            <a href="#pricing" className="hover:text-[#b4a7af] transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-xs font-medium text-[#dfccc5] font-mono hidden sm:inline-block">
                  Logged in as <strong className="text-[#f5e2de]">{user.name}</strong>
                </span>
                <Link
                  href="/dashboard"
                  className="px-5 py-2.5 rounded-lg text-[12px] btn-primary-cta uppercase tracking-wider flex items-center gap-2"
                >
                  Go to Dashboard
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-semibold text-[#dfccc5] hover:text-[#b4a7af] transition hidden sm:inline-block">
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-lg text-[12px] btn-primary-cta uppercase tracking-wider"
                >
                  Request Demo
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section Aligned Left Over Whiteboard */}
      <main className="flex-1 flex flex-col justify-center relative z-10">
        <section className="relative min-h-[85vh] flex items-center pt-12 pb-20 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Information Panel */}
            <div className="lg:col-span-7 space-y-6 text-left">
              
              {/* Glassmorphic Floating Information Shell */}
              <div className="p-8 sm:p-10 rounded-3xl bg-[#162939]/85 border border-[#9f8f99]/20 shadow-[0_30px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl space-y-6">
                
                {/* Badge */}
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#1d3a4d]/90 border border-[#9f8f99]/30 text-xs text-[#b4a7af] font-semibold tracking-wide backdrop-blur-md shadow-sm">
                  <Sparkles className="w-4 h-4 text-[#6a2153]" />
                  <span className="uppercase tracking-widest font-mono text-[11px]">Executive Meeting Intelligence</span>
                </div>

                {/* Heading */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight font-display leading-[1.1] text-[#f5e2de]">
                  Meetings end.<br />
                  <span className="bg-gradient-to-r from-[#dfccc5] via-[#b4a7af] to-[#6a2153] bg-clip-text text-transparent">
                    The intelligence doesn&apos;t.
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="text-[#dfccc5] text-base sm:text-lg font-normal leading-relaxed max-w-xl">
                  Weave turns raw meeting recordings and live conversations into structured business intelligence: decisions, action items, risks, and a searchable AI copilot.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                  <Link
                    href={user ? "/dashboard" : "/login"}
                    className="px-8 py-4 rounded-xl text-sm font-bold tracking-wide btn-primary-cta text-center flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    {user ? 'Go to Dashboard' : 'Start Free'}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href={user ? "/dashboard" : "/login"}
                    className="px-8 py-4 rounded-xl text-sm font-bold tracking-wide text-[#f5e2de] bg-[#1d3a4d]/90 border border-[#9f8f99]/30 hover:border-[#6a2153] hover:bg-[#254558] transition-all text-center flex items-center justify-center gap-2 backdrop-blur-md"
                  >
                    <Play className="w-4 h-4 text-[#6a2153] fill-[#6a2153]" />
                    Watch Demo
                  </Link>
                </div>

                {/* FLOATING MEDIA CONTROLS DOCK */}
                <div className="pt-2">
                  <div className="inline-flex items-center gap-3 p-3 rounded-2xl bg-[#1d3a4d]/95 border border-[#9f8f99]/25 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center gap-2 pl-2 pr-3 border-r border-[#9f8f99]/20">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPlaying ? 'bg-[#6a2153]' : 'bg-[#3f122f]'} opacity-75`} />
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPlaying ? 'bg-[#6a2153]' : 'bg-[#3f122f]'}`} />
                      </span>
                      <span className="text-xs font-mono text-[#f5e2de] font-bold tracking-wider uppercase">
                        {isPlaying ? 'Live Demo Sync' : 'Paused'}
                      </span>
                    </div>

                    {/* Media Control Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrevStage}
                        className="p-2.5 rounded-xl bg-[#162939] border border-[#9f8f99]/20 hover:border-[#6a2153] text-[#dfccc5] hover:text-white transition-all cursor-pointer shadow hover:scale-105"
                        title="Previous Audio Segment"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>

                      <button
                        onClick={handlePlayPause}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6a2153] via-[#9f8f99] to-[#3f122f] text-[#f5e2de] text-xs font-bold shadow-lg shadow-[#6a2153]/30 hover:scale-105 transition-transform cursor-pointer flex items-center gap-2"
                        title={isPlaying ? "Pause Demo Stream" : "Play Demo Stream"}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-4 h-4 fill-[#f5e2de]" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-[#f5e2de]" />
                            <span>Play</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleNextStage}
                        className="p-2.5 rounded-xl bg-[#162939] border border-[#9f8f99]/20 hover:border-[#6a2153] text-[#dfccc5] hover:text-white transition-all cursor-pointer shadow hover:scale-105"
                        title="Next Audio Segment"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Live Equalizer Indicator */}
                    <div className="flex items-end gap-1 h-5 px-3 border-l border-[#9f8f99]/20">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={`w-1 bg-[#6a2153] rounded-full soundwave-bar soundwave-bar-${i} h-full ${!isPlaying ? 'animate-none opacity-30' : ''}`} />
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Live Recording Card */}
            <div className="lg:col-span-5 flex justify-center relative">

              {/* Floating Action Badge */}
              <div className="absolute -top-6 -left-4 sm:-left-6 z-20 bg-[#162939]/95 border border-[#10B981]/50 rounded-2xl p-3 shadow-2xl backdrop-blur-xl animate-float-slow hidden sm:flex items-center gap-3 text-xs text-[#f5e2de]">
                <div className="w-8 h-8 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[#10B981] font-bold block">Action Detected</span>
                  <span className="font-semibold text-white">API refactor by Friday</span>
                </div>
              </div>

              {/* Floating Risk Alert Badge */}
              <div className="absolute -bottom-6 -right-4 sm:-right-6 z-20 bg-[#162939]/95 border border-[#F43F5E]/50 rounded-2xl p-3 shadow-2xl backdrop-blur-xl animate-float-delayed hidden sm:flex items-center gap-3 text-xs text-[#f5e2de]">
                <div className="w-8 h-8 rounded-xl bg-[#F43F5E]/20 border border-[#F43F5E]/40 flex items-center justify-center text-[#F43F5E]">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[#F43F5E] font-bold block">Risk Highlighted</span>
                  <span className="font-semibold text-white">Q3 Dashboard delay</span>
                </div>
              </div>

              {/* Main Live Card Container */}
              <div className="w-full max-w-md bg-[#1d3a4d]/85 border border-[#9f8f99]/25 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl relative z-10">
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-[#6a2153]/20 to-[#9f8f99]/20 rounded-3xl blur-xl -z-10" />

                {/* Card Header */}
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#9f8f99]/20">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPlaying ? 'bg-[#10B981]' : 'bg-[#9f8f99]'} opacity-75`} />
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPlaying ? 'bg-[#10B981]' : 'bg-[#9f8f99]'}`} />
                    </span>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#dfccc5] font-mono block">
                        Live Recording
                      </span>
                      <span className="text-[10px] text-[#6a2153] font-mono font-medium">
                        {isPlaying ? '● Audio Stream Active' : '⏸ Stream Paused'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-end gap-1 h-5 overflow-hidden">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={`w-1 bg-[#6a2153] rounded-full soundwave-bar soundwave-bar-${i} h-full ${!isPlaying ? 'animate-none opacity-30' : ''}`} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Simulated Transcript */}
                <div className="space-y-5 min-h-[180px] flex flex-col justify-start">
                  {stage >= 1 && (
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-[#6a2153] font-mono">[Alex - PM]</span>
                      <p className="text-sm text-[#f5e2de] font-medium pl-1 leading-relaxed">
                        {alexText}
                        {stage === 1 && <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#6a2153] animate-pulse" />}
                      </p>
                    </div>
                  )}
                  {stage >= 2 && (
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-[#b4a7af] font-mono">[Sam - Eng]</span>
                      <p className="text-sm text-[#f5e2de] font-medium pl-1 leading-relaxed">
                        {samText}
                        {stage === 2 && <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#b4a7af] animate-pulse" />}
                      </p>
                    </div>
                  )}
                  {stage === 3 && (
                    <div className="flex items-center gap-2 bg-[#6a2153]/15 border border-[#6a2153]/40 rounded-xl p-3 text-xs text-[#b4a7af] font-semibold animate-pulse mt-4">
                      <div className="w-4 h-4 border-2 border-[#6a2153] border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>[Weave AI] Extracting commitments and planning risk models...</span>
                    </div>
                  )}
                  {stage === 4 && (
                    <div className="space-y-3 bg-[#1d3a4d]/90 border border-[#9f8f99]/25 rounded-2xl p-4 mt-4 shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#6a2153]/20 text-[#b4a7af] border-l border-b border-[#9f8f99]/20 text-[9px] font-bold uppercase tracking-wider rounded-bl-lg font-mono">
                        Extracted
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#b4a7af] flex items-center gap-1.5 font-mono">
                        <Terminal className="w-3.5 h-3.5 text-[#6a2153]" />
                        <span>Intelligence Output</span>
                      </div>
                      <div className="space-y-2 text-xs text-[#f5e2de]">
                        <div className="flex items-start gap-2 bg-[#162939] p-2.5 rounded-xl border border-[#9f8f99]/20">
                          <span className="text-[#10B981] font-bold shrink-0 mt-0.5">✓</span>
                          <div>
                            <span className="font-semibold text-white">Action:</span> Finalize Q3 roadmap by Friday.
                            <span className="text-[10px] text-[#dfccc5] block mt-0.5 font-mono">Assignee: Alex • Due: Friday</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 bg-[#162939] p-2.5 rounded-xl border border-[#9f8f99]/20">
                          <span className="text-[#F43F5E] font-bold shrink-0 mt-0.5">⚠</span>
                          <div>
                            <span className="font-semibold text-white">Risk:</span> Dashboard completion delay due to API refactor.
                            <span className="text-[10px] text-[#dfccc5] block mt-0.5 font-mono">Mitigation: Schedule dashboard MVP checkpoint</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Scroll Indicator */}
        <div className="flex justify-center pb-8 animate-bounce">
          <ChevronDown className="w-6 h-6 text-[#dfccc5]" />
        </div>

        {/* Infinite Ticker */}
        <section className="border-y border-[#9f8f99]/20 bg-[#162939]/80 py-6 overflow-hidden relative backdrop-blur-xl">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#162939] to-transparent pointer-events-none z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#162939] to-transparent pointer-events-none z-10" />
          <div className="flex w-max" ref={tickerRef}>
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <div key={i} className="px-5 py-2.5 mx-3 rounded-full bg-[#1d3a4d]/90 border border-[#9f8f99]/20 text-[#dfccc5] text-xs font-semibold tracking-wide flex items-center gap-2.5 whitespace-nowrap shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6a2153]" />
                {item}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* CTA Section */}
      <section className="border-t border-[#9f8f99]/20 py-24 bg-[#162939]/85 backdrop-blur-2xl relative z-10">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl font-extrabold font-display text-[#f5e2de] tracking-tight">
            Ready to upgrade your organization&apos;s memory?
          </h2>
          <p className="text-[#dfccc5] text-base max-w-xl mx-auto leading-relaxed">
            Join forward-thinking teams using Weave to turn conversations into actionable intelligence.
          </p>
          <div className="pt-2">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="px-8 py-4 rounded-xl text-sm font-bold tracking-wide btn-primary-cta inline-flex items-center gap-2"
            >
              Get Started Now
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#9f8f99]/20 bg-[#0f1f2d] py-12 text-sm text-[#dfccc5] mt-auto relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <div className="w-6 h-6 rounded bg-gradient-to-tr from-[#6a2153] to-[#9f8f99] flex items-center justify-center text-[#f5e2de]">
                <span className="material-symbols-outlined font-bold text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
              </div>
              <span className="font-bold text-[#f5e2de] font-display">Weave Intelligence</span>
            </div>
            <p className="text-xs text-[#dfccc5]/60">
              © {new Date().getFullYear()} Weave Intelligence. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 text-xs font-medium">
            <a href="#" className="hover:text-[#b4a7af] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#b4a7af] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#b4a7af] transition-colors">Security</a>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-[#1d3a4d] border border-[#9f8f99]/20 flex items-center gap-2 text-xs font-semibold text-[#dfccc5]">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            System Status: Live
          </div>
        </div>
      </footer>
    </div>
  );
}


