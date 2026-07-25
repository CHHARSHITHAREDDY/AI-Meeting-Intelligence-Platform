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
  Volume2
} from 'lucide-react';
import { Meeting } from '@/lib/db';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface MeetingPageProps {
  params: Promise<{ id: string }>;
}

export default function SingleMeetingSaaSPage({ params }: MeetingPageProps) {
  const { id } = use(params);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


  // Active Main Content View Tabs ('summary' | 'transcript')
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');

  // Transcript Features State
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [copiedTranscript, setCopiedTranscript] = useState(false);

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
          
          {/* Tab Controls */}
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
                <FileText className="w-4 h-4" />
                Summary & Insights
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

          {/* TAB 2: SUMMARY VIEW */}
          {activeTab === 'summary' && (
            <div className="space-y-6 overflow-y-auto pr-2 max-h-[600px] scrollbar-thin scrollbar-thumb-[#232B45]">
              {/* Executive Summary */}
              <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#6366F1]" />
                  1. Executive Summary
                </h3>
                <p className="text-xs text-[#dfe2ef] leading-relaxed">
                  {meeting.analysis?.summary || 'Summary processing complete.'}
                </p>
              </div>

              {/* Key Discussion Points */}
              {meeting.analysis?.keyDiscussionPoints && meeting.analysis.keyDiscussionPoints.length > 0 && (
                <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-[#6366F1]" />
                    2. Key Discussion Points
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

              {/* Decisions Taken */}
              <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#6366F1]" />
                    3. Decisions Taken ({meeting.analysis?.decisions.length || 0})
                  </span>
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

              {/* Action Items */}
              <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#6366F1]" />
                  4. Action Items ({meeting.analysis?.actionItems.length || 0})
                </h3>

                <div className="space-y-2.5">
                  {meeting.analysis?.actionItems && meeting.analysis.actionItems.length > 0 ? (
                    meeting.analysis.actionItems.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => handleToggleActionItem(item.id)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          item.status === 'completed'
                            ? 'bg-emerald-500/5 border-emerald-500/30 text-[#94A3B8]'
                            : 'bg-[#181b25] border-[#232B45] hover:border-[#6366F1] text-[#dfe2ef]'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
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

              {/* Risks Identified */}
              <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#6366F1]" />
                  5. Risks Identified ({meeting.analysis?.risks.length || 0})
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

              {/* Next Steps */}
              {meeting.analysis?.nextSteps && meeting.analysis.nextSteps.length > 0 && (
                <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-[#6366F1]" />
                    6. Next Steps
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
