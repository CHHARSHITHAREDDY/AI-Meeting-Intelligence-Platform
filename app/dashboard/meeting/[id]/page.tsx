'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckSquare,
  FileText,
  Copy,
  Check,
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  User,
  RefreshCw,
  ShieldAlert,
  ListChecks,
  MessageSquare,
  FileCheck,
  ChevronRight,
  UploadCloud,
  AlertTriangle,
  Search,
  CheckSquare2,
  Square,
  Info,
  Play,
  Pause,
  RotateCcw,
  Film,
  Radio,
  Volume2,
  Layers,
  GraduationCap,
  BookOpen,
  HelpCircle,
  Code2,
  Terminal,
  Package,
  Plug,
  Mic2,
  History,
  Link2,
  Users,
  Target,
  ArrowRightCircle
} from 'lucide-react';
import { Meeting, MindmapNode, Task } from '@/lib/db';
import { ContentType } from '@/lib/classify';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const CONTENT_TYPE_META: Record<ContentType, { label: string; icon: React.ReactNode }> = {
  meeting: { label: 'Meeting', icon: <FileCheck className="w-3 h-3" /> },
  lecture: { label: 'Lecture', icon: <GraduationCap className="w-3 h-3" /> },
  coding: { label: 'Coding Session', icon: <Code2 className="w-3 h-3" /> },
  podcast: { label: 'Podcast', icon: <Mic2 className="w-3 h-3" /> },
  general: { label: 'General', icon: <FileText className="w-3 h-3" /> },
};

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

interface MeetingPageProps {
  params: Promise<{ id: string }>;
}

