'use client';

import React, { useState, useEffect, useRef } from 'react';
// Trigger Next.js route manifest rebuild
import { useRouter } from 'next/navigation';
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
  ChevronDown,
  X,
  Mic,
  MicOff,
  Video,
  Plus,
  Link as LinkIcon,
  Globe,
  Settings,
  Sliders,
  ExternalLink,
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
import { Meeting, ActionItem, MindmapNode, Task } from '@/lib/db';
import { TranscriptionLanguage } from '@/lib/whisper';
import LanguageSelect from '@/app/components/LanguageSelect';
import { ContentType } from '@/lib/classify';

// AI Daily Brief — a dashboard-home widget composed entirely from the
// Calendar/Tasks resources (GET /api/meetings, GET /api/tasks). No new
// backend endpoint: it's a derived read over data those APIs already serve.
function DailyBriefWidget() {
  const [meetingsToday, setMeetingsToday] = useState<Meeting[]>([]);
  const [tasksDue, setTasksDue] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const today = dayStart.toISOString().split('T')[0];

    Promise.all([
      fetch(`/api/meetings?start=${dayStart.toISOString()}&end=${dayEnd.toISOString()}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/tasks?status=pending&dueBefore=${today}`).then(r => r.ok ? r.json() : []),
    ])
      .then(([meetings, tasks]) => {
        setMeetingsToday(meetings);
        setTasksDue(tasks);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  const overdue = tasksDue.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]);
  const highPriority = tasksDue.filter(t => t.priority === 'high');
  const decisionsToday = meetingsToday.reduce((sum, m) => sum + (m.analysis?.decisions?.length || 0), 0);

  if (meetingsToday.length === 0 && tasksDue.length === 0) return null;

  return (
    <div className="bg-[#121624]/90 border border-[#232B45] rounded-2xl p-5 shadow-xl backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-[#F8FAFC] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#6366F1]" /> AI Daily Brief
        </h3>
        <a href="/dashboard/calendar" className="text-[10px] font-mono text-[#5de6ff] hover:text-white">Open Calendar &rarr;</a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-[#0a0e17] border border-[#232B45]">
          <p className="text-lg font-bold text-[#F8FAFC]">{meetingsToday.length}</p>
          <p className="text-[10px] text-[#94A3B8] font-mono uppercase">Meetings Today</p>
        </div>
        <div className="p-3 rounded-xl bg-[#0a0e17] border border-[#232B45]">
          <p className="text-lg font-bold text-[#F8FAFC]">{tasksDue.length}</p>
          <p className="text-[10px] text-[#94A3B8] font-mono uppercase">Tasks Due</p>
        </div>
        <div className={`p-3 rounded-xl border ${overdue.length > 0 ? 'bg-rose-400/5 border-rose-400/30' : 'bg-[#0a0e17] border-[#232B45]'}`}>
          <p className={`text-lg font-bold ${overdue.length > 0 ? 'text-rose-400' : 'text-[#F8FAFC]'}`}>{overdue.length}</p>
          <p className="text-[10px] text-[#94A3B8] font-mono uppercase">Overdue</p>
        </div>
        <div className={`p-3 rounded-xl border ${highPriority.length > 0 ? 'bg-amber-400/5 border-amber-400/30' : 'bg-[#0a0e17] border-[#232B45]'}`}>
          <p className={`text-lg font-bold ${highPriority.length > 0 ? 'text-amber-400' : 'text-[#F8FAFC]'}`}>{highPriority.length}</p>
          <p className="text-[10px] text-[#94A3B8] font-mono uppercase">High Priority</p>
        </div>
      </div>
      {decisionsToday > 0 && (
        <p className="text-[11px] text-[#94A3B8] font-mono">{decisionsToday} decision{decisionsToday === 1 ? '' : 's'} logged from today's meetings.</p>
      )}
    </div>
  );
}

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
  const router = useRouter();

  // Meetings state from backend API
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');

  // Right Side Panel Sub-Tabs ('chat' | 'meetings' | 'actions')
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'meetings' | 'actions'>('chat');

  // Upload Modal & Drag-and-Drop State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'transcribing' | 'summarizing' | 'decisions' | 'actions' | 'done' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Realtime Live Audio Recording State
  const [language, setLanguage] = useState<TranscriptionLanguage>('en');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Active Main Content View Tabs ('summary' | 'transcript')
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');

  // Transcript Filtering & Features
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');

  // Lecture: Flashcards & Quiz interactive state
  const [flippedFlashcards, setFlippedFlashcards] = useState<Set<number>>(new Set());
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  // AI Copilot Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Live Meeting Invite URL State
  const [meetingUrlInput, setMeetingUrlInput] = useState('');

  // Auto-open upload modal if ?upload=true query parameter is in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('upload') === 'true') {
        setShowUploadModal(true);
      }
    }
  }, []);

  // Fetch all user meetings from backend API
  const fetchMeetings = async () => {
    try {
      const response = await fetch('/api/meetings');
      if (response.ok) {
        const data: Meeting[] = await response.json();
        setMeetings(data);
        if (data.length > 0 && !activeMeeting) {
          setActiveMeeting(data[0]);
          initChatForMeeting(data[0]);
        }
      }
    } catch (error) {
      console.error('[SaaS Page] Failed to fetch meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
    const handleFocus = () => fetchMeetings();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Initialize Chat Messages for active meeting
  const initChatForMeeting = (meeting: Meeting) => {
    setChatMessages([
      {
        id: 'msg-init',
        sender: 'assistant',
        text: `Hello! I have indexed the meeting "${meeting.title}". Ask me anything about key decisions, action items, risks, or request an Executive MOM.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Switch active meeting view & open detailed 3-panel screen
  const handleSelectMeeting = (meeting: Meeting) => {
    setActiveMeeting(meeting);
    initChatForMeeting(meeting);
    router.push(`/dashboard/meeting/${meeting.id}`);
  };

  // Scroll chat to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Delete meeting recording
  const handleDeleteMeeting = async (meetingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this recording?')) return;
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' });
      if (res.ok) {
        setMeetings(prev => prev.filter(m => m.id !== meetingId));
        if (activeMeeting?.id === meetingId) {
          const remaining = meetings.filter(m => m.id !== meetingId);
          setActiveMeeting(remaining[0] || null);
        }
      }
    } catch (err) {
      console.error('Failed to delete meeting:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // REALTIME AUDIO RECORDING ENGINE
  // ---------------------------------------------------------------------------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setLiveTranscript([]);
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], `Live_Recording_${Date.now()}.wav`, { type: 'audio/wav' });
        await processUploadedFile(audioFile, `Live Recording - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = (language as string) === 'hi' ? 'hi-IN' : (language as string) === 'te' ? 'te-IN' : 'en-US';

        recognition.onresult = (event: any) => {
          const currentTranscript: string[] = [];
          for (let i = 0; i < event.results.length; i++) {
            const transcriptLine = event.results[i][0].transcript;
            if (transcriptLine.trim()) {
              currentTranscript.push(transcriptLine);
            }
          }
          setLiveTranscript(currentTranscript);
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      }

    } catch (err: any) {
      alert("Microphone permission denied or audio recording device unavailable: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ---------------------------------------------------------------------------
  // FILE UPLOAD & PROCESSING
  // ---------------------------------------------------------------------------
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

  const processUploadedFile = async (uploadFile: File, meetingTitle: string) => {
    setUploadStatus('uploading');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('title', meetingTitle || uploadFile.name.replace(/\.[^/.]+$/, ""));
    formData.append('language', language);

    try {
      const statusSequence: ('transcribing' | 'summarizing' | 'decisions' | 'actions')[] = [
        'transcribing',
        'summarizing',
        'decisions',
        'actions'
      ];
      let stepIdx = 0;
      const interval = setInterval(() => {
        if (stepIdx < statusSequence.length) {
          setUploadStatus(statusSequence[stepIdx]);
          stepIdx++;
        }
      }, 2500);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);

      if (response.ok) {
        const processedMeeting: Meeting = await response.json();
        setUploadStatus('done');
        setFile(null);
        setTitle('');
        setShowUploadModal(false);
        setActiveMeeting(processedMeeting);
        initChatForMeeting(processedMeeting);
        setFlippedFlashcards(new Set());
        setQuizAnswers({});

        fetchMeetings();
        setTimeout(() => setUploadStatus('idle'), 1500);

        // Directly navigate to full meeting view
        router.push(`/dashboard/meeting/${processedMeeting.id}`);
      } else {
        const errorData = await response.json();
        setUploadStatus('failed');
        setErrorMessage(errorData.error || 'Failed to process file.');
      }
    } catch (err: any) {
      setUploadStatus('failed');
      setErrorMessage(err.message || 'Network error occurred during upload.');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    await processUploadedFile(file, title);
  };

  // Toggle Action Item Checkbox
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
    setMeetings(prev => prev.map(m => m.id === updatedMeeting.id ? updatedMeeting : m));

    try {
      await fetch(`/api/meetings/${activeMeeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionItems: updatedActions }),
      });
    } catch (err) {
      console.error('Failed to persist action item update:', err);
    }
  };

  // Handle AI Copilot Chat Submit
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || !activeMeeting || isChatLoading) return;

    const userMsgText = inputQuery.trim();
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsChatLoading(true);

    try {
      const res = await fetch(`/api/meetings/${activeMeeting.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsgText,
          chatHistory: chatMessages.map(m => ({ sender: m.sender, text: m.text }))
        })
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          text: data.reply || 'No response generated.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error('Failed to get answer from AI Copilot');
      }
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Error: ${err.message || 'Unable to connect to AI RAG engine.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Parse Dialogue lines for Speaker and Timestamp display
  const getParsedTranscriptLines = () => {
    if (!activeMeeting?.transcript) return [];

    const lines = activeMeeting.transcript.split('\n').filter(l => l.trim().length > 0);
    return lines.map((line, idx) => {
      const timeSpeakerMatch = line.match(/^\[(\d{2}:\d{2})\]\s*([^:]+):\s*(.*)/i);
      if (timeSpeakerMatch) {
        return {
          id: `line-${idx}`,
          timestamp: timeSpeakerMatch[1],
          speaker: timeSpeakerMatch[2].trim(),
          text: timeSpeakerMatch[3].trim()
        };
      }
      return {
        id: `line-${idx}`,
        timestamp: '00:00',
        speaker: 'Participant',
        text: line
      };
    });
  };

  const parsedTranscript = getParsedTranscriptLines();
  const uniqueSpeakers = Array.from(new Set(parsedTranscript.map(t => t.speaker)));

  const filteredTranscript = parsedTranscript.filter(item => {
    const matchesSearch = item.text.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
      item.speaker.toLowerCase().includes(transcriptSearch.toLowerCase());
    const matchesSpeaker = selectedSpeaker === 'all' || item.speaker === selectedSpeaker;
    return matchesSearch && matchesSpeaker;
  });

  // Group meetings by Date (Today, Yesterday, Earlier)
  const filteredMeetings = meetings.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.transcript.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const isYesterday = (dateStr: string) => {
    const d = new Date(dateStr);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
  };

  const todayMeetings = filteredMeetings.filter(m => isToday(m.date));
  const yesterdayMeetings = filteredMeetings.filter(m => isYesterday(m.date));
  const earlierMeetings = filteredMeetings.filter(m => !isToday(m.date) && !isYesterday(m.date));

  // Extract all action items across meetings for the right panel
  const allActionItems: { item: ActionItem; meetingTitle: string; uniqueId: string }[] = [];
  meetings.forEach(m => {
    if (m.analysis?.actionItems) {
      m.analysis.actionItems.forEach((a, idx) => {
        allActionItems.push({ item: a, meetingTitle: m.title, uniqueId: `${m.id}-${a.id || idx}` });
      });
    }
  });

  return (
    <div className="w-full h-full bg-[#0F131C] text-[#DFE2EF] flex flex-col font-sans antialiased overflow-hidden">

      {/* ========================================================================= */}
      {/* TOP DASHBOARD CONTROL BAR                                                 */}
      {/* ========================================================================= */}
      <div className="bg-[#0A0E17]/90 border-b border-[#2a4a5e] px-6 py-3 flex items-center justify-between backdrop-blur-md shrink-0">

        {/* Global Search Bar */}
        <div className="relative w-72 md:w-80">
          <Search className="w-4 h-4 text-[#9f8f99] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Ask or search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181B25] text-xs text-[#f5e2de] pl-10 pr-12 py-2 rounded-xl border border-[#2a4a5e] focus:border-[#6a2153] focus:bg-[#1C1F29] transition-all outline-none"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-[#9f8f99] bg-[#0A0E17] border border-[#2a4a5e] px-1.5 py-0.5 rounded">
            CtrlK
          </kbd>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <LanguageSelect value={language} onChange={setLanguage} allowAuto={false} />

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 text-xs font-semibold text-[#DFE2EF] bg-[#181B25] hover:bg-[#2a4a5e] border border-[#2a4a5e] px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-[#5DE6FF]" />
            <span>Import</span>
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex items-center gap-2 text-xs font-bold text-white px-4 py-2 rounded-full transition shadow-lg cursor-pointer ${isRecording
              ? 'bg-rose-600 hover:bg-rose-700 animate-pulse shadow-rose-600/30'
              : 'bg-[#6a2153] hover:bg-[#4F46E5] shadow-[#6a2153]/30'
              }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isRecording ? `Recording ${formatTimer(recordingTime)}` : 'Record'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REALTIME LIVE AUDIO RECORDING BANNER                                      */}
      {/* ========================================================================= */}
      {isRecording && (
        <div className="bg-gradient-to-r from-[#6a2153] via-indigo-600 to-[#5DE6FF] text-white px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl border-b border-[#2a4a5e] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-3.5 h-3.5 rounded-full bg-rose-400 animate-ping" />
            <div>
              <div className="font-bold text-xs flex items-center gap-2">
                Live Microphone Audio Recording Active
                <span className="font-mono text-[11px] bg-black/30 px-2 py-0.5 rounded-full">{formatTimer(recordingTime)}</span>
              </div>
              <p className="text-[11px] text-indigo-100 mt-0.5">Streaming speech and generating transcript in real time...</p>
            </div>
          </div>

          {liveTranscript.length > 0 && (
            <div className="bg-black/30 border border-white/20 rounded-xl px-3 py-1.5 text-xs max-w-xl truncate text-white italic">
              "{liveTranscript[liveTranscript.length - 1]}"
            </div>
          )}

          <button
            onClick={stopRecording}
            className="bg-white text-rose-600 hover:bg-rose-50 px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow cursor-pointer shrink-0"
          >
            Stop & Process Audio
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN 3-PANEL VIEWPORT CONTAINER                                          */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

        {/* ----------------------------------------------------------------------- */}
        {/* CENTER TIMELINE & GENERATIONS AREA                                      */}
        {/* ----------------------------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">

          <DailyBriefWidget />

          {/* Date Group Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-[#f5e2de]">Today, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <ChevronDown className="w-4 h-4 text-[#9f8f99]" />
            </div>
            <button className="text-xs text-[#9f8f99] hover:text-white font-medium flex items-center gap-1 cursor-pointer">
              <span>For you</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Note Card List (Middle Generations) */}
          <div className="space-y-3">
            {todayMeetings.length > 0 ? (
              todayMeetings.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleSelectMeeting(m)}
                  className={`bg-[#121624]/90 border rounded-2xl p-4 transition-all duration-200 cursor-pointer backdrop-blur-md flex items-start space-x-4 ${activeMeeting?.id === m.id
                    ? 'border-[#6a2153] bg-[#181B25] ring-2 ring-[#6a2153]/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                    : 'border-[#2a4a5e] hover:border-[#6a2153]/40 hover:bg-[#181B25]/80'
                    }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#6a2153] to-[#5DE6FF] text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-md">
                    S
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-white truncate max-w-sm xl:max-w-md">{m.title}</h3>
                        <span className="text-[10px] font-mono text-[#5DE6FF] bg-[#5DE6FF]/10 px-2 py-0.5 rounded-full border border-[#5DE6FF]/20 shrink-0">
                          Click to open →
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[11px] font-mono text-[#5DE6FF] font-bold">{m.duration || '1 min'}</span>
                        <button
                          onClick={(e) => handleDeleteMeeting(m.id, e)}
                          className="p-1 text-[#9f8f99] hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                          title="Delete recording"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[#9f8f99] font-mono">
                      {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {m.duration || '1 min'} · Sandeep B
                    </p>
                    {m.analysis?.summary && (
                      <p className="text-xs text-[#DFE2EF] pt-1 line-clamp-2 leading-relaxed">
                        {m.analysis.summary}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-[#121624]/80 border border-dashed border-[#2a4a5e] rounded-2xl p-8 text-center space-y-3">
                <FileText className="w-8 h-8 text-[#6a2153] mx-auto" />
                <h4 className="text-sm font-bold text-white">No meeting generations yet today</h4>
                <p className="text-xs text-[#9f8f99]">Click "Import" or "+ Record" to record audio and generate AI transcript notes.</p>
              </div>
            )}
          </div>

          {/* Yesterday Header & List */}
          {yesterdayMeetings.length > 0 && (
            <div className="space-y-3 pt-4">
              <div className="flex items-center space-x-2 text-sm font-bold text-white">
                <span>Yesterday</span>
                <ChevronDown className="w-4 h-4 text-[#9f8f99]" />
              </div>
              {yesterdayMeetings.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleSelectMeeting(m)}
                  className={`bg-[#121624]/90 border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex items-start space-x-4 ${activeMeeting?.id === m.id
                    ? 'border-[#6a2153] bg-[#181B25] ring-2 ring-[#6a2153]/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                    : 'border-[#2a4a5e] hover:border-[#6a2153]/40 hover:bg-[#181B25]/80'
                    }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#6a2153] to-[#5DE6FF] text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-md">
                    S
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-white truncate max-w-sm xl:max-w-md">{m.title}</h3>
                        <span className="text-[10px] font-mono text-[#5DE6FF] bg-[#5DE6FF]/10 px-2 py-0.5 rounded-full border border-[#5DE6FF]/20 shrink-0">
                          Click to open →
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[11px] font-mono text-[#5DE6FF] font-bold">{m.duration || '1 min'}</span>
                        <button
                          onClick={(e) => handleDeleteMeeting(m.id, e)}
                          className="p-1 text-[#9f8f99] hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                          title="Delete recording"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[#9f8f99] font-mono">
                      {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Sandeep B
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </main>

        {/* ----------------------------------------------------------------------- */}
        {/* RIGHT SIDE PANEL: AI CHAT | MEETINGS | ACTION ITEMS                    */}
        {/* ----------------------------------------------------------------------- */}
        <aside className="w-full lg:w-80 xl:w-96 bg-[#0A0E17] border-l border-[#2a4a5e] flex flex-col h-full shrink-0 shadow-2xl">

          {/* Sub-Navigation Tabs Header */}
          <div className="border-b border-[#2a4a5e] px-4 flex items-center space-x-6 shrink-0">
            <button
              onClick={() => setRightPanelTab('chat')}
              className={`py-3.5 text-xs font-bold border-b-2 transition cursor-pointer ${rightPanelTab === 'chat' ? 'border-[#6a2153] text-[#6a2153]' : 'border-transparent text-[#9f8f99] hover:text-white'
                }`}
            >
              AI Chat
            </button>
            <button
              onClick={() => setRightPanelTab('meetings')}
              className={`py-3.5 text-xs font-bold border-b-2 transition cursor-pointer ${rightPanelTab === 'meetings' ? 'border-[#6a2153] text-[#6a2153]' : 'border-transparent text-[#9f8f99] hover:text-white'
                }`}
            >
              Meetings
            </button>
            <button
              onClick={() => setRightPanelTab('actions')}
              className={`py-3.5 text-xs font-bold border-b-2 transition cursor-pointer ${rightPanelTab === 'actions' ? 'border-[#6a2153] text-[#6a2153]' : 'border-transparent text-[#9f8f99] hover:text-white'
                }`}
            >
              Action Items
            </button>
          </div>

          {/* TAB 1: AI CHAT (RAG Assistant) */}
          {rightPanelTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0 p-4">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col space-y-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`p-3 rounded-2xl text-xs max-w-[90%] leading-relaxed ${msg.sender === 'user'
                        ? 'bg-[#6a2153] text-white rounded-br-none shadow-md'
                        : 'bg-[#181B25] text-[#DFE2EF] rounded-bl-none border border-[#2a4a5e]'
                        }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                    <span className="text-[9px] text-[#9f8f99] font-mono px-1">{msg.timestamp}</span>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center space-x-2 text-xs text-[#5DE6FF] font-medium bg-[#181B25] p-3 rounded-xl border border-[#2a4a5e] w-fit animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 text-[#6a2153]" />
                    <span>Searching transcript context...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Form */}
              <form onSubmit={handleSendMessage} className="mt-3 relative shrink-0">
                <input
                  type="text"
                  placeholder="Ask anything about the meeting..."
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  className="w-full bg-[#181B25] text-xs text-[#f5e2de] pl-3.5 pr-10 py-2.5 rounded-xl border border-[#2a4a5e] focus:border-[#6a2153] outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isChatLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#6a2153] hover:bg-[#2a4a5e] rounded-lg transition disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: MEETINGS (Record & Calendar Settings) */}
          {rightPanelTab === 'meetings' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
              <div className="space-y-2">
                <h4 className="font-bold text-white text-sm">Record a live meeting</h4>
                <p className="text-[#9f8f99]">Works with Zoom, Google Meet, or Microsoft Teams</p>

                <div className="relative mt-2">
                  <Video className="w-4 h-4 text-[#9f8f99] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Paste meeting URL to add Notetaker"
                    value={meetingUrlInput}
                    onChange={(e) => setMeetingUrlInput(e.target.value)}
                    className="w-full bg-[#181B25] text-xs text-[#f5e2de] pl-9 pr-3 py-2.5 rounded-xl border border-[#2a4a5e] outline-none focus:border-[#6a2153]"
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-[#2a4a5e] pt-4">
                <h4 className="font-bold text-white">Record upcoming meetings</h4>
                <button className="w-full bg-[#181B25] border border-[#2a4a5e] hover:bg-[#2a4a5e] p-3 rounded-xl flex items-center justify-between text-left cursor-pointer transition">
                  <span className="font-medium text-[#DFE2EF]">AI Notetaker settings</span>
                  <ChevronRight className="w-4 h-4 text-[#9f8f99]" />
                </button>
              </div>

              <div className="space-y-3 border-t border-[#2a4a5e] pt-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-[#5DE6FF]" />
                  <span className="font-bold text-white">Calendar</span>
                </div>
                <p className="text-[#9f8f99] leading-relaxed">
                  Connect your calendar to automatically record and summarize upcoming Zoom, Meet, or Teams calls.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button className="bg-[#181B25] border border-[#2a4a5e] hover:bg-[#2a4a5e] p-2.5 rounded-xl flex items-center justify-center space-x-2 font-bold text-[#DFE2EF] transition cursor-pointer">
                    <Globe className="w-3.5 h-3.5 text-[#5DE6FF]" />
                    <span>Google</span>
                  </button>
                  <button className="bg-[#181B25] border border-[#2a4a5e] hover:bg-[#2a4a5e] p-2.5 rounded-xl flex items-center justify-center space-x-2 font-bold text-[#DFE2EF] transition cursor-pointer">
                    <Globe className="w-3.5 h-3.5 text-[#6a2153]" />
                    <span>Outlook</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACTION ITEMS */}
          {rightPanelTab === 'actions' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <h4 className="font-bold text-white text-sm mb-2">All Action Items ({allActionItems.length})</h4>
              {allActionItems.length > 0 ? (
                allActionItems.map(({ item, meetingTitle, uniqueId }) => (
                  <div
                    key={uniqueId}
                    onClick={() => handleToggleActionItem(item.id)}
                    className="bg-[#181B25] border border-[#2a4a5e] hover:border-[#6a2153]/50 p-3 rounded-xl space-y-1 cursor-pointer transition"
                  >
                    <div className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        checked={item.status === 'completed'}
                        onChange={() => { }}
                        className="w-3.5 h-3.5 accent-[#6a2153] mt-0.5"
                      />
                      <span className={`text-xs ${item.status === 'completed' ? 'line-through text-[#9f8f99]' : 'font-medium text-[#DFE2EF]'}`}>
                        {item.task}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#9f8f99] font-mono pl-5">
                      <span>Assignee: {item.assignee}</span>
                      <span>{meetingTitle}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#9f8f99] text-center pt-8">No action items recorded yet.</p>
              )}
            </div>
          )}

        </aside>

      </div>

      {/* ========================================================================= */}
      {/* UPLOAD FILE MODAL DIALOG                                                  */}
      {/* ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#121624] border border-[#2a4a5e] rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#2a4a5e] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#5DE6FF]" />
                Import Meeting Recording
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-[#9f8f99] hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#DFE2EF] block mb-1">Meeting Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Product Sync"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#181B25] text-xs text-[#f5e2de] px-3.5 py-2.5 rounded-xl border border-[#2a4a5e] focus:border-[#6a2153] outline-none"
                />
              </div>

              {/* Drag and Drop Box */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 transition cursor-pointer flex flex-col items-center justify-center space-y-3 ${dragActive ? 'border-[#5DE6FF] bg-[#5DE6FF]/10' : 'border-[#2a4a5e] hover:border-[#6a2153] bg-[#0A0E17]'
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,.mp4,.mov,audio/*,video/*"
                  onChange={handleFileChange}
                  onClick={(e) => e.stopPropagation()}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-[#5DE6FF]" />
                <div className="text-center">
                  <p className="text-xs font-bold text-white">
                    {file ? file.name : 'Click to upload or drag & drop'}
                  </p>
                  <p className="text-[11px] text-[#9f8f99] mt-0.5">MP4, MOV, MP3, WAV or M4A</p>
                </div>
              </div>

              {/* Pipeline Progress Indicator */}
              {uploadStatus !== 'idle' && (
                <div className="space-y-2 bg-[#181B25] p-3.5 rounded-xl border border-[#2a4a5e]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#5DE6FF]">
                    <span>Processing Pipeline...</span>
                    <span className="capitalize">{uploadStatus}</span>
                  </div>
                  <div className="w-full bg-[#0A0E17] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-[#6a2153] to-[#5DE6FF] h-full transition-all duration-500 w-3/4 animate-pulse" />
                  </div>
                </div>
              )}

              {errorMessage && (
                <p className="text-xs text-rose-300 font-medium bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/30">
                  {errorMessage}
                </p>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#9f8f99] hover:text-white hover:bg-[#181B25] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!file || uploadStatus !== 'idle'}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#6a2153] hover:bg-[#4F46E5] text-white transition disabled:opacity-40 shadow-lg shadow-[#6a2153]/20 cursor-pointer"
                >
                  Start Processing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
