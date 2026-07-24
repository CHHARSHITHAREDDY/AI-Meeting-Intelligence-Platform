'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Play, 
  Sparkles, 
  Check, 
  Terminal, 
  Activity, 
  Lock, 
  Layers, 
  ChevronDown 
} from 'lucide-react';

export default function LandingPage() {
  // States for the interactive transcription animation card
  const [stage, setStage] = useState(0);
  const [alexText, setAlexText] = useState('');
  const [samText, setSamText] = useState('');
  
  const fullAlexText = "We need to finalize the Q3 roadmap by Friday.";
  const fullSamText = "I can commit to the API refactor, but the dashboard will spill over.";

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    // stage 0: idle / audio visualizer only (1.5s)
    if (stage === 0) {
      setAlexText('');
      setSamText('');
      timer = setTimeout(() => setStage(1), 1200);
    } 
    // stage 1: type Alex text
    else if (stage === 1) {
      let charIndex = 0;
      const interval = setInterval(() => {
        if (charIndex <= fullAlexText.length) {
          setAlexText(fullAlexText.substring(0, charIndex));
          charIndex++;
        } else {
          clearInterval(interval);
          setStage(2);
        }
      }, 35);
      return () => clearInterval(interval);
    } 
    // stage 2: wait briefly and type Sam text
    else if (stage === 2) {
      timer = setTimeout(() => {
        let charIndex = 0;
        const interval = setInterval(() => {
          if (charIndex <= fullSamText.length) {
            setSamText(fullSamText.substring(0, charIndex));
            charIndex++;
          } else {
            clearInterval(interval);
            setStage(3);
          }
        }, 35);
        return () => clearInterval(interval);
      }, 800);
    } 
    // stage 3: Cue AI Processing / extraction (2s)
    else if (stage === 3) {
      timer = setTimeout(() => setStage(4), 2200);
    } 
    // stage 4: Results displayed (5s), then loop back to 0
    else if (stage === 4) {
      timer = setTimeout(() => setStage(0), 5500);
    }

    return () => clearTimeout(timer);
  }, [stage]);

  // Pill Ticker content (duplicated for infinite looping effect)
  const tickerItems = [
    "Who committed to what?",
    "Endless status meetings",
    "Decisions lost in slack",
    "No searchable memory",
    "Action items falling through",
    "Forgotten risks",
    "Who committed to what?",
    "Endless status meetings",
    "Decisions lost in slack",
    "No searchable memory",
    "Action items falling through",
    "Forgotten risks",
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 relative overflow-hidden flex flex-col font-sans bg-grid-pattern">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-950/20 blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-[20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-fuchsia-950/15 blur-[150px] pointer-events-none -z-10" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-zinc-900 bg-zinc-950/60 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <span className="text-white font-extrabold text-base tracking-tighter">C</span>
            </div>
            <span className="text-xl font-bold font-display tracking-tight text-zinc-100">
              Cue Intelligence
            </span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#platform" className="hover:text-zinc-100 transition-colors">Platform</a>
            <a href="#features" className="hover:text-zinc-100 transition-colors">Features</a>
            <a href="#enterprise" className="hover:text-zinc-100 transition-colors">Enterprise</a>
            <a href="#pricing" className="hover:text-zinc-100 transition-colors">Pricing</a>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="text-sm font-semibold text-zinc-300 hover:text-zinc-50 transition hidden sm:inline-block"
            >
              Sign In
            </Link>
            <Link 
              href="/dashboard"
              className="relative group px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-zinc-900 border border-zinc-800 transition hover:border-zinc-700 shadow-md flex items-center overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
              Request Demo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Hero Left Info */}
          <div className="lg:col-span-7 space-y-8 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/40 border border-violet-900/30 text-xs text-violet-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Audio Intelligence Platform</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight font-display leading-tight text-zinc-100">
              Meetings end.<br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-400 bg-clip-text text-transparent">
                The intelligence doesn't.
              </span>
            </h1>

            <p className="text-zinc-400 text-lg sm:text-xl font-normal leading-relaxed max-w-2xl">
              Beyond transcripts. Cue captures decisions, predicts risks, and builds your organization's memory in real-time.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <Link 
                href="/dashboard" 
                className="px-8 py-4 rounded-xl text-sm font-bold tracking-wide bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-lg shadow-violet-600/35 transition-all text-center flex items-center justify-center gap-2 group"
              >
                Start Free
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              
              <Link 
                href="/dashboard" 
                className="glow-border px-8 py-4 rounded-xl text-sm font-bold tracking-wide text-zinc-200 bg-zinc-900/40 hover:bg-zinc-900/80 transition-all text-center flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 text-violet-400" />
                Watch Demo
              </Link>
            </div>
          </div>

          {/* Hero Right Interactive Animation Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl relative">
              {/* Card Glow Effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-tr from-violet-500/10 to-fuchsia-500/10 rounded-2xl blur-lg -z-10" />

              {/* Soundwaves and header */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Live Recording</span>
                </div>
                
                {/* Visualizer bars */}
                <div className="flex items-end gap-1 h-5 overflow-hidden">
                  <div className="w-1 bg-violet-400 rounded-full soundwave-bar soundwave-bar-1 h-full" />
                  <div className="w-1 bg-violet-400 rounded-full soundwave-bar soundwave-bar-2 h-full" />
                  <div className="w-1 bg-violet-400 rounded-full soundwave-bar soundwave-bar-3 h-full" />
                  <div className="w-1 bg-violet-400 rounded-full soundwave-bar soundwave-bar-4 h-full" />
                  <div className="w-1 bg-violet-400 rounded-full soundwave-bar soundwave-bar-5 h-full" />
                </div>
              </div>

              {/* Conversations Body */}
              <div className="space-y-5 min-h-[180px] flex flex-col justify-start">
                {/* Alex Message */}
                {(stage >= 1) && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-sky-400">[Alex - PM]</span>
                    </div>
                    <p className="text-sm text-zinc-300 font-medium pl-1 leading-relaxed">
                      {alexText}
                      {stage === 1 && <span className="inline-block w-1.5 h-4 ml-0.5 bg-sky-400 animate-pulse" />}
                    </p>
                  </div>
                )}

                {/* Sam Message */}
                {(stage >= 2) && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-fuchsia-400">[Sam - Eng]</span>
                    </div>
                    <p className="text-sm text-zinc-300 font-medium pl-1 leading-relaxed">
                      {samText}
                      {stage === 2 && <span className="inline-block w-1.5 h-4 ml-0.5 bg-fuchsia-400 animate-pulse" />}
                    </p>
                  </div>
                )}

                {/* Processing State */}
                {stage === 3 && (
                  <div className="flex items-center gap-2 bg-violet-950/20 border border-violet-900/30 rounded-xl p-3 text-xs text-violet-300 font-semibold animate-pulse mt-4">
                    <div className="w-4 h-4 border border-violet-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>[Cue AI] Extracting commitments and planning risk models...</span>
                  </div>
                )}

                {/* Structured Extraction Result Card */}
                {stage === 4 && (
                  <div className="space-y-3 bg-zinc-950/80 border border-violet-950/80 rounded-xl p-4 mt-4 shadow-inner relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="absolute top-0 right-0 px-2 py-0.5 bg-violet-500/10 text-violet-400 border-l border-b border-violet-950/80 text-[9px] font-bold uppercase tracking-wider rounded-bl-lg">
                      Extracted
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-violet-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-violet-400" />
                      <span>Intelligence output</span>
                    </div>
                    
                    {/* Items */}
                    <div className="space-y-2 text-xs text-zinc-300">
                      <div className="flex items-start gap-2 bg-zinc-900/50 p-2 rounded border border-zinc-800">
                        <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                        <div>
                          <span className="font-semibold text-zinc-200">Action:</span> Finalize Q3 roadmap by Friday. 
                          <span className="text-[10px] text-zinc-400 block mt-0.5">Assignee: Alex • Due: Friday</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 bg-zinc-900/50 p-2 rounded border border-zinc-800">
                        <span className="text-amber-400 font-bold shrink-0 mt-0.5">⚠</span>
                        <div>
                          <span className="font-semibold text-zinc-200">Risk:</span> Dashboard completion delay due to API refactor.
                          <span className="text-[10px] text-zinc-400 block mt-0.5">Mitigation: Schedule dashboard MVP checkpoint</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Arrow Down indicator */}
        <div className="flex justify-center pb-8 animate-bounce">
          <ChevronDown className="w-6 h-6 text-zinc-600" />
        </div>

        {/* Infinite Scrolling Pill Ticker */}
        <section className="border-y border-zinc-900 bg-zinc-950/40 py-6 overflow-hidden relative">
          {/* Gradient Overlays for smooth fading edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-zinc-950 to-transparent pointer-events-none z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-zinc-950 to-transparent pointer-events-none z-10" />
          
          <div className="animate-ticker gap-6">
            {tickerItems.map((item, i) => (
              <div 
                key={i} 
                className="px-5 py-2 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-zinc-300 text-xs font-semibold tracking-wide flex items-center gap-2 whitespace-nowrap"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {item}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Ready to Upgrade CTA Section */}
      <section className="border-t border-zinc-900 py-24 bg-zinc-950/30 relative">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl font-extrabold font-display text-zinc-100 tracking-tight leading-tight">
            Ready to upgrade your organization's memory?
          </h2>
          
          <p className="text-zinc-400 text-base max-w-xl mx-auto leading-relaxed">
            Join forward-thinking teams using Cue to turn conversations into actionable intelligence.
          </p>
          
          <div className="pt-2">
            <Link 
              href="/dashboard"
              className="px-8 py-4 rounded-xl text-sm font-bold tracking-wide bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-lg shadow-violet-600/35 hover:shadow-violet-600/50 transition-all inline-flex items-center gap-2"
            >
              Get Started Now
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-12 text-sm text-zinc-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center">
                <span className="text-white font-extrabold text-[10px]">C</span>
              </div>
              <span className="font-bold text-zinc-300 font-display">Cue Intelligence</span>
            </div>
            <p className="text-xs text-zinc-600">
              © {new Date().getFullYear()} Cue Intelligence. All rights reserved.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 text-xs font-medium">
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Security</a>
          </div>

          {/* System status tag */}
          <div className="px-3 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800/80 flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            System Status: Live
          </div>
        </div>
      </footer>
    </div>
  );
}