export default function SingleMeetingSaaSPage({ params }: MeetingPageProps) {
  const { id } = use(params);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Calendar/Task traceability — tasks are an independent resource (see
  // app/api/tasks) that carry the transcript-line/timestamp/speaker
  // traceability AI-extracted action items don't have on their own.
  const [relatedTasks, setRelatedTasks] = useState<Task[]>([]);
  const [highlightedLineId, setHighlightedLineId] = useState<number | null>(null);

  // Meeting Preparation panel — only relevant for a still-`scheduled`
  // meeting (no transcript/analysis yet). Populated from data that already
  // exists elsewhere: the project's prior meetings and its AI summary/flow.
  const [previousMeeting, setPreviousMeeting] = useState<Meeting | null>(null);
  const [pendingProjectTasks, setPendingProjectTasks] = useState<Task[]>([]);
  const [projectSummary, setProjectSummary] = useState<any>(null);


  // Active Main Content View Tabs — just three: Summary, Transcript, Insights.
  // Insights groups everything type-specific together (Decisions/Tasks/Risks
  // for a meeting, Notes/Flashcards/Mindmap/Quiz for a lecture, etc.)
  // instead of splitting each into its own tab.
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'insights'>('summary');

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

  // Fetch single meeting details from backend API
  const fetchMeeting = async () => {
    try {
      const response = await fetch(`/api/meetings/${id}`);
      if (response.ok) {
        const data: Meeting = await response.json();
        setMeeting(data);

        // Initial AI Copilot welcome message
        setChatMessages([
          {
            id: 'msg-init-' + data.id,
            sender: 'assistant',
            text: `Hello! I have indexed the meeting "${data.title}". Ask me any questions about key decisions, action items, risks, or request an Executive MOM.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);

        fetch(`/api/tasks?meetingId=${data.id}`)
          .then(res => res.ok ? res.json() : [])
          .then(setRelatedTasks)
          .catch(() => setRelatedTasks([]));

        if (data.status === 'scheduled') {
          await loadMeetingPreparation(data);
        }
      } else {
        throw new Error('Failed to retrieve meeting details');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading meeting details');
    } fontally: {
      setLoading(false);
    }
  };

  // Composes the Meeting Preparation panel entirely from data that already
  // exists elsewhere in the app — the project's other meetings, its pending
  // tasks, and its AI-synthesized summary/flow — rather than introducing any
  // new backend logic.
  const loadMeetingPreparation = async (scheduled: Meeting) => {
    if (!scheduled.projectId) return;
    try {
      const projectRes = await fetch(`/api/projects/${scheduled.projectId}`);
      if (projectRes.ok) {
        const projectData = await projectRes.json();
        setProjectSummary(projectData.project?.aiSummary || null);
        const priorMeetings: Meeting[] = (projectData.meetings || [])
          .filter((m: Meeting) => m.status === 'completed')
          .sort((a: Meeting, b: Meeting) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPreviousMeeting(priorMeetings[0] || null);
      }

      const tasksRes = await fetch(`/api/tasks?projectId=${scheduled.projectId}&status=pending`);
      if (tasksRes.ok) {
        setPendingProjectTasks(await tasksRes.json());
      }
    } catch (err) {
      console.error('Failed to load meeting preparation data:', err);
    }
  };

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // Toggle Action Item Status
  const handleToggleActionItem = async (itemId: string) => {
    if (!meeting || !meeting.analysis) return;

    const updatedActions = meeting.analysis.actionItems.map(item => {
      if (item.id === itemId) {
        return { 
          ...item, 
          status: (item.status === 'completed' ? 'pending' : 'completed') as 'pending' | 'completed' 
        };
      }
      return item;
    });

    const updatedMeeting: Meeting = {
      ...meeting,
      analysis: {
        ...meeting.analysis,
        actionItems: updatedActions
      }
    };

    setMeeting(updatedMeeting);

    try {
      await fetch(`/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionItems: updatedActions }),
      });
    } catch (err) {
      console.error('Failed to update action item status:', err);
    }
  };

  // Task traceability: click a task -> switch to the Transcript tab, scroll
  // to, and briefly highlight the line it was extracted from.
  const handleJumpToTranscriptLine = (chunkIndex: number) => {
    setActiveTab('transcript');
    setTranscriptSearch('');
    setSelectedSpeaker('all');
    setTimeout(() => {
      document.getElementById(`transcript-line-${chunkIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedLineId(chunkIndex);
      setTimeout(() => setHighlightedLineId(null), 2500);
    }, 50);
  };

  const findTaskForActionItem = (task: string) => relatedTasks.find(t => t.title === task && t.transcriptChunkIndex !== undefined);

  // Send query to AI Meeting Copilot
  const handleSendQuery = async (queryText?: string) => {
    const messageToSend = queryText || inputQuery;
    if (!messageToSend.trim() || !meeting) return;

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
      const response = await fetch(`/api/meetings/${id}/chat`, {
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

  // Copy Transcript
  const handleCopyTranscript = () => {
    if (!meeting?.transcript) return;
    navigator.clipboard.writeText(meeting.transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // Parse Transcript Lines
  const getParsedTranscriptLines = () => {
    if (!meeting?.transcript) return [];
    
    const lines = meeting.transcript.split('\n').filter(l => l.trim().length > 0);
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
  const uniqueSpeakers = Array.from(new Set(parsedTranscript.map(t => t.speaker)));

  const filteredTranscript = parsedTranscript.filter(item => {
    const matchesSearch = transcriptSearch === '' || item.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || item.speaker.toLowerCase().includes(transcriptSearch.toLowerCase());
    const matchesSpeaker = selectedSpeaker === 'all' || item.speaker === selectedSpeaker;
    return matchesSearch && matchesSpeaker;
  });

  const contentType: ContentType = meeting?.analysis?.contentType || 'meeting';

  if (loading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center text-xs text-[#5de6ff] gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading meeting intelligence data...
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="w-full max-w-lg mx-auto p-6 rounded-2xl bg-[#121624] border border-[#232B45] text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">Meeting Not Found</h3>
        <p className="text-xs text-[#94A3B8]">{error || 'The requested meeting recording does not exist.'}</p>
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6366F1] text-white text-xs font-bold shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>
    );
  }

  // A meeting scheduled on the Calendar has no recording/transcript/
  // analysis yet — render an Overview + Meeting Preparation view instead of
  // the Summary/Transcript/Insights tabs, which would just be empty.
  if (meeting.status === 'scheduled') {
    const scheduledMoment = new Date(meeting.scheduledAt || meeting.date);
    const isSoon = scheduledMoment.getTime() - Date.now() < 60 * 60 * 1000;

    return (
      <div className="w-full min-h-[calc(100vh-5rem)] flex flex-col gap-6 antialiased max-w-4xl mx-auto">
        <div className="bg-[#121624]/90 border border-[#232B45] rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard/calendar" className="p-2.5 rounded-xl bg-[#181b25] border border-[#232B45] hover:border-[#6366F1] text-[#94A3B8] hover:text-white transition" title="Back to Calendar">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                {meeting.title}
                <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#6366F1]/10 text-[#c0c1ff] border border-[#6366F1]/30">
                  Scheduled
                </span>
              </h1>
              <div className="flex items-center space-x-4 text-xs text-[#94A3B8] font-mono mt-1">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[#6366F1]" />{scheduledMoment.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                {meeting.durationMinutes && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#5de6ff]" />{meeting.durationMinutes}m</span>}
              </div>
            </div>
          </div>
          <Link
            href={`/dashboard/upload?meetingId=${meeting.id}`}
            className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5457d1] text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer shadow-md"
          >
            <UploadCloud className="w-4 h-4" />
            Attach Recording
          </Link>
        </div>

        {isSoon && (
          <div className="bg-amber-400/5 border border-amber-400/30 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Meeting Preparation — starting soon
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">Previous Meeting</p>
                {previousMeeting ? (
                  <Link href={`/dashboard/meeting/${previousMeeting.id}`} className="block p-3 rounded-xl bg-[#0a0e17] border border-[#232B45] hover:border-[#6366F1] text-xs text-[#dfe2ef]">
                    {previousMeeting.title}
                    <span className="block text-[10px] text-[#94A3B8] font-mono mt-0.5">{new Date(previousMeeting.date).toLocaleDateString()}</span>
                  </Link>
                ) : (
                  <p className="text-xs text-[#94A3B8]">No prior meeting found in this project.</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">Open Decisions / Next Priorities</p>
                {projectSummary?.nextPriorities?.length > 0 ? (
                  <ul className="space-y-1">
                    {projectSummary.nextPriorities.slice(0, 4).map((p: string, idx: number) => (
                      <li key={idx} className="text-xs text-[#dfe2ef] flex items-start gap-2">
                        <Target className="w-3 h-3 text-[#5de6ff] mt-0.5 shrink-0" /><span>{p}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#94A3B8]">No open priorities recorded yet.</p>
                )}
              </div>
            </div>
            {pendingProjectTasks.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">Pending Tasks ({pendingProjectTasks.length})</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {pendingProjectTasks.slice(0, 6).map(t => (
                    <div key={t.id} className="text-xs p-2.5 rounded-lg bg-[#0a0e17] border border-[#232B45] flex items-center justify-between">
                      <span className="text-[#dfe2ef] line-clamp-1">{t.title}</span>
                      <span className="text-[10px] text-[#94A3B8] font-mono shrink-0 ml-2">{t.assignee}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-[#121624]/90 border border-[#232B45] rounded-3xl p-6 shadow-2xl backdrop-blur-md space-y-6">
          <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#6366F1]" /> Agenda
            </h3>
            <p className="text-xs text-[#dfe2ef] leading-relaxed whitespace-pre-wrap">
              {meeting.agenda || 'No agenda set for this meeting yet.'}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
              <Users className="w-4 h-4 text-[#6366F1]" /> Participants {meeting.participants?.length ? `(${meeting.participants.length})` : ''}
            </h3>
            {meeting.participants && meeting.participants.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {meeting.participants.map((p, idx) => (
                  <span key={idx} className="text-xs px-3 py-1.5 rounded-lg bg-[#181b25] border border-[#232B45] text-[#dfe2ef]">{p}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#94A3B8]">No participants listed.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex flex-col xl:flex-row gap-6 antialiased">

      {/* CENTER MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col space-y-6 min-w-0">

        {/* TOP HEADER */}
        <div className="bg-[#121624]/90 border border-[#232B45] rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <Link 
              href="/dashboard"
              className="p-2.5 rounded-xl bg-[#181b25] border border-[#232B45] hover:border-[#6366F1] text-[#94A3B8] hover:text-white transition"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                {meeting.title}
                <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/30">
                  AI Analyzed
                </span>
                {meeting.analysis?.contentType && (
                  <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#6366F1]/10 text-[#a5b4fc] border border-[#6366F1]/30 flex items-center gap-1.5">
                    {CONTENT_TYPE_META[meeting.analysis.contentType].icon}
                    {CONTENT_TYPE_META[meeting.analysis.contentType].label}
                  </span>
                )}
                {meeting.language && (
                  <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#5de6ff]/10 text-[#5de6ff] border border-[#5de6ff]/30 flex items-center gap-1.5">
                    <span>🌐</span>
                    <span>
                      {meeting.language === 'auto'
                        ? `Auto (${meeting.detectedLanguage || 'Detected'})`
                        : meeting.language === 'hi'
                        ? 'Hindi'
                        : meeting.language === 'te'
                        ? 'Telugu'
                        : 'English'}
                    </span>
                  </span>
                )}
              </h1>
              <div className="flex items-center space-x-4 text-xs text-[#94A3B8] font-mono mt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#6366F1]" /> 
                  {new Date(meeting.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#5de6ff]" /> 
                  {meeting.duration || '2m 30s'}
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-[#181b25] border border-[#232B45] hover:border-[#6366F1] text-xs font-semibold text-[#c0c1ff] hover:text-white transition flex items-center gap-2 cursor-pointer shadow-md"
          >
            <UploadCloud className="w-4 h-4 text-[#6366F1]" />
            Upload New Recording
          </Link>
        </div>

        {/* MAIN PROCESSED VIEW: TRANSCRIPT & SUMMARY TABS */}
        <div className="bg-[#121624]/90 border border-[#232B45] rounded-3xl p-6 shadow-2xl backdrop-blur-md flex-1 flex flex-col min-h-0 space-y-6">
          
          {/* Tab Controls — just three: Summary, Transcript, Insights */}
          <div className="flex items-center justify-between border-b border-[#232B45] pb-4">
            <div className="flex items-center space-x-2 bg-[#0a0e17] p-1.5 rounded-xl border border-[#232B45]">
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/30'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#181b25]'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Summary
              </button>
              <button
                onClick={() => setActiveTab('transcript')}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'transcript'
                    ? 'bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/30'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#181b25]'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Transcript
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1c1f29] text-[#5de6ff]">
                  {parsedTranscript.length} lines
                </span>
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'insights'
                    ? 'bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/30'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#181b25]'
                }`}
              >
                <Layers className="w-4 h-4" />
                Insights
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
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0e17] p-3 rounded-xl border border-[#232B45]">
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

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[550px] scrollbar-thin scrollbar-thumb-[#232B45]">
                {filteredTranscript.length > 0 ? (
                  filteredTranscript.map((item) => (
                    <div
                      key={item.id}
                      id={`transcript-line-${item.id}`}
                      className={`p-4 rounded-2xl border transition space-y-1.5 ${
                        highlightedLineId === item.id
                          ? 'bg-[#6366F1]/15 border-[#6366F1]'
                          : 'bg-[#0a0e17]/80 border-[#232B45] hover:border-[#6366F1]/40'
                      }`}
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

          {/* SUMMARY TAB — just the executive summary + key points */}
          {activeTab === 'summary' && (
            <div className="space-y-6 overflow-y-auto pr-2 max-h-[600px] scrollbar-thin scrollbar-thumb-[#232B45]">
              <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#6366F1]" />
                  Executive Summary
                </h3>
                <p className="text-xs text-[#dfe2ef] leading-relaxed">
                  {meeting.analysis?.summary || 'Summary processing complete.'}
                </p>
              </div>

              {meeting.analysis?.keyDiscussionPoints && meeting.analysis.keyDiscussionPoints.length > 0 && (
                <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-[#6366F1]" />
                    Key Discussion Points
                  </h3>
                  <ul className="space-y-2">
                    {meeting.analysis.keyDiscussionPoints.map((point, idx) => (
                      <li key={idx} className="text-xs text-[#dfe2ef] flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff] mt-1.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* INSIGHTS TAB — everything type-specific, grouped together */}
          {activeTab === 'insights' && (
            <div className="space-y-6 overflow-y-auto pr-2 max-h-[600px] scrollbar-thin scrollbar-thumb-[#232B45]">

              {contentType === 'lecture' && (
                <>
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#6366F1]" />
                      Study Notes
                    </h3>
                    {meeting.analysis?.notes && meeting.analysis.notes.length > 0 ? (
                      <ul className="space-y-2">
                        {meeting.analysis.notes.map((note, idx) => (
                          <li key={idx} className="text-xs text-[#dfe2ef] flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff] mt-1.5 shrink-0" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No study notes captured.</p>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#6366F1]" />
                      Flashcards {meeting.analysis?.flashcards?.length ? `(${meeting.analysis.flashcards.length})` : ''}
                    </h3>
                    {meeting.analysis?.flashcards && meeting.analysis.flashcards.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {meeting.analysis.flashcards.map((card, idx) => {
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
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No flashcards generated.</p>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#6366F1]" />
                      Mindmap
                    </h3>
                    {meeting.analysis?.mindmap ? (
                      <MindmapView node={meeting.analysis.mindmap} depth={0} />
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No mindmap generated.</p>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#6366F1]" />
                      Quiz {meeting.analysis?.quiz?.length ? `(${meeting.analysis.quiz.length})` : ''}
                    </h3>
                    {meeting.analysis?.quiz && meeting.analysis.quiz.length > 0 ? (
                      <div className="space-y-4">
                        {meeting.analysis.quiz.map((q, qIdx) => {
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
                                      className={`text-left text-[11px] px-3 py-2 rounded-lg border transition cursor-pointer ${
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
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No quiz generated.</p>
                    )}
                  </div>
                </>
              )}

              {contentType === 'coding' && (
                <>
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-[#6366F1]" />
                      Code Guide
                    </h3>
                    <p className="text-xs text-[#dfe2ef] leading-relaxed whitespace-pre-wrap font-mono">
                      {meeting.analysis?.codeGuide || 'No code walkthrough generated.'}
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Plug className="w-4 h-4 text-[#6366F1]" />
                      APIs {meeting.analysis?.apis?.length ? `(${meeting.analysis.apis.length})` : ''}
                    </h3>
                    {meeting.analysis?.apis && meeting.analysis.apis.length > 0 ? (
                      <div className="space-y-2">
                        {meeting.analysis.apis.map((api, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-[#181b25] border border-[#232B45]">
                            <span className="text-xs font-bold text-white font-mono">{api.name}</span>
                            <p className="text-[11px] text-[#94A3B8] mt-0.5">{api.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No APIs mentioned.</p>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#6366F1]" />
                      Libraries {meeting.analysis?.libraries?.length ? `(${meeting.analysis.libraries.length})` : ''}
                    </h3>
                    {meeting.analysis?.libraries && meeting.analysis.libraries.length > 0 ? (
                      <div className="space-y-2">
                        {meeting.analysis.libraries.map((lib, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-[#181b25] border border-[#232B45]">
                            <span className="text-xs font-bold text-white font-mono">{lib.name}</span>
                            <p className="text-[11px] text-[#94A3B8] mt-0.5">{lib.purpose}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No libraries mentioned.</p>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-[#6366F1]" />
                      Commands {meeting.analysis?.commands?.length ? `(${meeting.analysis.commands.length})` : ''}
                    </h3>
                    {meeting.analysis?.commands && meeting.analysis.commands.length > 0 ? (
                      <div className="space-y-2">
                        {meeting.analysis.commands.map((cmd, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-[#181b25] border border-[#232B45]">
                            <code className="text-[11px] font-mono text-[#5de6ff]">{cmd.command}</code>
                            <p className="text-[11px] text-[#94A3B8] mt-0.5">{cmd.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No commands referenced.</p>
                    )}
                  </div>
                </>
              )}

              {contentType === 'podcast' && (
                <>
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#6366F1]" />
                      Key Insights
                    </h3>
                    {meeting.analysis?.keyInsights && meeting.analysis.keyInsights.length > 0 ? (
                      <ul className="space-y-2">
                        {meeting.analysis.keyInsights.map((insight, idx) => (
                          <li key={idx} className="text-xs text-[#dfe2ef] flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5de6ff] mt-1.5 shrink-0" />
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No key insights captured.</p>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <History className="w-4 h-4 text-[#6366F1]" />
                      Timeline
                    </h3>
                    {meeting.analysis?.timeline && meeting.analysis.timeline.length > 0 ? (
                      <div className="space-y-2">
                        {meeting.analysis.timeline.map((entry, idx) => (
                          <div key={idx} className="flex items-start gap-3 text-xs p-3 rounded-xl bg-[#181b25] border border-[#232B45]">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#0a0e17] border border-[#232B45] text-[#5de6ff] shrink-0">{entry.timestamp}</span>
                            <span className="text-[#dfe2ef]">{entry.topic}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No timeline generated.</p>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-[#6366F1]" />
                      Resources {meeting.analysis?.resources?.length ? `(${meeting.analysis.resources.length})` : ''}
                    </h3>
                    {meeting.analysis?.resources && meeting.analysis.resources.length > 0 ? (
                      <div className="space-y-2">
                        {meeting.analysis.resources.map((res, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-[#181b25] border border-[#232B45] flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-white">{res.name}</span>
                              {res.type && <span className="text-[10px] text-[#94A3B8] ml-2 uppercase font-mono">{res.type}</span>}
                            </div>
                            {res.reference && <span className="text-[10px] text-[#5de6ff] font-mono truncate max-w-[40%]">{res.reference}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#94A3B8]">No resources mentioned.</p>
                    )}
                  </div>
                </>
              )}

              {(contentType === 'meeting' || contentType === 'general') && (
                <>
                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-[#6366F1]" />
                      Decisions Taken ({meeting.analysis?.decisions.length || 0})
                    </h3>
                    <div className="space-y-3">
                      {meeting.analysis?.decisions && meeting.analysis.decisions.length > 0 ? (
                        meeting.analysis.decisions.map((d) => (
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

                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-[#6366F1]" />
                      Action Items ({meeting.analysis?.actionItems.length || 0})
                    </h3>
                    <div className="space-y-2.5">
                      {meeting.analysis?.actionItems && meeting.analysis.actionItems.length > 0 ? (
                        meeting.analysis.actionItems.map((item) => {
                          const trace = findTaskForActionItem(item.task);
                          return (
                            <div
                              key={item.id}
                              className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
                                item.status === 'completed'
                                  ? 'bg-emerald-500/5 border-emerald-500/30 text-[#94A3B8]'
                                  : 'bg-[#181b25] border-[#232B45] hover:border-[#6366F1] text-[#dfe2ef]'
                              }`}
                            >
                              <div onClick={() => handleToggleActionItem(item.id)} className="flex items-center space-x-3 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={item.status === 'completed'}
                                  onChange={() => {}}
                                  className="w-4 h-4 accent-[#6366F1] cursor-pointer"
                                />
                                <span className={`text-xs ${item.status === 'completed' ? 'line-through text-[#94A3B8]' : 'font-medium'}`}>
                                  {item.task}
                                </span>
                              </div>

                              <div className="flex items-center space-x-3 text-[10px] font-mono shrink-0">
                                {trace && (
                                  <button
                                    onClick={() => handleJumpToTranscriptLine(trace.transcriptChunkIndex!)}
                                    title={`Jump to ${trace.sourceTimestamp || 'source'} in transcript`}
                                    className="p-1 rounded text-[#5de6ff] hover:text-white hover:bg-[#5de6ff]/10 cursor-pointer"
                                  >
                                    <ArrowRightCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <span className="px-2 py-0.5 rounded bg-[#0a0e17] border border-[#232B45] text-[#c0c1ff]">
                                  {item.assignee}
                                </span>
                                <span className="text-[#94A3B8]">Due: {item.dueDate}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-[#94A3B8]">No action items assigned.</p>
                      )}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#6366F1]" />
                      Risks Identified ({meeting.analysis?.risks.length || 0})
                    </h3>
                    <div className="space-y-3">
                      {meeting.analysis?.risks && meeting.analysis.risks.length > 0 ? (
                        meeting.analysis.risks.map((r) => (
                          <div key={r.id} className="p-3.5 rounded-xl bg-[#181b25] border border-[#232B45] space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white">{r.risk}</span>
                              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                                r.impact === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
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

                  {meeting.analysis?.nextSteps && meeting.analysis.nextSteps.length > 0 && (
                    <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-[#6366F1]" />
                        Next Steps
                      </h3>
                      <ul className="space-y-2">
                        {meeting.analysis.nextSteps.map((step, idx) => (
                          <li key={idx} className="text-xs text-[#dfe2ef] flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

            </div>
          )}

        </div>

      </div>

      {/* RIGHT AI COPILOT PANEL */}
      <div className="w-full xl:w-96 bg-[#121624]/90 border border-[#232B45] rounded-3xl p-5 shadow-2xl backdrop-blur-md flex flex-col h-[750px] xl:h-auto shrink-0">
        
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

          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Connected to meeting context" />
        </div>

        {/* Suggested Prompt Chips */}
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

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 scrollbar-thin scrollbar-thumb-[#232B45]">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1 ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`p-3.5 rounded-2xl text-xs max-w-[90%] leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-[#6366F1] text-white rounded-br-none shadow-md shadow-[#6366F1]/20'
                    : 'bg-[#0a0e17] text-[#dfe2ef] border border-[#232B45] rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-line">{msg.text}</p>
              </div>
              <span className="text-[9px] text-[#94A3B8] font-mono px-1">{msg.timestamp}</span>
            </div>
          ))}

          {isChatLoading && (
            <div className="flex items-center space-x-2 p-3 rounded-2xl bg-[#0a0e17] border border-[#232B45] text-xs text-[#5de6ff] w-fit">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing meeting context...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery();
          }}
          className="relative pt-2 border-t border-[#232B45]"
        >
          <input
            type="text"
            disabled={isChatLoading}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask anything about this meeting..."
            className="w-full bg-[#0a0e17] text-white text-xs pl-3.5 pr-10 py-3 rounded-xl border border-[#232B45] focus:outline-none focus:border-[#6366F1] placeholder-[#94A3B8] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isChatLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#6366F1] text-white hover:bg-[#4F46E5] disabled:opacity-40 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>

    </div>
  );
}
