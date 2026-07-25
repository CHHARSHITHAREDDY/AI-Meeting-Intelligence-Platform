'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, ArrowRight, Sparkles, Check, FileText, AlertTriangle, Play } from 'lucide-react';

function YouTubeIcon({ className = "w-4 h-4 text-rose-500" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

export default function YouTubeUploadPage() {
  const router = useRouter();

  // Mode: 'youtube' | 'file'
  const [activeTab, setActiveTab] = useState<'youtube' | 'file'>('youtube');

  // YouTube Input State
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status & Error handling
  const [status, setStatus] = useState<'idle' | 'downloading' | 'transcribing' | 'summarizing' | 'done' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Handle YouTube URL Submit
  const handleYouTubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setStatus('downloading');
    setErrorMessage('');

    try {
      const statusSequence: ('downloading' | 'transcribing' | 'summarizing')[] = [
        'downloading',
        'transcribing',
        'summarizing'
      ];
      let stepIdx = 0;
      const interval = setInterval(() => {
        if (stepIdx < statusSequence.length) {
          setStatus(statusSequence[stepIdx]);
          stepIdx++;
        }
      }, 2500);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link: youtubeUrl.trim(),
          title: videoTitle.trim() || undefined
        })
      });

      clearInterval(interval);

      if (res.ok) {
        const meeting = await res.json();
        setStatus('done');
        setTimeout(() => {
          router.push(`/dashboard/meeting/${meeting.id}`);
        }, 800);
      } else {
        const errData = await res.json();
        setStatus('failed');
        setErrorMessage(errData.error || 'Failed to extract transcript from YouTube URL.');
      }
    } catch (err: any) {
      setStatus('failed');
      setErrorMessage(err.message || 'Network error occurred while fetching YouTube transcript.');
    }
  };

  // Handle Local File Submit
  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('transcribing');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);
    if (videoTitle) formData.append('title', videoTitle);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const meeting = await res.json();
        setStatus('done');
        setTimeout(() => {
          router.push(`/dashboard/meeting/${meeting.id}`);
        }, 800);
      } else {
        const errData = await res.json();
        setStatus('failed');
        setErrorMessage(errData.error || 'Failed to process audio file.');
      }
    } catch (err: any) {
      setStatus('failed');
      setErrorMessage(err.message || 'Network error occurred while uploading file.');
    }
  };

  // Drag & Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full min-h-[85vh] flex flex-col items-center justify-center p-6 text-center font-sans antialiased">
      
      {/* Container Card */}
      <div className="w-full max-w-3xl space-y-8 animate-fade-in">

        {/* Tab Switcher: YouTube URL vs Local File */}
        <div className="inline-flex p-1.5 bg-[#121624] border border-[#232B45] rounded-full shadow-lg">
          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === 'youtube'
                ? 'bg-[#6366F1] text-white shadow-md shadow-[#6366F1]/30'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <YouTubeIcon className="w-4 h-4 text-rose-400" />
            <span>YouTube URL</span>
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeTab === 'file'
                ? 'bg-[#6366F1] text-white shadow-md shadow-[#6366F1]/30'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-[#5DE6FF]" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Header Section (Matching User Screenshot) */}
        {activeTab === 'youtube' ? (
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              Free <span className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">YouTube Transcript</span> Generator
            </h1>
            <p className="text-sm md:text-base text-[#94A3B8] font-medium">
              Instantly, without uploading video files.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              Upload <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">Audio or Video</span> File
            </h1>
            <p className="text-sm md:text-base text-[#94A3B8] font-medium">
              Extract transcript, summary, key decisions, and chat with AI copilot.
            </p>
          </div>
        )}

        {/* Main Interactive Form Card */}
        {activeTab === 'youtube' ? (
          <form onSubmit={handleYouTubeSubmit} className="space-y-6">
            
            {/* Input Box & Button (Matching User Screenshot Layout) */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#121624]/90 p-2 border border-[#232B45] rounded-full shadow-2xl focus-within:border-[#6366F1] transition-all max-w-2xl mx-auto backdrop-blur-md">
              <div className="relative flex-1 w-full pl-4">
                <input
                  type="url"
                  required
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Enter YouTube URL.. https://www.youtube.com/watch?v=Mcm3CDM..."
                  className="w-full bg-transparent text-xs md:text-sm text-white placeholder-[#94A3B8]/60 outline-none py-2.5 pr-2"
                />
              </div>

              <button
                type="submit"
                disabled={!youtubeUrl.trim() || status !== 'idle'}
                className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 transition shadow-lg shadow-indigo-600/30 border border-white/20 disabled:opacity-40 cursor-pointer shrink-0 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <span>Get Video Transcript</span>
              </button>
            </div>

            {/* Subtext */}
            <p className="text-xs text-[#94A3B8] font-mono">
              Quick and simple. No catch.
            </p>

          </form>
        ) : (
          <form onSubmit={handleFileSubmit} className="space-y-6 max-w-xl mx-auto">
            
            {/* File Drag and Drop Box */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 transition cursor-pointer flex flex-col items-center justify-center space-y-4 ${
                dragActive
                  ? 'border-[#5DE6FF] bg-[#5DE6FF]/10'
                  : 'border-[#232B45] hover:border-[#6366F1] bg-[#121624]/90'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.mp4,.mov,audio/*,video/*"
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#5DE6FF] p-0.5 shadow-lg shadow-[#6366F1]/20">
                <div className="w-full h-full bg-[#0A0E17] rounded-[14px] flex items-center justify-center">
                  <UploadCloud className="w-8 h-8 text-[#5DE6FF]" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white">
                  {file ? file.name : 'Click to upload or drag & drop video/audio file'}
                </p>
                <p className="text-xs text-[#94A3B8] mt-1">Supports MP4, MOV, MP3, WAV or M4A</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={!file || status !== 'idle'}
              className="w-full py-3.5 rounded-2xl text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition shadow-lg shadow-[#6366F1]/30 disabled:opacity-40 cursor-pointer"
            >
              Start Processing Audio File
            </button>

          </form>
        )}

        {/* Pipeline Processing Indicator */}
        {status !== 'idle' && (
          <div className="max-w-md mx-auto bg-[#121624] border border-[#232B45] p-5 rounded-2xl shadow-2xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#5DE6FF]">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#6366F1] animate-spin" />
                Processing YouTube Transcript Pipeline...
              </span>
              <span className="capitalize text-white font-mono">{status}</span>
            </div>
            <div className="w-full bg-[#0A0E17] h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-[#6366F1] via-fuchsia-500 to-[#5DE6FF] h-full transition-all duration-500 w-3/4 animate-pulse" />
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Extracting dialogue speech, classifying content, generating summary, action items, and indexing for RAG chat...
            </p>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="max-w-md mx-auto bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl text-xs text-rose-300 flex items-center gap-3 text-left">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

      </div>

    </div>
  );
}
