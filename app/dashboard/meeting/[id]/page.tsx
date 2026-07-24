'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Download, 
  Calendar, 
  Clock, 
  CheckSquare, 
  FileText, 
  AlertTriangle, 
  User, 
  Copy, 
  Search, 
  Check, 
  ShieldAlert, 
  CheckSquare2,
  Square,
  Info,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Film,
  Radio,
  Volume2
} from 'lucide-react';
import { Meeting, ActionItem } from '@/lib/db';

interface MeetingPageProps {
  params: Promise<{ id: string }>;
}

export default function MeetingPage({ params }: MeetingPageProps) {
  const { id } = use(params);
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'decisions' | 'actions' | 'risks'>('decisions');
  const [rightTab, setRightTab] = useState<'transcript' | 'chat'>('transcript');
  
  // Transcript search and copy
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [copied, setCopied] = useState(false);

  // Video playback & Live Summary state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Auto-advance player when playing
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime(prev => prev + 1 * playbackRate);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playbackRate]);

  // Format seconds MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Convert duration string "18m 42s" to total seconds
  const getTotalSeconds = (dur?: string) => {
    if (!dur) return 600;
    const mMatch = dur.match(/(\d+)\s*m/);
    const sMatch = dur.match(/(\d+)\s*s/);
    const mins = mMatch ? parseInt(mMatch[1]) : 0;
    const secs = sMatch ? parseInt(sMatch[1]) : 0;
    return mins * 60 + secs || 600;
  };

  // Get current active segment live summary
  const getCurrentSegmentSummary = (seconds: number) => {
    if (!meeting || !meeting.transcript) return 'Video playback paused. Press Play to start generating live summaries.';

    const lines = meeting.transcript.split('\n');
    let activeLine = lines[0] || '';

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/\[(\d+):(\d+)\]/);
      if (match) {
        const lineSecs = parseInt(match[1]) * 60 + parseInt(match[2]);
        if (lineSecs <= seconds) {
          activeLine = lines[i];
        }
      }
    }

    if (activeLine) {
      return `[At ${formatTime(seconds)}] ${activeLine}`;
    }

    return meeting.analysis?.summary || 'Playing video segment...';
  };
 
  // Chat with AI state
  const [chatQuery, setChatQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<{ sender: 'user' | 'ai'; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Fetch single meeting details
  const fetchMeeting = async () => {
    try {
      const response = await fetch(`/api/meetings/${id}`);
      if (response.ok) {
        const data = await response.json();
        setMeeting(data);
      } else {
        throw new Error('Failed to retrieve meeting details');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  // Toggle Action Item Status
  const handleToggleAction = async (itemId: string) => {
    if (!meeting || !meeting.analysis) return;

    const updatedActions: ActionItem[] = meeting.analysis.actionItems.map((item, idx) => {
      const currentId = item.id || `act-${idx + 1}`;
      if (currentId === itemId || item.id === itemId) {
        return { 
          ...item, 
          status: (item.status === 'completed' ? 'pending' : 'completed') as 'pending' | 'completed'
        };
      }
      return item;
    });

    const updatedMeeting = {
      ...meeting,
      analysis: {
        ...meeting.analysis,
        actionItems: updatedActions
      }
    };

    setMeeting(updatedMeeting);

    try {
      const response = await fetch(`/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionItems: updatedActions }),
      });
      if (!response.ok) {
        throw new Error('Failed to update action item on database');
      }
    } catch (err) {
      console.error(err);
      fetchMeeting();
    }
  };

  // Copy transcript to clipboard
  const handleCopyTranscript = () => {
    if (!meeting) return;
    navigator.clipboard.writeText(meeting.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
 
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim() || chatLoading) return;
    const userMessage = chatQuery.trim();
    setChatQuery('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userMessage }]);
    setChatLoading(true);
 
    try {
      const res = await fetch(`/api/meetings/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to query AI');
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setChatHistory(prev => [...prev, { sender: 'ai', text: `Error: ${err.message || 'Failed to fetch response.'}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Export insights as Markdown
  const handleExportMarkdown = () => {
    if (!meeting || !meeting.analysis) return;

    const analysis = meeting.analysis;
    const formattedDate = new Date(meeting.date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const mdContent = `# Meeting Intelligence: ${meeting.title}
Date: ${formattedDate}
Duration: ${meeting.duration}

## 1. Executive Summary
${analysis.summary}

## 2. Decisions Made
${analysis.decisions.map((d, i) => `${i + 1}. **${d.decision}**\n   - Decider: ${d.decider}\n   - Context: ${d.context}`).join('\n\n')}

## 3. Action Items
${analysis.actionItems.map((a, i) => `- [${a.status === 'completed' ? 'x' : ' '}] **${a.task}**\n  - Assignee: ${a.assignee}\n  - Due Date: ${a.dueDate}`).join('\n')}

## 4. Risks & Mitigations
${analysis.risks.map((r, i) => `${i + 1}. **[${r.impact.toUpperCase()}] ${r.risk}**\n   - Mitigation: ${r.mitigation}`).join('\n\n')}

---
Generated by Vocalize Intelligence.
`;

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${meeting.title.toLowerCase().replace(/\s+/g, '-')}-insights.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#94A3B8]">
        <div className="w-8 h-8 rounded-full border-2 border-[#8083ff]/20 border-t-[#8083ff] animate-spin" />
        <p className="text-sm font-medium font-mono">Extracting intelligence details...</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-[#ffb4ab]/10 text-[#ffb4ab] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#ffb4ab]/15">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold font-display text-[#dfe2ef]">Meeting report not found</h2>
        <p className="text-[#94A3B8] mt-2 max-w-md mx-auto">{error || "The requested meeting ID doesn't exist in our database."}</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 mt-8 text-[#c0c1ff] hover:text-[#5de6ff] font-semibold transition">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const formattedDate = new Date(meeting.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) + ' at ' + new Date(meeting.date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const transcriptLines = meeting.transcript.split('\n');
  const filteredTranscriptLines = transcriptLines.filter(line =>
    line.toLowerCase().includes(transcriptSearch.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col space-y-6 animate-in fade-in duration-300">
      {/* Top Navbar */}
      <div className="flex items-center justify-between border-b border-[#232B45] pb-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-[#c0c1ff] font-medium transition text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Company Memory
        </Link>

        {meeting.status === 'completed' && (
          <button
            onClick={handleExportMarkdown}
            className="px-4 py-2 bg-[#1c1f29] hover:bg-[#262a34] border border-[#232B45] rounded-lg text-xs font-semibold flex items-center gap-2 transition text-[#dfe2ef] hover:border-[#c0c1ff]/30"
          >
            <Download className="w-4 h-4" /> Export Report (MD)
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Summary & Insights (7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header Metadata card */}
          <div className="glass-card p-6">
            <span className="px-2.5 py-1 rounded-full bg-[#8083ff]/10 text-[#c0c1ff] border border-[#8083ff]/20 text-[10px] font-semibold uppercase tracking-[0.15em] font-mono">
              Meeting Summary & Action Dashboard
            </span>
            <h1 className="text-2xl font-bold font-display tracking-tight text-[#F8FAFC] mt-4 leading-tight">
              {meeting.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 text-sm text-[#94A3B8]">
              <div className="flex items-center gap-2 font-mono text-xs">
                <Calendar className="w-4 h-4 text-[#464554]" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <Clock className="w-4 h-4 text-[#464554]" />
                <span>{meeting.duration}</span>
              </div>
            </div>
          </div>

          {meeting.status === 'completed' && meeting.analysis ? (
            <>
              {/* Video is Playing - Live Summary Player */}
              <div className="glass-card overflow-hidden border border-violet-500/30 bg-zinc-950/80 shadow-2xl relative">
                {/* Header bar */}
                <div className="flex items-center justify-between px-6 py-3.5 bg-zinc-900/60 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                      {isPlaying ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          <span>Video is Playing</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-zinc-500" />
                          <span>Video Paused</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-zinc-300">Live Video Summary Sync</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPlaybackRate(r => r === 1 ? 1.5 : r === 1.5 ? 2 : 1)}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-mono font-bold text-violet-400 border border-zinc-700 hover:bg-zinc-700 transition cursor-pointer"
                    >
                      {playbackRate}x Speed
                    </button>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Video Player Display Screen */}
                  <div className="md:col-span-5 aspect-video rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-violet-950/40 border border-zinc-800 flex flex-col justify-between p-4 relative overflow-hidden group shadow-inner">
                    {/* Background ambient animation when playing */}
                    {isPlaying && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/10 to-fuchsia-600/10 animate-pulse pointer-events-none" />
                    )}

                    <div className="flex justify-between items-center z-10">
                      <span className="text-[10px] font-mono text-zinc-400 bg-black/60 px-2 py-0.5 rounded border border-zinc-800">
                        TIMECODE: {formatTime(currentTime)}
                      </span>
                      <Volume2 className="w-4 h-4 text-zinc-400" />
                    </div>

                    {/* Screen Center Graphic */}
                    <div className="flex flex-col items-center justify-center my-auto z-10 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400 group-hover:scale-110 transition">
                        <Film className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-zinc-200 text-center max-w-[180px] truncate">{meeting.title}</p>
                    </div>

                    {/* Player Timeline Bar */}
                    <div className="space-y-1.5 z-10">
                      <div 
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pos = (e.clientX - rect.left) / rect.width;
                          setCurrentTime(Math.floor(pos * getTotalSeconds(meeting.duration)));
                        }}
                        className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative"
                      >
                        <div 
                          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-200"
                          style={{ width: `${Math.min(100, (currentTime / getTotalSeconds(meeting.duration)) * 100)}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(getTotalSeconds(meeting.duration))}</span>
                      </div>
                    </div>

                    {/* Play/Pause Overlay Controls */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center shadow-lg transition transform hover:scale-105 cursor-pointer"
                      >
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Live Summary Box (7 cols) */}
                  <div className="md:col-span-7 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                        <Sparkles className={`w-4 h-4 text-violet-400 ${isPlaying ? 'animate-spin' : ''}`} />
                        Live Summary (Video Segment)
                      </h3>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {isPlaying ? 'Updating Live' : 'Paused'}
                      </span>
                    </div>

                    {/* Dynamic Summary Text */}
                    <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-200 leading-relaxed shadow-inner min-h-[90px] flex flex-col justify-center">
                      <p className="font-medium">
                        {getCurrentSegmentSummary(currentTime)}
                      </p>
                    </div>

                    {/* Controls Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsPlaying(!isPlaying)}
                          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer"
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {isPlaying ? 'Pause Video' : 'Play Video'}
                        </button>

                        <button
                          onClick={() => { setCurrentTime(0); setIsPlaying(false); }}
                          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                          title="Reset Video"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>

                      <span className="text-[11px] text-zinc-400 font-mono">
                        Click timeline to seek
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="glass-card p-6">
                <h2 className="text-base font-bold font-display text-[#F8FAFC] flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-[#c0c1ff]" />
                  Executive Summary
                </h2>
                <p className="text-[#c7c4d7] leading-relaxed text-sm">
                  {meeting.analysis.summary}
                </p>
              </div>
 
              {/* Key Takeaways & Deadlines */}
              {meeting.analysis.notes && meeting.analysis.notes.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-base font-bold font-display text-[#F8FAFC] flex items-center gap-2 mb-3">
                    <Info className="w-5 h-5 text-violet-400" />
                    Key Notes & Deadlines
                  </h2>
                  <ul className="space-y-2.5">
                    {meeting.analysis.notes.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-[#c7c4d7] leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Insights Tab Box */}
              <div className="glass-card overflow-hidden">
                {/* Tab buttons */}
                <div className="flex border-b border-[#232B45] bg-[#0a0e17]/40">
                  <button
                    onClick={() => setActiveTab('decisions')}
                    className={`flex-1 py-4 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-2 ${
                      activeTab === 'decisions' 
                        ? 'border-[#8083ff] text-[#c0c1ff] bg-[#8083ff]/5' 
                        : 'border-transparent text-[#94A3B8] hover:text-[#dfe2ef]'
                    }`}
                  >
                    <span>Decisions</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'decisions' ? 'bg-[#8083ff]/20 text-[#c0c1ff]' : 'bg-[#1c1f29] text-[#464554]'}`}>
                      {meeting.analysis.decisions.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('actions')}
                    className={`flex-1 py-4 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-2 ${
                      activeTab === 'actions' 
                        ? 'border-[#8083ff] text-[#c0c1ff] bg-[#8083ff]/5' 
                        : 'border-transparent text-[#94A3B8] hover:text-[#dfe2ef]'
                    }`}
                  >
                    <span>Action Items</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'actions' ? 'bg-[#8083ff]/20 text-[#c0c1ff]' : 'bg-[#1c1f29] text-[#464554]'}`}>
                      {meeting.analysis.actionItems.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('risks')}
                    className={`flex-1 py-4 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-2 ${
                      activeTab === 'risks' 
                        ? 'border-[#8083ff] text-[#c0c1ff] bg-[#8083ff]/5' 
                        : 'border-transparent text-[#94A3B8] hover:text-[#dfe2ef]'
                    }`}
                  >
                    <span>Risks & Mitigations</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'risks' ? 'bg-[#8083ff]/20 text-[#c0c1ff]' : 'bg-[#1c1f29] text-[#464554]'}`}>
                      {meeting.analysis.risks.length}
                    </span>
                  </button>
                </div>

                {/* Tab content area */}
                <div className="p-6">
                  {activeTab === 'decisions' && (
                    <div className="space-y-4">
                      {meeting.analysis.decisions.length === 0 ? (
                        <p className="text-sm text-[#94A3B8] text-center py-6">No key decisions identified in this sync.</p>
                      ) : (
                        meeting.analysis.decisions.map((d) => (
                          <div key={d.id} className="p-4 rounded-xl bg-[#0a0e17]/60 border border-[#232B45] space-y-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="font-bold text-[#F8FAFC] text-sm">{d.decision}</h4>
                              {d.decider && (
                                <span className="px-2.5 py-1 rounded-full bg-[#1c1f29] border border-[#232B45] text-[#c0c1ff] text-xs font-medium shrink-0 flex items-center gap-1 font-mono">
                                  <User className="w-3 h-3 text-[#94A3B8]" />
                                  {d.decider}
                                </span>
                              )}
                            </div>
                            {d.context && (
                              <p className="text-[#94A3B8] text-xs leading-relaxed pl-2 border-l-2 border-[#8083ff]/40">
                                <span className="text-[#8083ff] uppercase tracking-wider font-semibold mr-1.5 text-[9px] font-mono">Context:</span>
                                {d.context}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Action Items Tab */}
                  {activeTab === 'actions' && (
                    <div className="space-y-3">
                      {meeting.analysis.actionItems.length === 0 ? (
                        <p className="text-sm text-[#94A3B8] text-center py-6">No action items identified in this sync.</p>
                      ) : (
                        meeting.analysis.actionItems.map((a) => {
                          const isCompleted = a.status === 'completed';
                          return (
                            <div 
                              key={a.id} 
                              onClick={() => handleToggleAction(a.id)}
                              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 select-none ${
                                isCompleted 
                                  ? 'bg-[#0a0e17]/40 border-[#232B45] opacity-60' 
                                  : 'bg-[#0a0e17]/80 border-[#232B45] hover:border-[#8083ff]/40 shadow-md'
                              }`}
                            >
                              <button className={`mt-0.5 shrink-0 transition ${isCompleted ? 'text-[#34D399]' : 'text-[#464554]'}`}>
                                {isCompleted ? (
                                  <CheckSquare2 className="w-5 h-5" />
                                ) : (
                                  <Square className="w-5 h-5" />
                                )}
                              </button>
                              
                              <div className="space-y-1.5">
                                <p className={`text-sm font-semibold leading-relaxed transition ${isCompleted ? 'line-through text-[#94A3B8]' : 'text-[#dfe2ef]'}`}>
                                  {a.task}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#94A3B8]">
                                  <span className="flex items-center gap-1.5 bg-[#1c1f29] border border-[#232B45] rounded-md px-2 py-0.5 font-mono">
                                    <span className="font-semibold text-[#8083ff]">Owner:</span> {a.assignee}
                                  </span>
                                  {a.dueDate && (
                                    <span className="flex items-center gap-1.5 bg-[#1c1f29] border border-[#232B45] rounded-md px-2 py-0.5 font-mono">
                                      <span className="font-semibold text-[#8083ff]">Due:</span> {a.dueDate}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Risks Tab */}
                  {activeTab === 'risks' && (
                    <div className="space-y-4">
                      {meeting.analysis.risks.length === 0 ? (
                        <p className="text-sm text-[#94A3B8] text-center py-6">No project risks detected in this sync.</p>
                      ) : (
                        meeting.analysis.risks.map((r) => {
                          const isHigh = r.impact === 'high';
                          const isMedium = r.impact === 'medium';
                          
                          return (
                            <div 
                              key={r.id} 
                              className={`p-4 rounded-xl border space-y-3 transition-all ${
                                isHigh 
                                  ? 'bg-[#ffb4ab]/5 border-[#ffb4ab]/20 shadow-md shadow-[#ffb4ab]/5' 
                                  : isMedium 
                                    ? 'bg-[#f751a1]/5 border-[#f751a1]/20 shadow-md shadow-[#f751a1]/5'
                                    : 'bg-[#0a0e17]/80 border-[#232B45]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <h4 className="font-bold text-[#F8FAFC] text-sm flex items-center gap-2">
                                  {isHigh && <ShieldAlert className="w-4.5 h-4.5 text-[#ffb4ab] animate-pulse" />}
                                  {r.risk}
                                </h4>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border font-mono ${
                                  isHigh 
                                    ? 'bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/20' 
                                    : isMedium 
                                      ? 'bg-[#f751a1]/10 text-[#f751a1] border-[#f751a1]/20'
                                      : 'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/20'
                                }`}>
                                  {r.impact}
                                </span>
                              </div>
                              {r.mitigation && (
                                <div className="p-3 rounded-lg bg-[#0a0e17]/80 border border-[#232B45] text-xs text-[#94A3B8] leading-relaxed">
                                  <span className="text-[#34D399] font-bold uppercase tracking-wider text-[9px] block mb-1 font-mono">Mitigation Strategy:</span>
                                  {r.mitigation}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card border-dashed p-12 text-center flex flex-col items-center justify-center">
              <AlertTriangle className="w-12 h-12 text-[#ffb4ab] mb-3" />
              <h3 className="text-lg font-bold text-[#c7c4d7]">Processing Pipeline Unfinished</h3>
              <p className="text-sm text-[#94A3B8] max-w-sm mt-1 mx-auto">
                {meeting.status === 'failed' 
                  ? `This meeting run failed during processing: ${meeting.error || 'Unknown error occurred'}`
                  : 'Wait a few moments, the transcription and insights generation is still running...'}
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Panel (5 columns) */}
        <div className="lg:col-span-5 flex flex-col h-[calc(100vh-270px)] min-h-[500px]">
          <div className="glass-card flex-1 flex flex-col h-full overflow-hidden p-0">
            {/* Right Panel Tab Buttons */}
            <div className="flex border-b border-[#232B45] bg-[#0a0e17]/40 shrink-0">
              <button
                onClick={() => setRightTab('transcript')}
                className={`flex-1 py-3 text-xs font-bold border-b-2 transition flex items-center justify-center gap-2 ${
                  rightTab === 'transcript'
                    ? 'border-[#8083ff] text-[#c0c1ff] bg-[#8083ff]/5'
                    : 'border-transparent text-[#94A3B8] hover:text-[#dfe2ef]'
                }`}
              >
                Interactive Transcript
              </button>
              <button
                onClick={() => setRightTab('chat')}
                className={`flex-1 py-3 text-xs font-bold border-b-2 transition flex items-center justify-center gap-2 ${
                  rightTab === 'chat'
                    ? 'border-[#8083ff] text-[#c0c1ff] bg-[#8083ff]/5'
                    : 'border-transparent text-[#94A3B8] hover:text-[#dfe2ef]'
                }`}
              >
                Chat with AI
              </button>
            </div>
 
            <div className="flex-1 flex flex-col overflow-hidden p-5">
              {rightTab === 'transcript' ? (
                <>
                  {/* Transcript Search & Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#232B45] mb-4 shrink-0">
                    <h3 className="text-sm font-bold font-display text-[#F8FAFC]">Dialogue Log</h3>
                    {meeting.status === 'completed' && (
                      <button
                        onClick={handleCopyTranscript}
                        className="px-2.5 py-1 text-[10px] font-semibold text-[#94A3B8] hover:text-[#dfe2ef] hover:bg-[#1c1f29] flex items-center gap-1.5 transition active:scale-95 border border-[#232B45] rounded-md"
                      >
                        {copied ? <Check className="w-3 h-3 text-[#34D399]" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy Text'}
                      </button>
                    )}
                  </div>
 
                  {meeting.status === 'completed' && (
                    <div className="relative mb-4 shrink-0">
                      <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        value={transcriptSearch}
                        onChange={(e) => setTranscriptSearch(e.target.value)}
                        placeholder="Filter dialogue text..."
                        className="w-full bg-[#0a0e17]/60 border border-[#232B45] rounded-lg pl-9 pr-3 py-2 text-xs text-[#dfe2ef] placeholder-[#464554] focus:outline-none focus:border-[#5de6ff]/40 transition"
                      />
                    </div>
                  )}
 
                  <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs leading-relaxed scrollbar-thin">
                    {meeting.status !== 'completed' ? (
                      <div className="flex flex-col items-center justify-center h-full text-[#94A3B8] gap-2">
                        <div className="w-6 h-6 border border-[#232B45] border-t-[#8083ff] rounded-full animate-spin" />
                        <p className="text-xs font-mono">Preparing transcript...</p>
                      </div>
                    ) : filteredTranscriptLines.length === 0 ? (
                      <p className="text-[#94A3B8] text-center py-10">No matching dialogue lines.</p>
                    ) : (
                      filteredTranscriptLines.map((line, idx) => {
                        const match = line.match(/^\[(\d{2}:\d{2})\]\s+([^(:]+)(?:\(([^)]+)\))?:\s*(.*)$/);
                        if (match) {
                          const [, timestamp, speaker, role, speech] = match;
                          return (
                            <div key={idx} className="p-3 rounded-lg bg-[#0a0e17]/40 hover:bg-[#1c1f29]/60 border border-transparent hover:border-[#232B45] transition-colors">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-[#dfe2ef] text-xs">{speaker.trim()}</span>
                                  {role && (
                                    <span className="text-[10px] text-[#94A3B8] bg-[#1c1f29] px-1.5 py-0.5 rounded border border-[#232B45]">
                                      {role.trim()}
                                    </span>
                                  )}
                                </div>
                                <button 
                                  onClick={() => {
                                    const [m, s] = timestamp.split(':').map(Number);
                                    setCurrentTime(m * 60 + s);
                                    setIsPlaying(true);
                                  }}
                                  className="text-[10px] font-mono text-[#5de6ff] bg-[#5de6ff]/10 hover:bg-[#5de6ff]/20 border border-[#5de6ff]/20 px-2 py-0.5 rounded transition cursor-pointer"
                                  title="Seek video to this timestamp"
                                >
                                  ▶ {timestamp}
                                </button>
                              </div>
                              <p className="text-[#c7c4d7]">
                                {transcriptSearch ? (
                                  (() => {
                                    const regex = new RegExp(`(${transcriptSearch})`, 'gi');
                                    const parts = speech.split(regex);
                                    return parts.map((part, i) => 
                                      regex.test(part) 
                                        ? <mark key={i} className="bg-[#8083ff]/30 text-[#c0c1ff] px-0.5 rounded">{part}</mark>
                                        : part
                                    );
                                  })()
                                ) : (
                                  speech
                                )}
                              </p>
                            </div>
                          );
                        }
                        return (
                          <p key={idx} className="text-[#c7c4d7] py-1 border-b border-[#232B45]/50">
                            {line}
                          </p>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                /* Chat with AI Panel */
                <div className="flex-grow flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-[#232B45] mb-4 shrink-0">
                    <h3 className="text-sm font-bold font-display text-[#F8FAFC]">AI Assistant</h3>
                    <button 
                      onClick={() => setChatHistory([])}
                      className="text-[10px] font-mono text-[#94A3B8] hover:text-white transition-colors"
                    >
                      Clear History
                    </button>
                  </div>
 
                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                    {chatHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#94A3B8] gap-2">
                        <span className="material-symbols-outlined text-[32px] text-zinc-600">forum</span>
                        <p className="text-xs font-semibold">Ask anything about this meeting!</p>
                        <p className="text-[10px] leading-relaxed max-w-xs text-zinc-500">
                          Query specific decisions, ownership items, warnings, or ask for a custom summary of the call.
                        </p>
                      </div>
                    ) : (
                      chatHistory.map((msg, idx) => (
                        <div 
                          key={idx} 
                          className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                        >
                          <span className="text-[9px] text-[#94A3B8] mb-1 font-mono uppercase tracking-wider">
                            {msg.sender === 'user' ? 'You' : 'AI Assistant'}
                          </span>
                          <div 
                            className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                              msg.sender === 'user' 
                                ? 'bg-violet-600 text-white rounded-tr-none' 
                                : 'bg-[#0a0e17]/80 border border-[#232B45] text-[#dfe2ef] rounded-tl-none'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      ))
                    )}
                    {chatLoading && (
                      <div className="flex flex-col max-w-[80%] mr-auto items-start">
                        <span className="text-[9px] text-[#94A3B8] mb-1 font-mono uppercase">AI Assistant</span>
                        <div className="bg-[#0a0e17]/80 border border-[#232B45] text-zinc-500 p-3.5 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    )}
                  </div>
 
                  {/* Chat input form */}
                  <form onSubmit={handleSendChatMessage} className="flex gap-2 mt-4 shrink-0">
                    <input 
                      type="text" 
                      value={chatQuery}
                      onChange={(e) => setChatQuery(e.target.value)}
                      placeholder="Ask about the replica setup, deadlines..."
                      className="flex-1 bg-[#0a0e17]/60 border border-[#232B45] rounded-xl px-4 py-2.5 text-xs text-[#dfe2ef] placeholder-[#464554] focus:outline-none focus:border-[#8083ff]/40 transition"
                      disabled={chatLoading}
                    />
                    <button 
                      type="submit" 
                      disabled={chatLoading || !chatQuery.trim()}
                      className="bg-violet-600 hover:bg-violet-500 disabled:bg-[#1c1f29] disabled:text-[#464554] text-white px-4 rounded-xl text-xs font-bold transition flex items-center justify-center border border-transparent disabled:border-[#232B45]"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
