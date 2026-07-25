'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  Search,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  CheckSquare,
  FileText,
  Copy,
  Check,
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  ListChecks,
  MessageSquare,
  FileCheck,
  Zap,
  ChevronRight,
  X,
  GraduationCap,
  BookOpen,
  Layers,
  HelpCircle,
  Code2,
  Terminal,
  Package,
  Plug,
  Mic2,
  History,
  Link2
} from 'lucide-react';
import { Meeting, ActionItem, MindmapNode } from '@/lib/db';
import { ContentType } from '@/lib/classify';

const CONTENT_TYPE_META: Record<ContentType, { label: string; icon: React.ReactNode }> = {
  meeting: { label: 'Meeting', icon: <FileCheck className="w-3 h-3" /> },
  lecture: { label: 'Lecture', icon: <GraduationCap className="w-3 h-3" /> },
  coding: { label: 'Coding Session', icon: <Code2 className="w-3 h-3" /> },
  podcast: { label: 'Podcast', icon: <Mic2 className="w-3 h-3" /> },
  general: { label: 'General', icon: <FileText className="w-3 h-3" /> },
};

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export default function MeetingIntelligenceSaaSPage() {
  // Meetings state from backend API
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  // Upload & Drag-and-Drop State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'transcribing' | 'summarizing' | 'decisions' | 'actions' | 'done' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statsContainerRef = useRef<HTMLDivElement>(null);

  // Active Main Content View Tabs ('transcript' | 'summary')
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');

  // Transcript Features State
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  // Lecture: Flashcards & Quiz interactive state
  const [flippedFlashcards, setFlippedFlashcards] = useState<Set<number>>(new Set());
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  // AI Copilot Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch all user meetings from backend API
  const fetchMeetings = async () => {
    try {
      const response = await fetch('/api/meetings');
      if (response.ok) {
        const data: Meeting[] = await response.json();
        setMeetings(data);
      }
    } catch (error) {
      console.error('[SaaS Page] Failed to fetch meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.mov'];
    const fileName = selectedFile.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext)) ||
      selectedFile.type.startsWith('audio/') ||
      selectedFile.type.startsWith('video/');

    if (isValid) {
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    } else {
      alert("Please upload a valid audio (.mp3, .wav, .m4a) or video (.mp4, .mov) file.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  // Upload and Process File through Backend Pipeline
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploadStatus('uploading');
    setErrorMessage('');

    // Animate processing progress steps for SaaS feedback
    const step1 = setTimeout(() => setUploadStatus('transcribing'), 1200);
    const step2 = setTimeout(() => setUploadStatus('summarizing'), 2800);
    const step3 = setTimeout(() => setUploadStatus('decisions'), 4200);
    const step4 = setTimeout(() => setUploadStatus('actions'), 5500);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name.replace(/\.[^/.]+$/, ""));

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
      clearTimeout(step4);

      if (response.ok) {
        const processedMeeting: Meeting = await response.json();
        setUploadStatus('done');
        setFile(null);
        setTitle('');
        setActiveMeeting(processedMeeting);
        setFlippedFlashcards(new Set());
        setQuizAnswers({});

        // Initialize default AI Copilot greeting for the newly processed meeting
        setChatMessages([
          {
            id: 'msg-init',
            sender: 'assistant',
            text: `Hello! I have indexed the meeting "${processedMeeting.title}". Ask me anything about key decisions, action items, risks, or request an Executive MOM.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);

        fetchMeetings();
        setTimeout(() => setUploadStatus('idle'), 1500);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload and process recording');
      }
    } catch (err: any) {
      console.error('[Upload Error]:', err);
      setUploadStatus('failed');
      setErrorMessage(err.message || 'Error occurred during processing.');
    }
  };

  // Toggle Action Item Status
  const handleToggleActionItem = async (itemId: string) => {
    if (!activeMeeting || !activeMeeting.analysis) return;

    const updatedActions = activeMeeting.analysis.actionItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          status: (item.status === 'completed' ? 'pending' : 'completed') as 'pending' | 'completed'
        };
      }
      return item;
    });

    const updatedMeeting: Meeting = {
      ...activeMeeting,
      analysis: {
        ...activeMeeting.analysis,
        actionItems: updatedActions
      }
    };

    setActiveMeeting(updatedMeeting);

    try {
      await fetch(`/api/meetings/${activeMeeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionItems: updatedActions }),
      });
    } catch (err) {
      console.error('Failed to update action item status:', err);
    }
  };

  // Delete Meeting
  const handleDeleteMeeting = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting recording?')) return;

    try {
      const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMeetings(prev => prev.filter(m => m.id !== id));
        if (activeMeeting?.id === id) {
          setActiveMeeting(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete meeting:', err);
    }
  };

  // Send query to AI Meeting Copilot
  const handleSendQuery = async (queryText?: string) => {
    const messageToSend = queryText || inputQuery;
    if (!messageToSend.trim() || !activeMeeting) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: messageToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsChatLoading(true);

    try {
      const response = await fetch(`/api/meetings/${activeMeeting.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend, chatHistory: chatMessages }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: data.reply || 'No response returned from AI Copilot.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error('Copilot response failed');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: `Sorry, I encountered an issue querying the meeting context: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Copy Transcript Text
  const handleCopyTranscript = () => {
    if (!activeMeeting?.transcript) return;
    navigator.clipboard.writeText(activeMeeting.transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // Parse Dialogue lines for Speaker and Timestamp display
  const getParsedTranscriptLines = () => {
    if (!activeMeeting?.transcript) return [];

    const lines = activeMeeting.transcript.split('\n').filter(l => l.trim().length > 0);
    return lines.map((line, idx) => {
      const timeSpeakerMatch = line.match(/^\[(\d{2}:\d{2})\]\s*([^:]+):\s*(.*)/i);
      if (timeSpeakerMatch) {
        return {
          id: idx,
          timestamp: timeSpeakerMatch[1],
          speaker: timeSpeakerMatch[2].trim(),
          text: timeSpeakerMatch[3].trim()
        };
      }
      return {
        id: idx,
        timestamp: '00:00',
        speaker: 'Participant',
        text: line.trim()
      };
    });
  };

  const parsedTranscript = getParsedTranscriptLines();

  // Extract unique speaker list for speaker filter dropdown
  const uniqueSpeakers = Array.from(new Set(parsedTranscript.map(t => t.speaker)));

  // Content-type-aware rendering: older meetings have no contentType saved,
  // so they default to the original meeting view. 'general' explicitly hides
  // the meeting-specific sections (Decisions/Action Items/Risks/Next Steps)
  // rather than forcing them onto content that isn't a meeting.
  const contentType: ContentType = activeMeeting?.analysis?.contentType || 'meeting';
  const showMeetingSections = contentType === 'meeting';
  const showLectureSections = contentType === 'lecture';
  const showCodingSections = contentType === 'coding';
  const showPodcastSections = contentType === 'podcast';

  // Filter transcript lines based on search query & selected speaker
  const filteredTranscript = parsedTranscript.filter(item => {
    const matchesSearch = transcriptSearch === '' || item.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || item.speaker.toLowerCase().includes(transcriptSearch.toLowerCase());
    const matchesSpeaker = selectedSpeaker === 'all' || item.speaker === selectedSpeaker;
    return matchesSearch && matchesSpeaker;
  });

  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex flex-col xl:flex-row gap-6 antialiased">

      {/* ========================================================================= */}
      {/* CENTER MAIN CONTENT AREA (Flex-1)                                          */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col space-y-6 min-w-0">

        {/* ----------------------------------------------------------------------- */}
        {/* TOP HEADER: ACTIVE MEETING METADATA / SELECTOR                         */}
        {/* ----------------------------------------------------------------------- */}
        {activeMeeting && (
          <div className="bg-[#121624]/90 border border-[#232B45] rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#5de6ff] p-0.5 shadow-lg shadow-[#6366F1]/20">
                <div className="w-full h-full bg-[#0a0e17] rounded-[10px] flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#5de6ff]" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  {activeMeeting.title}
                  <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/30">
                    AI Analyzed
                  </span>
                  {activeMeeting.analysis?.contentType && (
                    <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#6366F1]/10 text-[#a5b4fc] border border-[#6366F1]/30 flex items-center gap-1.5">
                      {CONTENT_TYPE_META[activeMeeting.analysis.contentType].icon}
                      {CONTENT_TYPE_META[activeMeeting.analysis.contentType].label}
                    </span>
                  )}
                </h1>
                <div className="flex items-center space-x-4 text-xs text-[#94A3B8] font-mono mt-1">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#6366F1]" />
                    {new Date(activeMeeting.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#5de6ff]" />
                    {activeMeeting.duration || '2m 30s'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setActiveMeeting(null)}
                className="px-4 py-2 rounded-xl bg-[#181b25] border border-[#232B45] hover:border-[#6366F1] text-xs font-semibold text-[#c0c1ff] hover:text-white transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <UploadCloud className="w-4 h-4 text-[#6366F1]" />
                Upload New Recording
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* DEFAULT STATE: NO MEETING SELECTED / FILE UPLOAD CARD                   */}
        {/* ----------------------------------------------------------------------- */}
        {!activeMeeting && (
          <div className="space-y-6">

            {/* Upload Area */}
            <div className="bg-[#121624]/90 border border-[#232B45] rounded-3xl p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#6366F1]/5 rounded-full blur-3xl pointer-events-none -z-10" />

              <div className="max-w-2xl mx-auto text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/30 text-[#c0c1ff] text-xs font-mono font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-[#5de6ff]" />
                  Whisper Speech Recognition & AI Intelligence Pipeline
                </div>

                <h2 className="text-3xl font-extrabold text-white tracking-tight">
                  Upload Meeting Recording
                </h2>

                <p className="text-sm text-[#94A3B8] max-w-lg mx-auto">
                  Upload a meeting recording to generate transcript, summaries, action items, decisions, and insights.
                </p>

                {/* Drag and Drop Container */}
                <form
                  onSubmit={handleUploadSubmit}
                  onDragEnter={handleDrag}
                  className="mt-6"
                >
                  <div
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center space-y-4 ${dragActive
                      ? 'border-[#5de6ff] bg-[#5de6ff]/5 scale-[1.01]'
                      : 'border-[#232B45] hover:border-[#6366F1]/60 bg-[#0a0e17]/60 hover:bg-[#181b25]/80'
                      }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".mp3,.wav,.m4a,.mp4,.mov,audio/*,video/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="w-16 h-16 rounded-2xl bg-[#1c1f29] border border-[#232B45] flex items-center justify-center text-[#6366F1] shadow-xl group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-8 h-8 text-[#5de6ff]" />
                    </div>

                    {file ? (
                      <div className="text-center space-y-1">
                        <p className="text-sm font-bold text-[#5de6ff]">{file.name}</p>
                        <p className="text-xs text-[#94A3B8]">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center">
                        <p className="text-sm font-semibold text-[#dfe2ef]">
                          Drag & drop audio or video file here, or <span className="text-[#6366F1] underline">browse</span>
                        </p>
                        <div className="flex items-center justify-center gap-2 text-[11px] text-[#94A3B8] font-mono pt-2">
                          <span className="px-2 py-0.5 rounded bg-[#1c1f29] border border-[#232B45]">Audio: .MP3, .WAV, .M4A</span>
                          <span className="px-2 py-0.5 rounded bg-[#1c1f29] border border-[#232B45]">Video: .MP4, .MOV</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {file && (
                    <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                      <input
                        type="text"
                        placeholder="Meeting title (optional)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="flex-1 bg-[#0a0e17] text-white px-4 py-2.5 rounded-xl border border-[#232B45] text-xs focus:outline-none focus:border-[#6366F1] placeholder-[#94A3B8]"
                      />
                      <button
                        type="submit"
                        disabled={uploadStatus !== 'idle' && uploadStatus !== 'failed'}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white text-xs font-bold shadow-lg shadow-[#6366F1]/30 hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-[#5de6ff]" />
                        Process Meeting
                      </button>
                    </div>
                  )}
                </form>

                {/* Processing Progress Feedback Bar */}
                {uploadStatus !== 'idle' && uploadStatus !== 'done' && (
                  <div className="mt-6 p-4 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3 text-left">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#dfe2ef]">
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-[#5de6ff] animate-spin" />
                        Processing Pipeline Active...
                      </span>
                      <span className="font-mono text-[#5de6ff] capitalize">{uploadStatus}</span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 pt-1">
                      <div className={`h-1.5 rounded-full transition-all ${['uploading', 'transcribing', 'summarizing', 'decisions', 'actions', 'done'].includes(uploadStatus) ? 'bg-[#5de6ff]' : 'bg-[#232B45]'}`} />
                      <div className={`h-1.5 rounded-full transition-all ${['transcribing', 'summarizing', 'decisions', 'actions', 'done'].includes(uploadStatus) ? 'bg-[#5de6ff]' : 'bg-[#232B45]'}`} />
                      <div className={`h-1.5 rounded-full transition-all ${['summarizing', 'decisions', 'actions', 'done'].includes(uploadStatus) ? 'bg-[#5de6ff]' : 'bg-[#232B45]'}`} />
                      <div className={`h-1.5 rounded-full transition-all ${['decisions', 'actions', 'done'].includes(uploadStatus) ? 'bg-[#5de6ff]' : 'bg-[#232B45]'}`} />
                      <div className={`h-1.5 rounded-full transition-all ${['actions', 'done'].includes(uploadStatus) ? 'bg-[#5de6ff]' : 'bg-[#232B45]'}`} />
                    </div>

                    <p className="text-[11px] text-[#94A3B8] font-mono">
                      Step: {uploadStatus === 'uploading' && '1/5 Uploading recording file...'}
                      {uploadStatus === 'transcribing' && '2/5 Transcribing speech with Whisper...'}
                      {uploadStatus === 'summarizing' && '3/5 Generating Executive Summary & Topics...'}
                      {uploadStatus === 'decisions' && '4/5 Extracting Decisions & Deciders...'}
                      {uploadStatus === 'actions' && '5/5 Structuring Action Items & Risk Matrix...'}
                    </p>
                  </div>
                )}

                {uploadStatus === 'failed' && (
                  <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage || 'Processing failed. Please check backend environment configuration.'}</span>
                  </div>
                )}

              </div>
            </div>

            {/* List of Previously Processed Meetings */}
            {meetings.length > 0 && (
              <div className="bg-[#121624]/90 border border-[#232B45] rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between border-b border-[#232B45] pb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#6366F1]" />
                    Previously Analyzed Meetings ({meetings.length})
                  </h3>
                  <span className="text-xs text-[#94A3B8] font-mono">Select a meeting to open in 3-Panel View</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {meetings.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setActiveMeeting(m);
                        setFlippedFlashcards(new Set());
                        setQuizAnswers({});
                        setChatMessages([
                          {
                            id: 'msg-init-' + m.id,
                            sender: 'assistant',
                            text: `Connected to meeting context: "${m.title}". Ask me any questions about this recording.`,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          }
                        ]);
                      }}
                      className="p-4 rounded-2xl bg-[#0a0e17] border border-[#232B45] hover:border-[#6366F1] transition-all cursor-pointer group flex items-start justify-between"
                    >
                      <div className="space-y-1.5 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white group-hover:text-[#5de6ff] transition-colors line-clamp-1">
                            {m.title}
                          </h4>
                          {m.analysis?.contentType && (
                            <span className="shrink-0 text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-full bg-[#6366F1]/10 text-[#a5b4fc] border border-[#6366F1]/30 flex items-center gap-1">
                              {CONTENT_TYPE_META[m.analysis.contentType].icon}
                              {CONTENT_TYPE_META[m.analysis.contentType].label}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#94A3B8] line-clamp-2">
                          {m.analysis?.summary || m.transcript.slice(0, 100) || 'No summary available.'}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-[#94A3B8] font-mono pt-1">
                          <span>{new Date(m.date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{m.duration || 'Audio'}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteMeeting(m.id, e)}
                        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Delete meeting"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* ACTIVE MEETING PROCESSED VIEW: TRANSCRIPT & SUMMARY TABS                */}
        {/* ----------------------------------------------------------------------- */}
        {activeMeeting && (
          <div className="bg-[#121624]/90 border border-[#232B45] rounded-3xl p-6 shadow-2xl backdrop-blur-md flex-1 flex flex-col min-h-0 space-y-6">

            {/* Tab Controls */}
            <div className="flex items-center justify-between border-b border-[#232B45] pb-4">
              <div className="flex items-center space-x-2 bg-[#0a0e17] p-1.5 rounded-xl border border-[#232B45]">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'summary'
                    ? 'bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/30'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#181b25]'
                    }`}
                >
                  <FileText className="w-4 h-4" />
                  Summary & Insights
                </button>
                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'transcript'
                    ? 'bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/30'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#181b25]'
                    }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Full Transcript
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1c1f29] text-[#5de6ff]">
                    {parsedTranscript.length} lines
                  </span>
                </button>
              </div>

              {activeTab === 'transcript' && (
                <button
                  onClick={handleCopyTranscript}
                  className="px-3.5 py-1.5 rounded-lg bg-[#181b25] border border-[#232B45] hover:border-[#6366F1] text-xs font-medium text-[#c0c1ff] transition flex items-center gap-2 cursor-pointer"
                >
                  {copiedTranscript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedTranscript ? 'Copied!' : 'Copy Transcript'}
                </button>
              )}
            </div>

            {/* TAB 1: TRANSCRIPT VIEW */}
            {activeTab === 'transcript' && (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                {/* Transcript Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0e17] p-3 rounded-xl border border-[#232B45]">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type="text"
                      placeholder="Search dialogue keywords..."
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="w-full bg-[#181b25] text-white pl-9 pr-4 py-1.5 text-xs rounded-lg border border-[#232B45] focus:outline-none focus:border-[#5de6ff]"
                    />
                  </div>

                  {/* Speaker Filter */}
                  {uniqueSpeakers.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-[#94A3B8] font-mono">Speaker:</span>
                      <select
                        value={selectedSpeaker}
                        onChange={(e) => setSelectedSpeaker(e.target.value)}
                        className="bg-[#181b25] text-white text-xs px-3 py-1.5 rounded-lg border border-[#232B45] focus:outline-none focus:border-[#5de6ff] cursor-pointer"
                      >
                        <option value="all">All Speakers ({uniqueSpeakers.length})</option>
                        {uniqueSpeakers.map(spk => (
                          <option key={spk} value={spk}>{spk}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Transcript Dialogue List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[550px] scrollbar-thin scrollbar-thumb-[#232B45]">
                  {filteredTranscript.length > 0 ? (
                    filteredTranscript.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-[#0a0e17]/80 border border-[#232B45] hover:border-[#6366F1]/40 transition space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#5de6ff] flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-[#6366F1]" />
                            {item.speaker}
                          </span>
                          <span className="font-mono text-[11px] text-[#94A3B8] px-2 py-0.5 rounded bg-[#181b25] border border-[#232B45]">
                            {item.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-[#dfe2ef] leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-xs text-[#94A3B8]">
                      No dialogue lines match search filter.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: SUMMARY & DYNAMIC AI SECTIONS VIEW */}
            {activeTab === 'summary' && (
              <div className="space-y-6 overflow-y-auto pr-2 max-h-[600px] scrollbar-thin scrollbar-thumb-[#232B45]">

                {/* 1. Executive Summary */}
                <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#6366F1]" />
                    1. Executive Summary
                  </h3>
                  <p className="text-xs text-[#dfe2ef] leading-relaxed">
                    {activeMeeting.analysis?.summary || 'Summary processing complete.'}
                  </p>
                </div>

                {/* 2. Key Discussion Points */}
                {activeMeeting.analysis?.keyDiscussionPoints && activeMeeting.analysis.keyDiscussionPoints.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-[#6366F1]" />
                      2. Key Discussion Points
                    </h3>
                    <ul className="space-y-2">
                      {activeMeeting.analysis.keyDiscussionPoints.map((point, idx) => (
                        <li key={idx} className="text-xs text-[#dfe2ef] flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff] mt-1.5 shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {showMeetingSections && (<>
                {/* 3. Decisions Taken */}
                <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-[#6366F1]" />
                      3. Decisions Taken ({activeMeeting.analysis?.decisions.length || 0})
                    </span>
                  </h3>

                  <div className="space-y-3">
                    {activeMeeting.analysis?.decisions && activeMeeting.analysis.decisions.length > 0 ? (
                      activeMeeting.analysis.decisions.map((d) => (
                        <div key={d.id} className="p-3.5 rounded-xl bg-[#181b25] border border-[#232B45] space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white">{d.decision}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#6366F1]/10 text-[#c0c1ff] border border-[#6366F1]/30">
                              Decider: {d.decider || 'Team'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8]">Context: {d.context}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No formal decisions detected in transcript.</p>
                    )}
                  </div>
                </div>

                {/* 4. Action Items */}
                <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#6366F1]" />
                    4. Action Items ({activeMeeting.analysis?.actionItems.length || 0})
                  </h3>

                  <div className="space-y-2.5">
                    {activeMeeting.analysis?.actionItems && activeMeeting.analysis.actionItems.length > 0 ? (
                      activeMeeting.analysis.actionItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleToggleActionItem(item.id)}
                          className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${item.status === 'completed'
                            ? 'bg-emerald-500/5 border-emerald-500/30 text-[#94A3B8]'
                            : 'bg-[#181b25] border-[#232B45] hover:border-[#6366F1] text-[#dfe2ef]'
                            }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={item.status === 'completed'}
                              onChange={() => { }}
                              className="w-4 h-4 accent-[#6366F1] cursor-pointer"
                            />
                            <span className={`text-xs ${item.status === 'completed' ? 'line-through text-[#94A3B8]' : 'font-medium'}`}>
                              {item.task}
                            </span>
                          </div>

                          <div className="flex items-center space-x-3 text-[10px] font-mono">
                            <span className="px-2 py-0.5 rounded bg-[#0a0e17] border border-[#232B45] text-[#c0c1ff]">
                              {item.assignee}
                            </span>
                            <span className="text-[#94A3B8]">Due: {item.dueDate}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No action items assigned.</p>
                    )}
                  </div>
                </div>

                {/* 5. Risks Identified */}
                <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#6366F1]" />
                    5. Risks Identified ({activeMeeting.analysis?.risks.length || 0})
                  </h3>

                  <div className="space-y-3">
                    {activeMeeting.analysis?.risks && activeMeeting.analysis.risks.length > 0 ? (
                      activeMeeting.analysis.risks.map((r) => (
                        <div key={r.id} className="p-3.5 rounded-xl bg-[#181b25] border border-[#232B45] space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white">{r.risk}</span>
                            <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${r.impact === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}>
                              {r.impact} Impact
                            </span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8]">Mitigation: {r.mitigation}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No major risks identified.</p>
                    )}
                  </div>
                </div>

                {/* 6. Next Steps */}
                {activeMeeting.analysis?.nextSteps && activeMeeting.analysis.nextSteps.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-[#6366F1]" />
                      6. Next Steps
                    </h3>
                    <ul className="space-y-2">
                      {activeMeeting.analysis.nextSteps.map((step, idx) => (
                        <li key={idx} className="text-xs text-[#dfe2ef] flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>)}

              {/* LECTURE: Study Notes, Flashcards, Mindmap, Quiz */}
              {showLectureSections && (<>
                {activeMeeting.analysis?.notes && activeMeeting.analysis.notes.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#6366F1]" />
                      Study Notes
                    </h3>
                    <ul className="space-y-2">
                      {activeMeeting.analysis.notes.map((note, idx) => (
                        <li key={idx} className="text-xs text-[#dfe2ef] flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff] mt-1.5 shrink-0" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeMeeting.analysis?.flashcards && activeMeeting.analysis.flashcards.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#6366F1]" />
                      Flashcards ({activeMeeting.analysis.flashcards.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeMeeting.analysis.flashcards.map((card, idx) => {
                        const flipped = flippedFlashcards.has(idx);
                        return (
                          <div
                            key={idx}
                            onClick={() => setFlippedFlashcards(prev => {
                              const next = new Set(prev);
                              if (next.has(idx)) next.delete(idx); else next.add(idx);
                              return next;
                            })}
                            className="p-3.5 rounded-xl bg-[#181b25] border border-[#232B45] hover:border-[#6366F1] cursor-pointer space-y-1.5 min-h-[80px] flex flex-col justify-center"
                          >
                            <span className="text-[9px] font-mono uppercase tracking-wider text-[#94A3B8]">{flipped ? 'Answer' : 'Question'} · tap to flip</span>
                            <p className="text-xs text-[#dfe2ef] leading-relaxed">{flipped ? card.answer : card.question}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeMeeting.analysis?.mindmap && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#6366F1]" />
                      Mindmap
                    </h3>
                    <MindmapView node={activeMeeting.analysis.mindmap} depth={0} />
                  </div>
                )}

                {activeMeeting.analysis?.quiz && activeMeeting.analysis.quiz.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#6366F1]" />
                      Quiz ({activeMeeting.analysis.quiz.length})
                    </h3>
                    <div className="space-y-4">
                      {activeMeeting.analysis.quiz.map((q, qIdx) => {
                        const selected = quizAnswers[qIdx];
                        return (
                          <div key={qIdx} className="space-y-2">
                            <p className="text-xs font-semibold text-white">{qIdx + 1}. {q.question}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, oIdx) => {
                                const isSelected = selected === oIdx;
                                const isCorrect = oIdx === q.correctIndex;
                                const showResult = selected !== undefined;
                                return (
                                  <button
                                    key={oIdx}
                                    onClick={() => setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }))}
                                    className={`text-left text-[11px] px-3 py-2 rounded-lg border transition ${
                                      showResult && isCorrect ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                                      : showResult && isSelected && !isCorrect ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                                      : 'bg-[#181b25] border-[#232B45] text-[#dfe2ef] hover:border-[#6366F1]'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {selected !== undefined && q.explanation && (
                              <p className="text-[11px] text-[#94A3B8]">{q.explanation}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>)}

              {/* CODING: Code Guide, APIs, Libraries, Commands */}
              {showCodingSections && (<>
                {activeMeeting.analysis?.codeGuide && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-[#6366F1]" />
                      Code Guide
                    </h3>
                    <p className="text-xs text-[#dfe2ef] leading-relaxed whitespace-pre-wrap font-mono">{activeMeeting.analysis.codeGuide}</p>
                  </div>
                )}

                {activeMeeting.analysis?.apis && activeMeeting.analysis.apis.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Plug className="w-4 h-4 text-[#6366F1]" />
                      APIs Mentioned ({activeMeeting.analysis.apis.length})
                    </h3>
                    <div className="space-y-2">
                      {activeMeeting.analysis.apis.map((api, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-[#181b25] border border-[#232B45]">
                          <span className="text-xs font-bold text-white font-mono">{api.name}</span>
                          <p className="text-[11px] text-[#94A3B8] mt-0.5">{api.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeMeeting.analysis?.libraries && activeMeeting.analysis.libraries.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#6366F1]" />
                      Libraries Mentioned ({activeMeeting.analysis.libraries.length})
                    </h3>
                    <div className="space-y-2">
                      {activeMeeting.analysis.libraries.map((lib, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-[#181b25] border border-[#232B45]">
                          <span className="text-xs font-bold text-white font-mono">{lib.name}</span>
                          <p className="text-[11px] text-[#94A3B8] mt-0.5">{lib.purpose}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeMeeting.analysis?.commands && activeMeeting.analysis.commands.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-[#6366F1]" />
                      Commands ({activeMeeting.analysis.commands.length})
                    </h3>
                    <div className="space-y-2">
                      {activeMeeting.analysis.commands.map((cmd, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-[#181b25] border border-[#232B45]">
                          <code className="text-[11px] font-mono text-[#5de6ff]">{cmd.command}</code>
                          <p className="text-[11px] text-[#94A3B8] mt-0.5">{cmd.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>)}

              {/* PODCAST: Key Insights, Timeline, Resources */}
              {showPodcastSections && (<>
                {activeMeeting.analysis?.keyInsights && activeMeeting.analysis.keyInsights.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#6366F1]" />
                      Key Insights
                    </h3>
                    <ul className="space-y-2">
                      {activeMeeting.analysis.keyInsights.map((insight, idx) => (
                        <li key={idx} className="text-xs text-[#dfe2ef] flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff] mt-1.5 shrink-0" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeMeeting.analysis?.timeline && activeMeeting.analysis.timeline.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <History className="w-4 h-4 text-[#6366F1]" />
                      Timeline
                    </h3>
                    <div className="space-y-2">
                      {activeMeeting.analysis.timeline.map((entry, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-xs">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#181b25] border border-[#232B45] text-[#5de6ff] shrink-0">{entry.timestamp}</span>
                          <span className="text-[#dfe2ef]">{entry.topic}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeMeeting.analysis?.resources && activeMeeting.analysis.resources.length > 0 && (
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-[#6366F1]" />
                      Resources Mentioned ({activeMeeting.analysis.resources.length})
                    </h3>
                    <div className="space-y-2">
                      {activeMeeting.analysis.resources.map((res, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-[#181b25] border border-[#232B45] flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-white">{res.name}</span>
                            {res.type && <span className="text-[10px] text-[#94A3B8] ml-2 uppercase font-mono">{res.type}</span>}
                          </div>
                          {res.reference && <span className="text-[10px] text-[#5de6ff] font-mono truncate max-w-[40%]">{res.reference}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>)}

              </div>
            )}

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* RIGHT AI COPILOT PANEL (w-96)                                             */}
      {/* ========================================================================= */}
      <div className="w-full xl:w-96 bg-[#121624]/90 border border-[#232B45] rounded-3xl p-5 shadow-2xl backdrop-blur-md flex flex-col h-[750px] xl:h-auto shrink-0">

        {/* Panel Header */}
        <div className="border-b border-[#232B45] pb-4 mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/40 flex items-center justify-center text-[#5de6ff]">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">AI Meeting Copilot</h3>
              <p className="text-[10px] text-[#94A3B8] font-mono">Contextual RAG Assistant</p>
            </div>
          </div>

          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Connected to active meeting context" />
        </div>

        {/* Suggested Prompt Chips */}
        {activeMeeting && (
          <div className="mb-4 space-y-1.5">
            <p className="text-[10px] text-[#94A3B8] font-mono uppercase tracking-wider">Suggested Prompts:</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "What were the key decisions?",
                "What risks were identified?",
                "Generate MOM",
                "Generate client version",
                "Generate engineering summary"
              ].map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendQuery(prompt)}
                  disabled={isChatLoading}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-[#0a0e17] border border-[#232B45] hover:border-[#6366F1] text-[#c0c1ff] hover:text-white transition cursor-pointer text-left truncate max-w-full"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 scrollbar-thin scrollbar-thumb-[#232B45]">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-[#94A3B8]">
              <Bot className="w-10 h-10 text-[#6366F1]/40" />
              <p className="text-xs">
                {activeMeeting ? "Ask anything about this meeting." : "Upload or select a meeting to start chatting with AI Copilot."}
              </p>
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col space-y-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
              >
                <div
                  className={`p-3.5 rounded-2xl text-xs max-w-[90%] leading-relaxed ${msg.sender === 'user'
                    ? 'bg-[#6366F1] text-white rounded-br-none shadow-md shadow-[#6366F1]/20'
                    : 'bg-[#0a0e17] text-[#dfe2ef] border border-[#232B45] rounded-bl-none'
                    }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>
                <span className="text-[9px] text-[#94A3B8] font-mono px-1">{msg.timestamp}</span>
              </div>
            ))
          )}

          {isChatLoading && (
            <div className="flex items-center space-x-2 p-3 rounded-2xl bg-[#0a0e17] border border-[#232B45] text-xs text-[#5de6ff] w-fit">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing meeting context...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery();
          }}
          className="relative pt-2 border-t border-[#232B45]"
        >
          <input
            type="text"
            disabled={!activeMeeting || isChatLoading}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={activeMeeting ? "Ask anything about this meeting..." : "Upload recording to chat..."}
            className="w-full bg-[#0a0e17] text-white text-xs pl-3.5 pr-10 py-3 rounded-xl border border-[#232B45] focus:outline-none focus:border-[#6366F1] placeholder-[#94A3B8] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!activeMeeting || !inputQuery.trim() || isChatLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#6366F1] text-white hover:bg-[#4F46E5] disabled:opacity-40 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>

    </div>
  );
}

// Recursive nested-outline renderer for the Lecture mindmap field.
function MindmapView({ node, depth }: { node: MindmapNode; depth: number }) {
  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }} className={depth > 0 ? 'mt-1.5 border-l border-[#232B45] pl-3' : ''}>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${depth === 0 ? 'bg-[#5de6ff]' : 'bg-[#6366F1]'}`} />
        <span className={`text-xs ${depth === 0 ? 'font-bold text-white' : 'text-[#dfe2ef]'}`}>{node.topic}</span>
      </div>
      {node.children && node.children.length > 0 && (
        <div className="space-y-1.5 mt-1.5">
          {node.children.map((child, idx) => (
            <MindmapView key={idx} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
