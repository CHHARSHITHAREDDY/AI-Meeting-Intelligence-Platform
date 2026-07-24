'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  UploadCloud, 
  Search, 
  Trash2, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckSquare, 
  FileText,
  Activity,
  ArrowRight,
  Volume2
} from 'lucide-react';
import { Meeting } from '@/lib/db';

export default function HomePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'transcribing' | 'extracting' | 'done' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMeetings = async () => {
    try {
      const response = await fetch('/api/meetings');
      if (response.ok) {
        const data = await response.json();
        setMeetings(data);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMeetings(); }, []);

  useEffect(() => {
    const processingMeetings = meetings.filter(m => m.status === 'processing');
    if (processingMeetings.length === 0) return;
    const timer = setInterval(async () => {
      const response = await fetch('/api/meetings');
      if (response.ok) {
        const data = await response.json();
        setMeetings(data);
        if (!data.some((m: Meeting) => m.status === 'processing')) clearInterval(timer);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [meetings]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (
        droppedFile.type.startsWith('audio/') || 
        droppedFile.type.startsWith('video/') || 
        droppedFile.name.endsWith('.mp3') || 
        droppedFile.name.endsWith('.wav') || 
        droppedFile.name.endsWith('.m4a') ||
        droppedFile.name.endsWith('.mp4')
      ) {
        setFile(droppedFile);
        setLink(''); // Clear link
        if (!title) setTitle(droppedFile.name.replace(/\.[^/.]+$/, ""));
      } else {
        alert("Please upload an audio or video file (.mp3, .wav, .m4a, .mp4)");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setLink(''); // Clear link
      if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !link) return;
 
    setUploadStatus('uploading'); setErrorMessage('');
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (link) {
      formData.append('link', link);
    }
    formData.append('title', title || (file ? file.name.replace(/\.[^/.]+$/, "") : "Link Sync Analysis"));
    
    let progressTimer: NodeJS.Timeout;
    const isMock = !process.env.NEXT_PUBLIC_OPENAI_API_KEY && !process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    if (isMock) {
      progressTimer = setTimeout(() => {
        setUploadStatus('transcribing');
        progressTimer = setTimeout(() => { setUploadStatus('extracting'); }, 3000);
      }, 1500);
    }
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      clearTimeout(progressTimer!);
      if (response.ok) {
        setUploadStatus('done'); setFile(null); setLink(''); setTitle('');
        fetchMeetings();
        setTimeout(() => setUploadStatus('idle'), 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process file or link');
      }
    } catch (error: any) {
      console.error(error);
      setUploadStatus('failed');
      setErrorMessage(error.message || 'Verification or processing failed.');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    try {
      const response = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
      if (response.ok) setMeetings(meetings.filter(m => m.id !== id));
    } catch (error) {
      console.error('Failed to delete meeting:', error);
    }
  };

  const totalMeetings = meetings.length;
  const completedMeetings = meetings.filter(m => m.status === 'completed');
  let totalActionItems = 0, completedActionItems = 0, highRisksCount = 0;
  completedMeetings.forEach(m => {
    if (m.analysis) {
      if (m.analysis.actionItems) {
        totalActionItems += m.analysis.actionItems.length;
        completedActionItems += m.analysis.actionItems.filter(a => a.status === 'completed').length;
      }
      if (m.analysis.risks) highRisksCount += m.analysis.risks.filter(r => r.impact === 'high').length;
    }
  });

  const filteredMeetings = meetings.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-display text-[#F8FAFC]">
            Company Memory
          </h1>
          <p className="text-[#94A3B8] mt-1.5 text-sm">
            Access previous transcripts, action items, key decisions, and system logs.
          </p>
        </div>
        <div className="self-start px-3 py-1.5 rounded-full bg-[#1c1f29] border border-[#232B45] flex items-center gap-2 text-[11px] font-medium text-[#94A3B8] font-mono">
          <span className="w-2 h-2 rounded-full bg-[#34D399] animate-live-pulse" />
          Local Database Connected
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 stagger-children">
        {[
          { label: 'Processed', value: totalMeetings, sub: 'Total sync documents', icon: <Volume2 className="w-5 h-5" />, color: '#c0c1ff', bg: 'rgba(192,193,255,0.08)' },
          { label: 'Action Completion', value: `${totalActionItems > 0 ? Math.round((completedActionItems / totalActionItems) * 100) : 0}%`, sub: `${completedActionItems} / ${totalActionItems} tasks done`, icon: <CheckSquare className="w-5 h-5" />, color: '#34D399', bg: 'rgba(52,211,153,0.08)' },
          { label: 'Critical Risks', value: highRisksCount, sub: 'Requiring direct mitigation', icon: <AlertTriangle className="w-5 h-5" />, color: '#ffb4ab', bg: 'rgba(255,180,171,0.08)' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] font-mono" style={{ color: '#94A3B8' }}>{stat.label}</p>
              <h3 className="text-2xl font-bold font-display mt-1" style={{ color: stat.color }}>{stat.value}</h3>
              <p className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>{stat.sub}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: stat.bg, color: stat.color }}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Upload Form */}
        <div className="lg:col-span-1">
          <div className="glass-card p-5">
            <h2 className="text-base font-bold font-display mb-4 text-[#F8FAFC] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#5de6ff]">add_circle</span>
              New Analysis
            </h2>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center text-center cursor-pointer ${
                  dragActive ? 'border-[#8083ff] bg-[#8083ff]/5' : 'border-[#232B45] hover:border-[#464554] bg-[#0a0e17]/50'
                }`}
                onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag}
                onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept="audio/*,video/*" onChange={handleFileChange} />
                <UploadCloud className="w-10 h-10 text-[#464554] mb-3" />
                {file ? (
                  <div className="w-full">
                    <p className="text-sm font-semibold text-[#dfe2ef] truncate px-2">{file.name}</p>
                    <p className="text-xs text-[#94A3B8] mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-[#c7c4d7]">Drag audio/video file here, or browse</p>
                    <p className="text-xs text-[#94A3B8] mt-1">Supports MP3, WAV, M4A, MP4 up to 25MB</p>
                  </div>
                )}
              </div>
 
              {/* Separator */}
              <div className="flex items-center text-center my-3.5">
                <div className="flex-grow border-t border-[#232B45]"></div>
                <span className="flex-shrink mx-3 text-[10px] uppercase tracking-wider text-[#94A3B8] font-mono">Or paste a link</span>
                <div className="flex-grow border-t border-[#232B45]"></div>
              </div>
 
              {/* Link Input */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8] mb-1.5 font-mono">
                  YouTube Video or Audio/Video URL
                </label>
                <input
                  type="text" value={link} onChange={(e) => {
                    setLink(e.target.value);
                    if (e.target.value) setFile(null); // Clear file selection if link is pasted
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-[#0a0e17]/60 border border-[#232B45] rounded-lg px-4 py-3 text-sm text-[#dfe2ef] placeholder-[#464554] focus:outline-none focus:border-[#5de6ff]/40 transition"
                />
              </div>
 
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8] mb-1.5 font-mono">Meeting Title (Optional)</label>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sales Standup Sync"
                  className="w-full bg-[#0a0e17]/60 border border-[#232B45] rounded-lg px-4 py-3 text-sm text-[#dfe2ef] placeholder-[#464554] focus:outline-none focus:border-[#5de6ff]/40 transition"
                />
              </div>
 
              {uploadStatus === 'idle' ? (
                <button type="submit" disabled={!file && !link}
                  className={`w-full py-3 px-4 rounded-lg text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 ${
                    file || link ? 'btn-primary-cta cursor-pointer' : 'bg-[#1c1f29] text-[#464554] cursor-not-allowed border border-[#232B45]'
                  }`}
                >
                  Generate Intelligence
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-full bg-[#0a0e17] border border-[#232B45] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-[#c0c1ff] capitalize flex items-center gap-1.5 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c0c1ff] animate-ping" />
                      {uploadStatus === 'uploading' && 'Uploading audio...'}
                      {uploadStatus === 'transcribing' && 'Transcribing with Whisper...'}
                      {uploadStatus === 'extracting' && 'Structuring with Claude 3.5...'}
                      {uploadStatus === 'done' && 'Done! Formatting insights...'}
                      {uploadStatus === 'failed' && 'Process failed'}
                    </span>
                    <span className="text-[#94A3B8] font-mono">
                      {uploadStatus === 'uploading' && '20%'}
                      {uploadStatus === 'transcribing' && '50%'}
                      {uploadStatus === 'extracting' && '85%'}
                      {uploadStatus === 'done' && '100%'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#0a0e17] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#8083ff] to-[#5de6ff] rounded-full transition-all duration-500" style={{
                      width: uploadStatus === 'uploading' ? '20%' : uploadStatus === 'transcribing' ? '50%' : uploadStatus === 'extracting' ? '85%' : uploadStatus === 'done' ? '100%' : '0%'
                    }} />
                  </div>
                  {uploadStatus === 'failed' && <p className="text-xs text-[#ffb4ab] font-medium leading-relaxed">{errorMessage}</p>}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Meeting List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3 glass-card p-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search processed meetings..."
                className="w-full bg-[#0a0e17]/60 border border-[#232B45] rounded-lg pl-10 pr-4 py-2 text-sm text-[#dfe2ef] placeholder-[#464554] focus:outline-none focus:border-[#5de6ff]/40 transition"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#94A3B8]">
              <div className="w-8 h-8 rounded-full border-2 border-[#8083ff]/20 border-t-[#8083ff] animate-spin" />
              <p className="text-sm font-medium font-mono">Loading sync dashboard...</p>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="glass-card border-dashed p-12 text-center flex flex-col items-center justify-center">
              <FileText className="w-12 h-12 text-[#464554] mb-3" />
              <h3 className="text-lg font-bold text-[#c7c4d7]">No meeting reports yet</h3>
              <p className="text-sm text-[#94A3B8] max-w-sm mt-1 mx-auto">
                {searchQuery ? 'No results match your search query.' : 'Upload your first meeting recording to generate intelligence dashboard.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
              {filteredMeetings.map((meeting) => {
                const formattedDate = new Date(meeting.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const isProcessing = meeting.status === 'processing';
                return (
                  <div key={meeting.id} className="relative group">
                    <Link href={isProcessing ? '#' : `/dashboard/meeting/${meeting.id}`}>
                      <div className="glass-card p-5 h-full flex flex-col justify-between cursor-pointer hover:border-[#c0c1ff]/20">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-bold text-[15px] text-[#F8FAFC] group-hover:text-[#c0c1ff] transition line-clamp-2">{meeting.title}</h3>
                            <button onClick={(e) => handleDelete(meeting.id, e)}
                              className="text-[#464554] hover:text-[#ffb4ab] p-1 rounded-lg hover:bg-[#1c1f29] transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Delete meeting"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-[#94A3B8]">
                            <span className="flex items-center gap-1.5 font-mono">
                              <Calendar className="w-3.5 h-3.5 text-[#464554]" />{formattedDate}
                            </span>
                            <span className="flex items-center gap-1.5 font-mono">
                              <Clock className="w-3.5 h-3.5 text-[#464554]" />{meeting.duration}
                            </span>
                          </div>
                        </div>
                        <div className="mt-5 pt-4 border-t border-[#232B45]">
                          {isProcessing ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-[#c0c1ff] font-medium font-mono">
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#c0c1ff] animate-ping" />Running AI analysis...
                                </span>
                              </div>
                              <div className="w-full h-1 bg-[#0a0e17] rounded-full overflow-hidden">
                                <div className="h-full bg-[#8083ff] rounded-full animate-pulse-slow w-[65%]" />
                              </div>
                            </div>
                          ) : meeting.status === 'failed' ? (
                            <div className="flex items-center gap-2 text-[#ffb4ab] text-xs font-semibold bg-[#ffb4ab]/5 border border-[#ffb4ab]/10 rounded-lg p-2.5">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span className="truncate">Pipeline failed: {meeting.error || 'Unknown error'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex gap-2 text-[11px] font-medium font-mono">
                                <span className="px-2 py-1 rounded-md bg-[#1c1f29] border border-[#232B45] text-[#c0c1ff]">
                                  {meeting.analysis?.decisions.length || 0} Decs
                                </span>
                                <span className="px-2 py-1 rounded-md bg-[#1c1f29] border border-[#232B45] text-[#5de6ff]">
                                  {meeting.analysis?.actionItems.length || 0} Actions
                                </span>
                                {meeting.analysis?.risks && meeting.analysis.risks.length > 0 && (
                                  <span className="px-2 py-1 rounded-md bg-[#ffb4ab]/5 border border-[#ffb4ab]/10 text-[#ffb4ab]">
                                    {meeting.analysis.risks.length} Risks
                                  </span>
                                )}
                              </div>
                              <span className="text-[#94A3B8] group-hover:text-[#5de6ff] transition text-xs font-bold flex items-center gap-1">
                                View <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
