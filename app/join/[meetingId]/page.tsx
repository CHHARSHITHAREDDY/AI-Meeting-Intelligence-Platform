'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Video, 
  Mic, 
  MicOff, 
  Users, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck,
  Camera,
  CameraOff,
  Clock
} from 'lucide-react';

interface JoinPageProps {
  params: Promise<{ meetingId: string }>;
}

export default function JoinMeetingPage({ params }: JoinPageProps) {
  const { meetingId } = use(params);
  const router = useRouter();

  const [guestName, setGuestName] = useState('');
  const [meeting, setMeeting] = useState<{
    id: string;
    title: string;
    hostName: string;
    status: 'scheduled' | 'live' | 'ended';
    participantCount: number;
    participants: string[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

  useEffect(() => {
    async function fetchInfo() {
      try {
        const res = await fetch(`/api/join/${meetingId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Invalid meeting link');
        }
        setMeeting(data.meeting);
      } catch (err: any) {
        setError(err.message || 'Could not load meeting information');
      } finally {
        setLoading(false);
      }
    }
    fetchInfo();
  }, [meetingId]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    // Store preferred guest name in session storage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('guest_display_name', guestName.trim());
    }

    // Redirect to live dashboard meeting room
    router.push(`/dashboard/live?meetingId=${meetingId}`);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center relative overflow-hidden px-4 font-sans antialiased selection:bg-violet-500/30">
      {/* Glow backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-fuchsia-600/10 blur-[130px] pointer-events-none" />

      {/* Top Header */}
      <div className="w-full max-w-xl flex items-center justify-between py-6 z-10">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:scale-105 transition transform">
            <Video className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Cue Intelligence
          </span>
        </Link>

        <span className="text-xs font-mono text-zinc-500 bg-zinc-900/80 px-3 py-1 rounded-full border border-zinc-800 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          WebRTC Encrypted
        </span>
      </div>

      {/* Card Container */}
      <div className="w-full max-w-xl z-10 my-auto">
        {loading ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-10 h-10 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-sm font-mono text-zinc-400">Loading meeting room details...</p>
          </div>
        ) : error || !meeting ? (
          <div className="glass-card p-10 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100">Meeting Link Expired or Invalid</h2>
            <p className="text-xs text-zinc-400 max-w-sm">{error || "The requested meeting room ID doesn't exist."}</p>
            <Link 
              href="/dashboard/live"
              className="mt-4 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition shadow-lg shadow-violet-600/20"
            >
              Go to Live Dashboard
            </Link>
          </div>
        ) : (
          <div className="glass-card border border-zinc-800 p-8 shadow-2xl space-y-6">
            
            {/* Status & Title Header */}
            <div className="space-y-3 pb-6 border-b border-zinc-900">
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  meeting.status === 'live'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : meeting.status === 'ended'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}>
                  {meeting.status === 'live' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
                  {meeting.status === 'live' ? 'Meeting is Live' : meeting.status === 'ended' ? 'Meeting Ended' : 'Meeting Scheduled'}
                </span>

                <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                  <Users className="w-4 h-4 text-violet-400" />
                  <span>{meeting.participantCount} in room</span>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
                {meeting.title}
              </h1>

              <p className="text-xs text-zinc-400 flex items-center gap-2">
                <span>Hosted by <strong className="text-zinc-200 font-semibold">{meeting.hostName}</strong></span>
              </p>
            </div>

            {/* Video / Audio Test Preview Screen */}
            <div className="aspect-video w-full rounded-2xl bg-zinc-950 border border-zinc-800/80 p-4 flex flex-col justify-between relative overflow-hidden group shadow-inner">
              <div className="flex justify-between items-center z-10">
                <span className="text-[10px] font-mono text-zinc-400 bg-black/60 px-2.5 py-1 rounded-full border border-zinc-800 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-violet-400" /> Pre-join Preview
                </span>
              </div>

              {/* Center Preview Avatar / Icon */}
              <div className="flex flex-col items-center justify-center my-auto z-10 space-y-2">
                <div className="w-16 h-16 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400 text-xl font-bold uppercase shadow-lg shadow-violet-500/10">
                  {guestName ? guestName.substring(0, 2) : 'ME'}
                </div>
                <p className="text-xs text-zinc-400 font-mono">
                  {guestName || 'Your display name will appear here'}
                </p>
              </div>

              {/* Device Quick Toggles */}
              <div className="flex justify-center items-center gap-3 z-10 pt-2">
                <button
                  type="button"
                  onClick={() => setMicEnabled(!micEnabled)}
                  className={`p-3 rounded-full border transition cursor-pointer ${
                    micEnabled 
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800' 
                      : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                  }`}
                  title={micEnabled ? 'Microphone On' : 'Microphone Muted'}
                >
                  {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setCamEnabled(!camEnabled)}
                  className={`p-3 rounded-full border transition cursor-pointer ${
                    camEnabled 
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800' 
                      : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                  }`}
                  title={camEnabled ? 'Camera On' : 'Camera Off'}
                >
                  {camEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Join Form */}
            <form onSubmit={handleJoin} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5" htmlFor="guestName">
                  Your Display Name <span className="text-violet-400">*</span>
                </label>
                <input
                  id="guestName"
                  type="text"
                  required
                  placeholder="e.g. Alex Rivers"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors shadow-inner"
                />
              </div>

              <button
                type="submit"
                disabled={!guestName.trim()}
                className="w-full py-3.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white cursor-pointer shadow-xl shadow-violet-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-98"
              >
                <span>Join Meeting Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Footer Notice */}
            <div className="pt-2 text-center">
              <p className="text-[11px] text-zinc-500">
                No software download required. Runs directly in your browser.
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="w-full max-w-xl text-center py-6 text-[11px] text-zinc-600 z-10">
        © 2026 Cue Intelligence Platform. All rights reserved.
      </footer>
    </main>
  );
}
