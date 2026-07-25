'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Sparkles, UploadCloud, FileText, CheckCircle2, AlertTriangle, 
  ArrowRight, FolderPlus, Check, ChevronDown 
} from 'lucide-react';
import LanguageSelect from '@/app/components/LanguageSelect';
import { TranscriptionLanguage } from '@/lib/whisper';

interface Project {
  id: string;
  name: string;
}

function YouTubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function ProjectPicker({
  projects,
  selectedProjectId,
  setSelectedProjectId,
  onProjectCreated,
}: {
  projects: Project[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  onProjectCreated: (p: Project) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      if (res.ok) {
        const p = await res.json();
        onProjectCreated(p);
        setSelectedProjectId(p.id);
        setNewName('');
        setNewDesc('');
        setIsCreating(false);
        setIsOpen(false);
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative max-w-md mx-auto w-full text-left">
      <label className="block text-xs font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5 font-bold">
        Target Workspace Project <span className="text-rose-400">*</span>
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[#121624]/90 border border-[#232B45] hover:border-[#6366F1] px-4 py-3 rounded-2xl text-xs md:text-sm text-white transition cursor-pointer shadow-lg backdrop-blur-md"
      >
        <span className="truncate">
          {selectedProject ? selectedProject.name : 'Select or Create a Project...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-[#121624] border border-[#232B45] rounded-2xl p-2 shadow-2xl z-50 max-h-64 overflow-y-auto space-y-1">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedProjectId(p.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-left transition cursor-pointer ${
                selectedProjectId === p.id
                  ? 'bg-[#6366F1] text-white font-bold'
                  : 'text-[#dfe2ef] hover:bg-[#181b25]'
              }`}
            >
              <span className="truncate">{p.name}</span>
              {selectedProjectId === p.id && <Check className="w-4 h-4 shrink-0" />}
            </button>
          ))}

          {!isCreating ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#5de6ff] hover:bg-[#5de6ff]/10 transition cursor-pointer border-t border-[#232B45] mt-1"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create New Project...</span>
            </button>
          ) : (
            <form onSubmit={handleCreate} className="p-3 bg-[#0a0e17] rounded-xl border border-[#232B45] space-y-2 mt-1">
              <p className="text-[11px] font-bold text-white uppercase tracking-wider">New Project</p>
              <input
                type="text"
                required
                placeholder="Project Name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[#181b25] text-xs text-white border border-[#232B45] px-3 py-1.5 rounded-lg outline-none focus:border-[#6366F1]"
              />
              <input
                type="text"
                placeholder="Description (optional)..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full bg-[#181b25] text-xs text-white border border-[#232B45] px-3 py-1.5 rounded-lg outline-none focus:border-[#6366F1]"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1 rounded-lg text-xs text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newName.trim()}
                  className="px-3 py-1 bg-[#6366F1] hover:bg-[#5254cc] text-white rounded-lg text-xs font-bold transition disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function UploadPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetingIdParam = searchParams?.get('meetingId') || '';
  const projectIdParam = searchParams?.get('projectId') || '';

  const [activeTab, setActiveTab] = useState<'youtube' | 'file'>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdParam);
  const [language, setLanguage] = useState<TranscriptionLanguage>('auto');

  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setProjects(list);
        setProjectsLoaded(true);

        if (!selectedProjectId && list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
      })
      .catch(() => setProjectsLoaded(true));
  }, []);

  const handleYouTubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim() || !selectedProjectId) return;

    setStatus('processing');
    setErrorMessage('');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link: youtubeUrl.trim(),
          projectId: selectedProjectId,
          meetingId: meetingIdParam || undefined,
          language,
        }),
      });

      const data = await res.json();
      if (res.ok && data.id) {
        setStatus('completed');
        router.push(`/dashboard/meeting/${data.id}`);
      } else {
        throw new Error(data.error || 'Failed to process YouTube link');
      }
    } catch (err: any) {
      console.error('YouTube submit error:', err);
      setStatus('failed');
      setErrorMessage(err.message || 'Processing failed.');
    }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedProjectId) return;

    setStatus('uploading');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', selectedProjectId);
      if (meetingIdParam) formData.append('meetingId', meetingIdParam);
      formData.append('language', language);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.id) {
        setStatus('completed');
        router.push(`/dashboard/meeting/${data.id}`);
      } else {
        throw new Error(data.error || 'Failed to process file upload');
      }
    } catch (err: any) {
      console.error('File submit error:', err);
      setStatus('failed');
      setErrorMessage(err.message || 'Upload failed.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
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
      <div className="w-full max-w-3xl space-y-8 animate-fade-in">

        {/* Tab Switcher & Language Selector Header */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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

          <LanguageSelect value={language} onChange={setLanguage} />
        </div>

        {/* Header Section */}
        {activeTab === 'youtube' ? (
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              Free <span className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">YouTube Transcript</span> Generator
            </h1>
            <p className="text-sm md:text-base text-[#94A3B8] font-medium">
              Instantly, without uploading video files. Supports English, Hindi & Telugu.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              Upload <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">Audio or Video</span> File
            </h1>
            <p className="text-sm md:text-base text-[#94A3B8] font-medium">
              Extract transcript, summary, key decisions, and chat with AI copilot in English, Hindi & Telugu.
            </p>
          </div>
        )}

        {/* Project Picker */}
        {projectsLoaded && (
          <ProjectPicker
            projects={projects}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            onProjectCreated={(p) => setProjects((prev) => [p, ...prev])}
          />
        )}

        {/* Form Card */}
        {activeTab === 'youtube' ? (
          <form onSubmit={handleYouTubeSubmit} className="space-y-6">
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
                disabled={!youtubeUrl.trim() || !selectedProjectId || status !== 'idle'}
                className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 transition shadow-lg shadow-indigo-600/30 border border-white/20 disabled:opacity-40 cursor-pointer shrink-0 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <span>Get Video Transcript</span>
              </button>
            </div>

            <p className="text-xs text-[#94A3B8] font-mono">
              {selectedProjectId ? 'Quick and simple. No catch.' : 'Select or create a project above to continue.'}
            </p>
          </form>
        ) : (
          <form onSubmit={handleFileSubmit} className="space-y-6 max-w-xl mx-auto">
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
              disabled={!file || !selectedProjectId || status !== 'idle'}
              className="w-full py-3.5 rounded-2xl text-xs font-bold text-white bg-[#6366F1] hover:bg-[#5254cc] transition shadow-lg shadow-[#6366F1]/30 disabled:opacity-40 cursor-pointer"
            >
              {selectedProjectId ? 'Start Processing Audio File' : 'Select or create a project above to continue'}
            </button>
          </form>
        )}

        {/* Pipeline Processing Indicator */}
        {status !== 'idle' && (
          <div className="max-w-md mx-auto bg-[#121624] border border-[#232B45] p-5 rounded-2xl shadow-2xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#5DE6FF]">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#6366F1] animate-spin" />
                Processing Multilingual Transcript Pipeline...
              </span>
              <span className="capitalize text-white font-mono">{status}</span>
            </div>
            <div className="w-full bg-[#0A0E17] h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-[#6366F1] via-fuchsia-500 to-[#5DE6FF] h-full transition-all duration-500 w-3/4 animate-pulse" />
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Transcribing speech in {language === 'auto' ? 'Auto-detected language' : language.toUpperCase()}, extracting insights, and indexing for RAG chat...
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

export default function YouTubeUploadPage() {
  return (
    <Suspense fallback={<div className="w-full h-[60vh]" />}>
      <UploadPageInner />
    </Suspense>
  );
}
