'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ClipboardList, 
  MessageSquare,
  Volume2
} from 'lucide-react';

export default function LiveMeetingPage() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [timer, setTimer] = useState(2712); // 45:12 in seconds
  const [stage, setStage] = useState(0);

  // Auto-increment timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Stage transitions for live transcription & AI insights extraction
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setStage(prev => {
        if (prev < 4) return prev + 1;
        return prev;
      });
    }, 3500); // Trigger a new line/insight every 3.5s
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleReset = () => {
    setStage(0);
    setTimer(2712);
    setIsPlaying(true);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f751a1] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f751a1]"></span>
            </div>
            <span className="text-[#ffb0cd] font-mono text-[11px] uppercase tracking-widest font-bold">
              Live AI Processing
            </span>
          </div>
          <h1 className="text-3xl font-extrabold font-display tracking-tight text-white">Project Apollo Sync</h1>
        </div>

        {/* Stats & Actions */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center bg-zinc-900/50 border border-zinc-800 hover:border-violet-500/30 text-zinc-200 px-3.5 py-2 rounded-full transition"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 mr-1.5 text-fuchsia-400" /> Pause Stream
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Resume Stream
              </>
            )}
          </button>
          <button 
            onClick={handleReset}
            className="flex items-center bg-zinc-900/50 border border-zinc-800 hover:border-violet-500/30 text-zinc-200 px-3.5 py-2 rounded-full transition"
            title="Reset simulation"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
          </button>
          
          <span className="flex items-center bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-full text-zinc-400">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-violet-400" /> {formatTimer(timer)}
          </span>
          <span className="flex items-center bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-full text-zinc-400">
            <Users className="w-3.5 h-3.5 mr-1.5 text-fuchsia-400" /> 4 Participants
          </span>
        </div>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-230px)] min-h-[500px]">
        {/* Left Side: Streaming Transcript (Span 8) */}
        <div className="col-span-12 lg:col-span-8 bg-zinc-900/40 rounded-xl border border-zinc-800/80 flex flex-col relative overflow-hidden shadow-2xl">
          {/* Panel Header */}
          <div className="bg-zinc-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-zinc-800/80 z-10 w-full">
            <h3 className="font-bold font-display text-[16px] text-violet-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Streaming Transcript
            </h3>
            <div className="flex items-center space-x-2">
              <span className={`h-1.5 w-1.5 rounded-full shadow-[0_0_8px_#a78bfa] ${isPlaying ? 'bg-violet-400 animate-pulse' : 'bg-zinc-650'}`}></span>
              <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">{isPlaying ? 'Active Listening' : 'Paused'}</span>
            </div>
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 p-6 pt-20 overflow-y-auto flex flex-col justify-end space-y-6 bg-gradient-to-t from-zinc-950/20 to-transparent scrollbar-thin">
            
            {/* Line 1 (Sarah) */}
            {stage >= 0 && (
              <div className="flex items-start space-x-4 max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-500">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                  SC
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline space-x-2">
                    <span className="font-bold text-sm text-zinc-100">Sarah Chen</span>
                    <span className="text-[10px] text-zinc-500">10:04 AM</span>
                  </div>
                  <p className="text-sm text-zinc-300 bg-zinc-900 px-4 py-3 rounded-2xl rounded-tl-sm border border-zinc-800 leading-relaxed">
                    We need to finalize the Q3 marketing budget by tomorrow. If we don't, we'll miss the window for the ad spend allocation.
                  </p>
                </div>
              </div>
            )}

            {/* Line 2 (Marcus) */}
            {stage >= 1 && (
              <div className="flex items-start space-x-4 max-w-2xl ml-auto flex-row-reverse space-x-reverse animate-in fade-in slide-in-from-bottom-3 duration-500">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
                  MW
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-baseline justify-end space-x-2 space-x-reverse">
                    <span className="font-bold text-sm text-zinc-100">Marcus Wright</span>
                    <span className="text-[10px] text-zinc-500">10:05 AM</span>
                  </div>
                  <p className="text-sm text-zinc-300 bg-zinc-850 px-4 py-3 rounded-2xl rounded-tr-sm border border-zinc-800 text-left leading-relaxed">
                    Agreed. I've already drafted the proposal. Let's make it a formal decision: we cap the initial spend at $150k and review after 30 days.
                  </p>
                </div>
              </div>
            )}

            {/* Line 3 (Jane) */}
            {stage >= 2 && (
              <div className="flex items-start space-x-4 max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-500">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 font-bold text-sm">
                  JD
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline space-x-2">
                    <span className="font-bold text-sm text-zinc-100">Jane Doe</span>
                    <span className="text-[10px] text-zinc-500">10:05 AM</span>
                  </div>
                  <p className="text-sm text-zinc-300 bg-zinc-900 px-4 py-3 rounded-2xl rounded-tl-sm border border-zinc-800 leading-relaxed">
                    Sounds good. Marcus, can you send that draft to the finance team by EOD today?
                  </p>
                </div>
              </div>
            )}

            {/* Line 4 (Marcus) */}
            {stage >= 3 && (
              <div className="flex items-start space-x-4 max-w-2xl ml-auto flex-row-reverse space-x-reverse animate-in fade-in slide-in-from-bottom-3 duration-500">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
                  MW
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-baseline justify-end space-x-2 space-x-reverse">
                    <span className="font-bold text-sm text-zinc-100">Marcus Wright</span>
                    <span className="text-[10px] text-zinc-500">10:06 AM</span>
                  </div>
                  <p className="text-sm text-zinc-300 bg-zinc-850 px-4 py-3 rounded-2xl rounded-tr-sm border border-zinc-800 text-left leading-relaxed">
                    Will do. Just a heads up, the API integration with the new vendor is delayed, which might impact the launch date slightly.
                  </p>
                </div>
              </div>
            )}

            {/* Typing Loader Indicator */}
            {isPlaying && (
              <div className="flex items-center space-x-2 text-zinc-500 text-xs font-semibold py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"></span>
                <span className="pl-1 italic">transcribing audio feed...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Stacked Insights (Span 4) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col space-y-6">
          
          {/* Card 1: Decisions Detected */}
          <div className="flex-1 flex flex-col bg-zinc-900/40 rounded-xl border border-zinc-800/80 shadow-xl relative overflow-hidden">
            <div className="p-4 border-b border-zinc-805 flex items-center justify-between">
              <h4 className="font-bold font-display text-sm text-zinc-100 flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                Decisions Detected
              </h4>
              {stage >= 1 && (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  1 New
                </span>
              )}
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {stage >= 1 ? (
                <div className="bg-zinc-950/40 border border-emerald-500/20 rounded-lg p-3.5 flex items-start space-x-3 shadow-[0_0_15px_rgba(52,211,153,0.05)] animate-in fade-in duration-500">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-zinc-100 leading-tight">Cap initial ad spend at $150k</p>
                    <p className="text-[10px] text-zinc-500 mt-1.5">Review scheduled after 30 days</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic text-center py-6">Listening for team consensus...</p>
              )}
            </div>
          </div>

          {/* Card 2: Action Items */}
          <div className="flex-1 flex flex-col bg-zinc-900/40 rounded-xl border border-zinc-800/80 shadow-xl">
            <div className="p-4 border-b border-zinc-805 flex items-center justify-between">
              <h4 className="font-bold font-display text-sm text-zinc-100 flex items-center gap-2">
                <ClipboardList className="w-4.5 h-4.5 text-violet-400" />
                Action Items
              </h4>
              {stage >= 2 && (
                <span className="bg-violet-500/15 text-violet-400 border border-violet-500/20 text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  1 Pending
                </span>
              )}
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {stage >= 2 ? (
                <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-lg p-3.5 flex justify-between items-center hover:border-violet-500/50 transition-colors cursor-pointer group animate-in fade-in duration-500">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-[10px] font-bold">
                      MW
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-100 group-hover:text-violet-400 transition-colors leading-tight">Send draft to finance</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">Assignee: Marcus Wright</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-zinc-800 px-2 py-1 rounded text-zinc-400 border border-zinc-700 font-semibold shrink-0">
                    Today, EOD
                  </span>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic text-center py-6">Listening for commitments...</p>
              )}
            </div>
          </div>

          {/* Card 3: Risks Flagged */}
          <div className="flex-1 flex flex-col bg-zinc-900/40 rounded-xl border border-zinc-800/80 shadow-xl relative overflow-hidden">
            {/* Red glow hint */}
            {stage >= 3 && (
              <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>
            )}
            
            <div className="p-4 border-b border-zinc-805 flex items-center justify-between">
              <h4 className="font-bold font-display text-sm text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
                Risks Flagged
              </h4>
              {stage >= 3 && (
                <span className="bg-amber-500/15 text-amber-400 border border-amber-500/20 text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider animate-pulse">
                  High Risk
                </span>
              )}
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {stage >= 3 ? (
                <div className="bg-zinc-950/40 border border-amber-500/20 rounded-lg p-3.5 flex items-start space-x-3 shadow-[0_0_15px_rgba(245,158,11,0.02)] animate-in fade-in duration-500">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-zinc-100 leading-tight">API Integration Delayed</p>
                    <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">Impacts launch date. Vendor capacity issue.</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic text-center py-6">Listening for project bottlenecks...</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
