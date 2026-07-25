'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Sparkles,
  Bot,
  Send,
  RefreshCw,
  AlertTriangle,
  FolderKanban,
  ListChecks,
  CheckSquare,
  ShieldAlert,
  TrendingUp,
  GitBranch,
  UploadCloud,
} from 'lucide-react';
import { Meeting, Project } from '@/lib/db';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

type TabKey = 'meetings' | 'summary' | 'ask' | 'progress' | 'flow';

export default function ProjectWorkspacePage({ params }: ProjectPageProps) {
  const { id } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to load project');
      const data = await res.json();
      setProject(data.project);
      setMeetings(Array.isArray(data.meetings) ? data.meetings : []);
    } catch (err: any) {
      setError(err.message || 'Error loading project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/projects/${id}/refresh`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
      }
    } catch (err) {
      console.error('Failed to refresh project intelligence:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAsk = async (queryText?: string) => {
    const messageToSend = queryText || inputQuery;
    if (!messageToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: messageToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsChatLoading(true);

    try {
      const res = await fetch(`/api/projects/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend }),
      });
      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: res.ok ? (data.reply || 'No response returned.') : (data.error || 'Failed to get a response.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setChatMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: `Sorry, something went wrong: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center text-xs text-[#5de6ff] gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading project workspace...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="w-full max-w-lg mx-auto p-6 rounded-2xl bg-[#121624] border border-[#232B45] text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="text-sm font-bold text-white">Project Not Found</h3>
        <p className="text-xs text-[#94A3B8]">{error || 'The requested project does not exist.'}</p>
        <Link href="/dashboard/projects" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6366F1] text-white text-xs font-bold shadow-lg">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
      </div>
    );
  }

  const completedMeetings = meetings.filter((m) => m.status === 'completed');
  const summary = project.aiSummary;
  const progress = project.progress;
  const flow = project.flow || [];

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'meetings', label: 'Meetings', icon: <FileText className="w-4 h-4" /> },
    { key: 'summary', label: 'AI Project Summary', icon: <Sparkles className="w-4 h-4" /> },
    { key: 'ask', label: 'Ask AI', icon: <Bot className="w-4 h-4" /> },
    { key: 'progress', label: 'Progress', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'flow', label: 'Project Flow', icon: <GitBranch className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full space-y-6">
      {/* HEADER */}
      <div className="bg-[#121624]/90 border border-[#232B45] rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4 min-w-0">
          <Link href="/dashboard/projects" className="p-2.5 rounded-xl bg-[#181b25] border border-[#232B45] hover:border-[#6366F1] text-[#94A3B8] hover:text-white transition shrink-0" title="Back to Projects">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center shrink-0">
            <FolderKanban className="w-4 h-4 text-[#6366F1]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white tracking-tight truncate">{project.name}</h1>
            <div className="flex items-center space-x-4 text-xs text-[#94A3B8] font-mono mt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#6366F1]" />
                {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#5de6ff]" />
                {meetings.length} meeting{meetings.length === 1 ? '' : 's'}
              </span>
              {project.intelligenceUpdatedAt && (
                <span className="text-[10px]">Updated {new Date(project.intelligenceUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing || completedMeetings.length === 0}
            className="px-4 py-2 rounded-xl bg-[#181b25] border border-[#232B45] hover:border-[#6366F1] text-xs font-semibold text-[#c0c1ff] hover:text-white transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#6366F1] ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Intelligence'}
          </button>
          <Link
            href={`/dashboard/upload?projectId=${project.id}`}
            className="px-4 py-2 rounded-xl text-xs font-bold btn-primary-cta flex items-center gap-2 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Meeting
          </Link>
        </div>
      </div>

      {project.description && (
        <div className="bg-[#12172A] border border-[#232B45] rounded-2xl p-4">
          <p className="text-xs text-[#94A3B8] leading-relaxed">{project.description}</p>
        </div>
      )}

      {/* TAB BAR */}
      <div className="bg-[#121624]/90 border border-[#232B45] rounded-3xl p-6 shadow-2xl backdrop-blur-md space-y-6">
        <div className="flex items-center gap-2 bg-[#0a0e17] p-1.5 rounded-xl border border-[#232B45] overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === tab.key
                  ? 'bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/30'
                  : 'text-[#94A3B8] hover:text-white hover:bg-[#181b25]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* MEETINGS TAB */}
        {activeTab === 'meetings' && (
          <div className="space-y-3">
            {meetings.length === 0 ? (
              <EmptyState text="No meetings in this project yet. Upload one to get started." />
            ) : (
              meetings.slice().reverse().map((m) => (
                <Link
                  key={m.id}
                  href={`/dashboard/meeting/${m.id}`}
                  className="block p-4 rounded-xl bg-[#0a0e17] border border-[#232B45] hover:border-[#6366F1] transition space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-white truncate">{m.title}</h4>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full shrink-0 ${
                      m.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      : m.status === 'failed' ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    }`}>
                      {m.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8] line-clamp-2">{m.analysis?.summary || 'Processing...'}</p>
                  <div className="flex items-center gap-4 text-[10px] font-mono text-[#94A3B8] pt-1">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(m.date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.duration}</span>
                    {m.analysis && (
                      <>
                        <span>{m.analysis.decisions?.length || 0} decisions</span>
                        <span>{m.analysis.actionItems?.length || 0} actions</span>
                        <span>{m.analysis.risks?.length || 0} risks</span>
                      </>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* AI PROJECT SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {!summary ? (
              <EmptyState text="No AI project summary yet — upload and analyze at least one meeting, then it will generate automatically." />
            ) : (
              <>
                <SummaryCard icon={<Sparkles className="w-4 h-4 text-[#6366F1]" />} title="Project Objective" body={summary.objective} />
                <SummaryCard icon={<TrendingUp className="w-4 h-4 text-[#6366F1]" />} title="Current Focus" body={summary.currentFocus} />
                <SummaryCard icon={<ListChecks className="w-4 h-4 text-[#6366F1]" />} title="Overall Progress" body={summary.overallProgress} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ListCard title="Completed Work" items={summary.completedWork} accent="emerald" />
                  <ListCard title="Work In Progress" items={summary.workInProgress} accent="indigo" />
                  <ListCard title="Remaining Work" items={summary.remainingWork} accent="rose" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ListCard title="Recent Achievements" items={summary.recentAchievements} accent="cyan" />
                  <ListCard title="Next Priorities" items={summary.nextPriorities} accent="amber" />
                </div>
              </>
            )}
          </div>
        )}

        {/* ASK AI TAB */}
        {activeTab === 'ask' && (
          <div className="flex flex-col h-[520px]">
            <div className="mb-4 space-y-1.5">
              <p className="text-[10px] text-[#94A3B8] font-mono uppercase tracking-wider">Try asking:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Summarize the project.',
                  'What changed since the last meeting?',
                  'What decisions have been made?',
                  'What tasks are still pending?',
                  'What blockers remain?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleAsk(prompt)}
                    disabled={isChatLoading}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[#0a0e17] border border-[#232B45] hover:border-[#6366F1] text-[#c0c1ff] hover:text-white transition cursor-pointer text-left truncate max-w-full"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 scrollbar-thin scrollbar-thumb-[#232B45]">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-[#94A3B8]">
                  <Bot className="w-8 h-8 text-[#6366F1]/50" />
                  <p className="text-xs">Ask anything about this project — I'll search across every meeting.</p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col space-y-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-3.5 rounded-2xl text-xs max-w-[80%] leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#6366F1] text-white rounded-br-none shadow-md shadow-[#6366F1]/20'
                        : 'bg-[#0a0e17] text-[#dfe2ef] border border-[#232B45] rounded-bl-none'
                    }`}>
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                    <span className="text-[9px] text-[#94A3B8] font-mono px-1">{msg.timestamp}</span>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="flex items-center space-x-2 p-3 rounded-2xl bg-[#0a0e17] border border-[#232B45] text-xs text-[#5de6ff] w-fit">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching across project meetings...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="relative pt-2 border-t border-[#232B45]">
              <input
                type="text"
                disabled={isChatLoading}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask anything about this project..."
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
        )}

        {/* PROGRESS TAB */}
        {activeTab === 'progress' && (
          <div className="space-y-4">
            {!progress ? (
              <EmptyState text="No progress data yet — upload and analyze at least one meeting." />
            ) : (
              <>
                <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#6366F1]" />
                      Overall Completion
                    </h3>
                    <span className="text-lg font-bold text-white font-mono">{progress.completionPercent}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#181b25] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#6366F1] via-[#5de6ff] to-[#34D399] transition-all duration-500 rounded-full"
                      style={{ width: `${progress.completionPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#94A3B8]">Current Focus: {progress.currentFocus}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ListCard title="Completed Features" items={progress.completedFeatures} accent="emerald" icon={<CheckSquare className="w-3.5 h-3.5" />} />
                  <ListCard title="In Progress" items={progress.inProgressFeatures} accent="indigo" icon={<RefreshCw className="w-3.5 h-3.5" />} />
                  <ListCard title="Pending / Blocked" items={progress.pendingFeatures} accent="rose" icon={<ShieldAlert className="w-3.5 h-3.5" />} />
                </div>

                <ListCard title="Recently Completed" items={progress.recentlyCompleted} accent="cyan" />
              </>
            )}
          </div>
        )}

        {/* PROJECT FLOW TAB */}
        {activeTab === 'flow' && (
          <div className="space-y-4">
            {flow.length === 0 ? (
              <EmptyState text="No project timeline yet — upload and analyze at least one meeting." />
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-[#232B45]">
                {flow.map((entry, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#6366F1] border-2 border-[#0a0e17] shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                    <div className="p-4 rounded-xl bg-[#0a0e17] border border-[#232B45]">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <h4 className="text-sm font-bold text-white">{entry.title}</h4>
                        {entry.date && <span className="text-[10px] font-mono text-[#5de6ff] shrink-0">{entry.date}</span>}
                      </div>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">{entry.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-10 text-center bg-[#0a0e17] border border-[#232B45] rounded-2xl">
      <p className="text-xs text-[#94A3B8]">{text}</p>
    </div>
  );
}

function SummaryCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="p-5 rounded-2xl bg-[#0a0e17] border border-[#232B45] space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5de6ff] font-mono flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <p className="text-xs text-[#dfe2ef] leading-relaxed">{body}</p>
    </div>
  );
}

const ACCENT_CLASSES: Record<string, string> = {
  emerald: 'border-emerald-500/30 text-emerald-300',
  indigo: 'border-[#6366F1]/30 text-[#c0c1ff]',
  rose: 'border-rose-500/30 text-rose-300',
  cyan: 'border-cyan-500/30 text-cyan-300',
  amber: 'border-amber-500/30 text-amber-300',
};

function ListCard({ title, items, accent, icon }: { title: string; items: string[]; accent: string; icon?: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-[#0a0e17] border border-[#232B45] space-y-2.5">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] font-mono">{title} ({items?.length || 0})</h4>
      {items && items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className={`text-xs text-[#dfe2ef] flex items-start gap-2 pl-2 border-l-2 ${ACCENT_CLASSES[accent] || 'border-[#232B45]'}`}>
              {icon}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-[#94A3B8]">None yet.</p>
      )}
    </div>
  );
}
