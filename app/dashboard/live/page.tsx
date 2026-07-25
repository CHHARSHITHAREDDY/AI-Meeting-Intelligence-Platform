'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckSquare, ChevronRight, Copy, Link2, Mic, MicOff,
  PhoneOff, Sparkles, Users, Video, AlertTriangle, Lightbulb,
  ClipboardList, Activity, CheckCircle2, Play, Pause, RotateCcw
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface TranscriptEntry { id: string; speaker: string; text: string; timestamp: string; }
interface Insight        { id: string; title: string; detail: string; }
interface LiveInsights   { summary: string; decisions: Insight[]; actionItems: (Insight & { assignee?: string })[]; risks: Insight[]; }

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function avatarColor(name: string) {
  const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#3B82F6', '#10B981'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */
export default function LiveMeetingPage() {
  /* meeting state */
  const [meetingId,     setMeetingId]     = useState<string | null>(null);
  const [title,         setTitle]         = useState('Team Standup');
  const [hostName,      setHostName]      = useState('You');
  const [joinInput,     setJoinInput]     = useState('');
  const [meetingStatus, setMeetingStatus] = useState<'idle' | 'scheduled' | 'live' | 'ended'>('idle');
  const [participants,  setParticipants]  = useState<string[]>([]);

  /* transcript + insights */
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [insights,   setInsights]   = useState<LiveInsights>({ summary: '', decisions: [], actionItems: [], risks: [] });
  const [insightTab, setInsightTab] = useState<'decisions' | 'tasks' | 'risks'>('decisions');

  /* audio capture state */
  const [micOn, setMicOn] = useState(false);
  const [interim, setInterim] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [micError, setMicError] = useState('');

  /* refs */
  const recognitionRef = useRef<any>(null);
  const listeningRef   = useRef(false);
  const transcriptEnd  = useRef<HTMLDivElement>(null);
  const origin         = typeof window !== 'undefined' ? window.location.origin : '';
  const containerRef   = useRef<HTMLDivElement>(null);
  const prevTranscriptCountRef = useRef(0);

  // Auto scroll to bottom when transcript updates
  useEffect(() => {
    if (transcript.length > prevTranscriptCountRef.current) {
      prevTranscriptCountRef.current = transcript.length;
    }
  }, [transcript]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interim]);

  /* ─── Actions ───────────────────────────────────────────────────────────── */
  const createMeeting = async () => {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/meetings/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: title.trim(), hostName: hostName.trim() || 'You' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create meeting');
      setMeetingId(data.meeting.id);
      setMeetingStatus('scheduled');
      setParticipants(data.meeting.participants || [hostName]);
      setStatusMsg('Meeting created! Share the link with your team.');
    } catch (err: any) {
      setStatusMsg(err.message || 'Error creating meeting');
    } finally {
      setIsCreating(false);
    }
  };

  const joinMeeting = async () => {
    const raw = joinInput.trim();
    if (!raw) return;
    const id = raw.includes('/join/') ? raw.split('/join/').pop()?.trim() : raw;
    if (!id) return;
    try {
      const res = await fetch('/api/meetings/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', meetingId: id, participantName: hostName.trim() || 'Guest' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join meeting');
      setMeetingId(data.meeting.id);
      setTitle(data.meeting.title);
      setMeetingStatus(data.meeting.status === 'live' ? 'live' : 'scheduled');
      setParticipants(data.meeting.participants || []);
      setStatusMsg('Joined meeting!');
    } catch (err: any) {
      setStatusMsg(err.message || 'Error joining meeting');
    }
  };

  const startMeeting = async () => {
    if (!meetingId) return;
    try {
      await fetch('/api/meetings/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', meetingId }),
      });
      setMeetingStatus('live');
      setStatusMsg('Meeting is live!');
      startListening();
    } catch {
      setStatusMsg('Failed to start meeting');
    }
  };

  const endMeeting = async () => {
    stopListening();
    if (meetingId) {
      try {
        await fetch('/api/meetings/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'end', meetingId, transcript, insights }),
        });
      } catch { /* ignore */ }
    }
    setMeetingStatus('ended');
    setStatusMsg('Meeting ended. Intelligence saved to Dashboard.');
  };

  /* ─── Speech Recognition (Mic capture) ─────────────────────────────────── */
  const processFinalText = useCallback((text: string) => {
    if (!text.trim()) return;
    const entry: TranscriptEntry = {
      id: Math.random().toString(36).slice(2),
      speaker: hostName.trim() || 'You',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setTranscript(prev => [...prev, entry]);

    // Fast local AI insight extraction
    const lower = text.toLowerCase();
    if (lower.includes('decide') || lower.includes('agree') || lower.includes('decision')) {
      setInsights(prev => ({
        ...prev,
        decisions: [...prev.decisions, { id: Math.random().toString(36).slice(2), title: text.slice(0, 50), detail: text }],
      }));
    } else if (lower.includes('will') || lower.includes('action') || lower.includes('task') || lower.includes('todo') || lower.includes('by ')) {
      setInsights(prev => ({
        ...prev,
        actionItems: [...prev.actionItems, { id: Math.random().toString(36).slice(2), title: text.slice(0, 50), detail: text, assignee: hostName }],
      }));
    } else if (lower.includes('risk') || lower.includes('delay') || lower.includes('issue') || lower.includes('block')) {
      setInsights(prev => ({
        ...prev,
        risks: [...prev.risks, { id: Math.random().toString(36).slice(2), title: text.slice(0, 50), detail: text }],
      }));
    }
  }, [hostName]);

  const startListening = () => {
    const windowObj = window as any;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError('Speech recognition is not supported in this browser. Live transcript requires Chrome/Edge.');
      return;
    }
    setMicError('');
    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (e: any) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const trans = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalStr += trans;
          else interimStr += trans;
        }
        if (finalStr) processFinalText(finalStr);
        setInterim(interimStr);
      };

      rec.onerror = (e: any) => {
        if (e.error === 'not-allowed') setMicError('Microphone permission denied. Allow mic access in browser address bar.');
      };

      rec.onend = () => {
        if (listeningRef.current) {
          try { rec.start(); } catch { /* ignore */ }
        }
      };

      listeningRef.current = true;
      rec.start();
      recognitionRef.current = rec;
      setMicOn(true);
    } catch (err: any) {
      setMicError(err.message || 'Failed to start mic');
    }
  };

  const stopListening = () => {
    listeningRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setMicOn(false);
    setInterim('');
  };

  const toggleMic = () => {
    if (micOn) stopListening();
    else startListening();
  };

  useEffect(() => () => { listeningRef.current = false; try { recognitionRef.current?.abort(); } catch { /* ignore */ } }, []);

  /* ─── Derived ────────────────────────────────────────────────────────────── */
  const shareLink = meetingId ? `${origin}/join/${meetingId}` : '';
  const inMeeting  = meetingId !== null;
  const isLive     = meetingStatus === 'live';

  const copyLink = async () => {
    if (!shareLink) return;
    try { await navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setStatusMsg('Copy failed — copy the link manually.'); }
  };

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div ref={containerRef} className="w-full flex flex-col gap-6 min-h-[80vh]">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${
              isLive ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-[#6366F1]/10 text-[#a5b4fc] border border-[#6366F1]/30'
            }`}>
              {isLive && (
                <span className="relative flex h-2 w-2">
                  <span className="live-status-dot animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="live-status-dot relative rounded-full h-2 w-2 bg-red-500" />
                </span>
              )}
              {isLive ? 'Live AI Processing' : 'AI Meeting Room'}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">{inMeeting ? title : 'Start or Join a Meeting'}</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {inMeeting
              ? `${participants.length} participant${participants.length === 1 ? '' : 's'} · Live transcription & AI insights`
              : 'Create a meeting link and share it — like Zoom, with live AI intelligence.'}
          </p>
        </div>
        {inMeeting && (
          <div className="flex items-center gap-2">
            {meetingStatus === 'scheduled' && (
              <button onClick={startMeeting}
                className="flex items-center gap-2 rounded-full bg-[#6366F1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5254cc] transition-colors">
                <Video className="h-4 w-4" /> Start Meeting
              </button>
            )}
            {isLive && (
              <button onClick={toggleMic}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                  micOn ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30' : 'bg-[#1a2035] border border-[#2a3555] text-zinc-300 hover:bg-[#232B45]'
                }`}>
                {micOn ? <><Mic className="h-4 w-4 animate-pulse" /> Mic On</> : <><MicOff className="h-4 w-4" /> Mic Off</>}
              </button>
            )}
            {isLive && (
              <button onClick={endMeeting}
                className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors">
                <PhoneOff className="h-4 w-4" /> End
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Setup panel (before meeting) ── */}
      {!inMeeting && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create */}
          <div className="rounded-2xl border border-[#232B45] bg-[#12172A] p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Video className="h-5 w-5 text-[#6366F1]" />Create a meeting</h2>
            <div className="space-y-3">
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full rounded-xl border border-[#232B45] bg-[#0a0e17] px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#6366F1] transition-colors" placeholder="Meeting title" />
              <input value={hostName} onChange={e => setHostName(e.target.value)}
                className="w-full rounded-xl border border-[#232B45] bg-[#0a0e17] px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#6366F1] transition-colors" placeholder="Your name" />
              <button onClick={createMeeting} disabled={isCreating}
                className="w-full rounded-xl bg-[#6366F1] py-2.5 text-sm font-semibold text-white hover:bg-[#5254cc] disabled:opacity-60 transition-colors">
                {isCreating ? 'Creating…' : '+ New meeting'}
              </button>
            </div>
          </div>

          {/* Join */}
          <div className="rounded-2xl border border-[#232B45] bg-[#12172A] p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Link2 className="h-5 w-5 text-fuchsia-400" />Join a meeting</h2>
            <div className="space-y-3">
              <input value={joinInput} onChange={e => setJoinInput(e.target.value)}
                className="w-full rounded-xl border border-[#232B45] bg-[#0a0e17] px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-fuchsia-500 transition-colors"
                placeholder="Paste meeting link or ID" />
              <button onClick={joinMeeting}
                className="w-full rounded-xl border border-fuchsia-500/50 bg-fuchsia-500/10 py-2.5 text-sm font-semibold text-fuchsia-300 hover:bg-fuchsia-500/20 transition-colors">
                Join meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active meeting layout ── */}
      {inMeeting && (
        <div className="flex flex-col gap-4">

          {/* Invite bar */}
          <div className="flex items-center gap-3 rounded-xl border border-[#232B45] bg-[#12172A] px-4 py-3">
            <Link2 className="h-4 w-4 text-fuchsia-400 shrink-0" />
            <span className="flex-1 truncate text-sm text-zinc-300 font-mono">{shareLink || '—'}</span>
            <button onClick={copyLink} disabled={!shareLink}
              className="flex items-center gap-1.5 rounded-lg border border-[#232B45] bg-[#0a0e17] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white transition-colors disabled:opacity-40">
              <Copy className="h-3.5 w-3.5" />{copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>

          {/* Mic error */}
          {micError && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">{micError}</div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-12 gap-4 flex-1">

            {/* LEFT — participant tiles + status */}
            <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">

              {/* Participant tiles (Zoom-style) */}
              <div className="rounded-2xl border border-[#232B45] bg-[#0a0e17] p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-[#6366F1]" />
                  <span className="text-sm font-semibold text-white">Participants ({participants.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {participants.map(p => (
                    <div key={p} className="relative flex flex-col items-center justify-center gap-2 rounded-xl bg-[#12172A] border border-[#232B45] py-5 px-2">
                      <div className="relative">
                        <div className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold text-white"
                          style={{ background: `radial-gradient(circle at 30% 30%, ${avatarColor(p)}cc, ${avatarColor(p)}66)` }}>
                          {initials(p)}
                        </div>
                        {isLive && p === hostName && micOn && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 border-2 border-[#12172A] flex items-center justify-center">
                            <Mic className="h-2 w-2 text-white" />
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-300 font-medium truncate max-w-full px-1">{p}</span>
                      {isLive && p === hostName && micOn && (
                        <div className="flex gap-0.5 items-end h-3">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="w-1 rounded-full bg-[#6366F1] animate-pulse" style={{ height: `${Math.random() * 8 + 4}px`, animationDelay: `${i * 100}ms` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {participants.length === 0 && (
                    <div className="col-span-full text-sm text-zinc-500 text-center py-4">No participants yet</div>
                  )}
                </div>
              </div>

              {/* AI Summary */}
              {insights.summary && (
                <div className="rounded-2xl border border-[#6366F1]/30 bg-[#6366F1]/5 p-4 shadow-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-[#6366F1]" />
                    <span className="text-sm font-semibold text-white">AI Summary</span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{insights.summary}</p>
                </div>
              )}

              {/* Status bar */}
              {statusMsg && (
                <div className="rounded-xl border border-[#232B45] bg-[#12172A] px-4 py-2.5 text-xs text-zinc-400">{statusMsg}</div>
              )}
            </div>

            {/* RIGHT — transcript + insights tabs */}
            <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">

              {/* Live transcript */}
              <div className="rounded-2xl border border-[#232B45] bg-[#12172A] shadow-xl flex flex-col" style={{ minHeight: '280px' }}>
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#232B45]">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">Live Transcript</span>
                    {micOn && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">{transcript.length} entries</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '260px' }}>
                  {transcript.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                      <Mic className="h-8 w-8 text-zinc-600 mb-2" />
                      <p className="text-sm text-zinc-500">
                        {isLive ? 'Start speaking — transcript will appear here automatically.' : 'Start the meeting to begin live transcription.'}
                      </p>
                    </div>
                  )}
                  {transcript.map((entry, idx) => (
                    <div key={entry.id} className={`transcript-line-${idx} flex gap-3`}>
                      <div className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: avatarColor(entry.speaker) }}>
                        {initials(entry.speaker)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-[#a5b4fc]">{entry.speaker}</span>
                          <span className="text-[10px] text-zinc-500">{entry.timestamp}</span>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed">{entry.text}</p>
                      </div>
                    </div>
                  ))}
                  {/* Interim (in-progress) text */}
                  {interim && (
                    <div className="flex gap-3 opacity-50">
                      <div className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: avatarColor(hostName) }}>
                        {initials(hostName)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-[#a5b4fc]">{hostName}</span>
                          <span className="text-[10px] text-zinc-500 italic">speaking…</span>
                        </div>
                        <p className="text-sm text-zinc-400 italic">{interim}</p>
                      </div>
                    </div>
                  )}
                  <div ref={transcriptEnd} />
                </div>
              </div>

              {/* AI Insights tabs */}
              <div className="rounded-2xl border border-[#232B45] bg-[#12172A] shadow-xl flex flex-col">
                {/* Tab bar */}
                <div className="flex border-b border-[#232B45]">
                  {([
                    { key: 'decisions', label: 'Decisions', icon: <Lightbulb className="h-3.5 w-3.5" />, count: insights.decisions.length },
                    { key: 'tasks',     label: 'Action Items', icon: <ClipboardList className="h-3.5 w-3.5" />, count: insights.actionItems.length },
                    { key: 'risks',     label: 'Risks', icon: <AlertTriangle className="h-3.5 w-3.5" />, count: insights.risks.length },
                  ] as const).map(tab => (
                    <button key={tab.key} onClick={() => setInsightTab(tab.key)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 ${
                        insightTab === tab.key
                          ? 'border-[#6366F1] text-white'
                          : 'border-transparent text-zinc-500 hover:text-zinc-300'
                      }`}>
                      {tab.icon}{tab.label}
                      {tab.count > 0 && (
                        <span className="ml-1 rounded-full bg-[#6366F1]/20 px-1.5 py-0.5 text-[10px] text-[#a5b4fc]">{tab.count}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="p-4 space-y-2" style={{ minHeight: '140px', maxHeight: '220px', overflowY: 'auto' }}>
                  {insightTab === 'decisions' && (
                    insights.decisions.length === 0
                      ? <EmptyState text={isLive ? 'Decisions will appear as they are made.' : 'Start the meeting to see AI-extracted decisions.'} />
                      : insights.decisions.map(d => <InsightCard key={d.id} icon={<Lightbulb className="h-3.5 w-3.5 text-yellow-400" />} title={d.title} detail={d.detail} />)
                  )}
                  {insightTab === 'tasks' && (
                    insights.actionItems.length === 0
                      ? <EmptyState text={isLive ? 'Action items will appear as they are discussed.' : 'Start the meeting to see action items.'} />
                      : insights.actionItems.map(a => (
                          <InsightCard key={a.id} icon={<CheckSquare className="h-3.5 w-3.5 text-emerald-400" />} title={a.title} detail={a.detail}
                            badge={a.assignee ? `→ ${a.assignee}` : undefined} />
                        ))
                  )}
                  {insightTab === 'risks' && (
                    insights.risks.length === 0
                      ? <EmptyState text={isLive ? 'Risks will be flagged automatically.' : 'Start the meeting to see flagged risks.'} />
                      : insights.risks.map(r => <InsightCard key={r.id} icon={<AlertTriangle className="h-3.5 w-3.5 text-red-400" />} title={r.title} detail={r.detail} />)
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */
function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-zinc-500 text-center py-6">{text}</p>;
}

function InsightCard({ icon, title, detail, badge }: { icon: React.ReactNode; title: string; detail: string; badge?: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#232B45] bg-[#0a0e17] p-3">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-zinc-200">{title}</p>
          {badge && <span className="text-[10px] rounded-full bg-[#6366F1]/20 text-[#a5b4fc] px-2 py-0.5">{badge}</span>}
        </div>
        {detail && <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{detail}</p>}
      </div>
    </div>
  );
}
