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
  TrendingUp,
  Volume2
} from 'lucide-react';
import { Meeting } from '@/lib/db';

export default function HomePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Uploading states
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'transcribing' | 'extracting' | 'done' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch meetings
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

  useEffect(() => {
    fetchMeetings();
  }, []);

  // Poll processing meetings
  useEffect(() => {
    const processingMeetings = meetings.filter(m => m.status === 'processing');
    if (processingMeetings.length === 0) return;

    const timer = setInterval(async () => {
      const response = await fetch('/api/meetings');
      if (response.ok) {
        const data = await response.json();
        setMeetings(data);
        
        // If none are processing now, clear interval
        if (!data.some((m: Meeting) => m.status === 'processing')) {
          clearInterval(timer);
        }
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [meetings]);

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('audio/') || droppedFile.name.endsWith('.mp3') || droppedFile.name.endsWith('.wav') || droppedFile.name.endsWith('.m4a')) {
        setFile(droppedFile);
        if (!title) {
          setTitle(droppedFile.name.replace(/\.[^/.]+$/, ""));
        }
      } else {
        alert("Please upload an audio file (.mp3, .wav, .m4a)");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // Upload Action
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploadStatus('uploading');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name.replace(/\.[^/.]+$/, ""));

    // Simulate upload states transitions for better UX if runs locally in mock mode
    let progressTimer: NodeJS.Timeout;
    const isMock = !process.env.NEXT_PUBLIC_OPENAI_API_KEY && !process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

    if (isMock) {
      progressTimer = setTimeout(() => {
        setUploadStatus('transcribing');
        progressTimer = setTimeout(() => {
          setUploadStatus('extracting');
        }, 3000);
      }, 1500);
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(progressTimer!);

      if (response.ok) {
        setUploadStatus('done');
        setFile(null);
        setTitle('');
        fetchMeetings();
        setTimeout(() => setUploadStatus('idle'), 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process file');
      }
    } catch (error: any) {
      console.error(error);
      setUploadStatus('failed');
      setErrorMessage(error.message || 'Verification or processing failed.');
    }
  };

  // Delete Action
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting?')) return;

    try {
      const response = await fetch(`/api/meetings/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setMeetings(meetings.filter(m => m.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete meeting:', error);
    }
  };

  // Stats Calculations
  const totalMeetings = meetings.length;
  const completedMeetings = meetings.filter(m => m.status === 'completed');
  
  let totalActionItems = 0;
  let completedActionItems = 0;
  let highRisksCount = 0;

  completedMeetings.forEach(m => {
    if (m.analysis) {
      if (m.analysis.actionItems) {
        totalActionItems += m.analysis.actionItems.length;
        completedActionItems += m.analysis.actionItems.filter(a => a.status === 'completed').length;
      }
      if (m.analysis.risks) {
        highRisksCount += m.analysis.risks.filter(r => r.impact === 'high').length;
      }
    }
  });

  // Filter meetings
  const filteredMeetings = meetings.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display bg-gradient-to-r from-violet-400 via-fuchsia-400 to-[#c0c1ff] bg-clip-text text-transparent">
            Company Memory
          </h1>
          <p className="text-zinc-400 mt-1.5 text-sm">
            Access previous transcripts, action items, key decisions, and system logs.
          </p>
        </div>
        
        {/* Connection status tag */}
        <div className="self-start px-3 py-1.5 rounded-full bg-[#181b25] border border-[#232B45] flex items-center gap-2 text-xs font-medium text-[#94A3B8]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Local Database Connected
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="glow-card p-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Processed</p>
            <h3 className="text-3xl font-bold font-display mt-1 text-zinc-50">{totalMeetings}</h3>
            <p className="text-xs text-zinc-400 mt-1">Total sync documents</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
            <Volume2 className="w-6 h-6" />
          </div>
        </div>

        <div className="glow-card p-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Action Completion</p>
            <h3 className="text-3xl font-bold font-display mt-1 text-zinc-50">
              {totalActionItems > 0 ? Math.round((completedActionItems / totalActionItems) * 100) : 0}%
            </h3>
            <p className="text-xs text-zinc-400 mt-1">{completedActionItems} / {totalActionItems} tasks done</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="glow-card p-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Critical Risks</p>
            <h3 className="text-3xl font-bold font-display mt-1 text-rose-400">{highRisksCount}</h3>
            <p className="text-xs text-zinc-400 mt-1">Requiring direct mitigation</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="glow-card p-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Engine Mode</p>
            <h3 className="text-2xl font-bold font-display mt-1 text-fuchsia-400">Hybrid AI</h3>
            <p className="text-xs text-zinc-400 mt-1">Whisper-1 + Claude 3.5</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start mb-12">
        {/* Upload Form (Left Column) */}
        <div className="lg:col-span-1">
          <div className="glow-card p-6 border border-zinc-800">
            <h2 className="text-xl font-bold font-display mb-4 text-zinc-100 flex items-center gap-2">
              <span>New Analysis</span>
            </h2>
            
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Drag & Drop Area */}
              <div 
                className={`relative border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center text-center cursor-pointer ${
                  dragActive 
                    ? 'border-violet-500 bg-violet-500/5' 
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/50'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="audio/*"
                  onChange={handleFileChange}
                />
                
                <UploadCloud className="w-10 h-10 text-zinc-500 mb-3" />
                
                {file ? (
                  <div className="w-full">
                    <p className="text-sm font-semibold text-zinc-200 truncate px-2">{file.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-zinc-300">Drag audio file here, or browse</p>
                    <p className="text-xs text-zinc-500 mt-1">Supports MP3, WAV, M4A up to 25MB</p>
                  </div>
                )}
              </div>

              {/* Title input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Meeting Title (Optional)
                </label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sales Standup Sync"
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                />
              </div>

              {/* Upload Button or Process State */}
              {uploadStatus === 'idle' ? (
                <button
                  type="submit"
                  disabled={!file}
                  className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold tracking-wide transition flex items-center justify-center gap-2 ${
                    file 
                      ? 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-lg shadow-violet-600/20' 
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  Generate Intelligence
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-violet-400 capitalize flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
                      {uploadStatus === 'uploading' && 'Uploading audio...'}
                      {uploadStatus === 'transcribing' && 'Transcribing with Whisper...'}
                      {uploadStatus === 'extracting' && 'Structuring with Claude 3.5...'}
                      {uploadStatus === 'done' && 'Done! Formatting insights...'}
                      {uploadStatus === 'failed' && 'Process failed'}
                    </span>
                    <span className="text-zinc-500">
                      {uploadStatus === 'uploading' && '20%'}
                      {uploadStatus === 'transcribing' && '50%'}
                      {uploadStatus === 'extracting' && '85%'}
                      {uploadStatus === 'done' && '100%'}
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500" 
                      style={{
                        width: 
                          uploadStatus === 'uploading' ? '20%' :
                          uploadStatus === 'transcribing' ? '50%' :
                          uploadStatus === 'extracting' ? '85%' :
                          uploadStatus === 'done' ? '100%' : '0%'
                      }}
                    />
                  </div>
                  
                  {uploadStatus === 'failed' && (
                    <p className="text-xs text-rose-500 font-medium leading-relaxed">{errorMessage}</p>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Meeting List (Right 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* List Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-900/40 border border-zinc-900 p-4 rounded-2xl">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search processed meetings..."
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition"
              />
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
              <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
              <p className="text-sm font-medium">Loading sync dashboard...</p>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="glow-card border-dashed border-zinc-800 p-12 text-center flex flex-col items-center justify-center">
              <FileText className="w-12 h-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-bold text-zinc-300">No meeting reports yet</h3>
              <p className="text-sm text-zinc-500 max-w-sm mt-1 mx-auto">
                {searchQuery ? 'No results match your search query.' : 'Upload your first meeting recording to generate intelligence dashboard.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredMeetings.map((meeting) => {
                const formattedDate = new Date(meeting.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                
                const isProcessing = meeting.status === 'processing';
                
                return (
                  <div key={meeting.id} className="relative group">
                    <Link href={isProcessing ? '#' : `/meeting/${meeting.id}`}>
                      <div className="glow-card p-6 h-full flex flex-col justify-between cursor-pointer border border-zinc-900">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-bold text-lg text-zinc-100 group-hover:text-violet-400 transition line-clamp-2">
                              {meeting.title}
                            </h3>
                            <button
                              onClick={(e) => handleDelete(meeting.id, e)}
                              className="text-zinc-600 hover:text-rose-400 p-1 rounded-lg hover:bg-zinc-800/40 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Delete meeting"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-zinc-500">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                              {formattedDate}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-zinc-600" />
                              {meeting.duration}
                            </span>
                          </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-zinc-900">
                          {isProcessing ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-violet-400 font-medium">
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
                                  Running AI analysis pipeline...
                                </span>
                              </div>
                              <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full animate-pulse-slow w-[65%]" />
                              </div>
                            </div>
                          ) : meeting.status === 'failed' ? (
                            <div className="flex items-center gap-2 text-rose-500 text-xs font-semibold bg-rose-500/5 border border-rose-500/10 rounded-lg p-2.5">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span className="truncate">Pipeline failed: {meeting.error || 'Unknown error'}</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex gap-3 text-xs font-medium">
                                <span className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                                  {meeting.analysis?.decisions.length || 0} Decs
                                </span>
                                <span className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                                  {meeting.analysis?.actionItems.length || 0} Actions
                                </span>
                                {meeting.analysis?.risks && meeting.analysis.risks.length > 0 && (
                                  <span className="px-2.5 py-1 rounded-full bg-rose-950/20 border border-rose-900/20 text-rose-400">
                                    {meeting.analysis.risks.length} Risks
                                  </span>
                                )}
                              </div>
                              <span className="text-zinc-500 group-hover:text-violet-400 transition text-xs font-bold flex items-center gap-1">
                                View
                                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
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
