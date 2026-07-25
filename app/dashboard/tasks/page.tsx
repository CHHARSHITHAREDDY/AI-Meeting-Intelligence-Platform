'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Square, 
  CheckSquare2, 
  Search, 
  Filter, 
  Calendar, 
  Link2,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Task } from '@/lib/db';

// Meeting titles for the "source meeting" link — fetched once alongside
// tasks so each task card can link back without a per-task round trip.
interface MeetingTitleLookup {
  [meetingId: string]: string;
}

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetingTitles, setMeetingTitles] = useState<MeetingTitleLookup>({});
  const [loading, setLoading] = useState(true);
  const statsRef = useRef<HTMLDivElement>(null);

  // Tasks are now an independent resource (see app/api/tasks) populated
  // from AI extraction across every meeting plus any manually created
  // tasks — no longer derived client-side from each meeting's analysis.
  const fetchTasks = async () => {
    try {
      const [tasksRes, meetingsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/meetings'),
      ]);
      if (tasksRes.ok) {
        setTasks(await tasksRes.json());
      }
      if (meetingsRes.ok) {
        const meetingsData = await meetingsRes.json();
        const lookup: MeetingTitleLookup = {};
        meetingsData.forEach((m: { id: string; title: string }) => { lookup[m.id] = m.title; });
        setMeetingTitles(lookup);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const toggleTaskStatus = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedStatus = task.status === 'completed' ? 'pending' : 'completed';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: updatedStatus } : t));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: updatedStatus }),
      });
      if (!response.ok) {
        throw new Error('Failed to update task on the server');
      }
    } catch (error) {
      console.error(error);
      // Revert if API failed
      fetchTasks();
    }
  };

  const avatarTextFor = (owner: string) => {
    const parts = owner.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0]) return parts[0].substring(0, 2).toUpperCase();
    return 'TM';
  };

  const filteredTasks = tasks.filter(task => {
    const sourceMeeting = task.meetingId ? (meetingTitles[task.meetingId] || '') : '';
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sourceMeeting.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'pending') return task.status === 'pending';
    if (activeTab === 'completed') return task.status === 'completed';
    return true;
  });

  // Statistics
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-[#2a4a5e] pb-6">
        <div>
          <h2 className="text-3xl font-extrabold font-display text-white mb-1">Tasks Register</h2>
          <p className="text-sm text-[#9f8f99]">Assign, track, and complete action items from all meetings.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#9f8f99]">
          <div className="w-8 h-8 rounded-full border-2 border-[#6a2153]/20 border-t-[#6a2153] animate-spin" />
          <p className="text-sm font-medium font-mono">Loading tasks register...</p>
        </div>
      ) : (
        <>
          {/* Stats Summary cards */}
          <div ref={statsRef} className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in fade-in duration-300">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Total Tasks</p>
                <h3 className="text-2xl font-bold text-zinc-100 mt-1">{totalTasks}</h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                <Link2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Pending Tasks</p>
                <h3 className="text-2xl font-bold text-fuchsia-400 mt-1">{pendingTasks}</h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Completed Tasks</p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">{completedTasks}</h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Tab buttons */}
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 rounded font-semibold text-xs transition-all ${
                  activeTab === 'all' 
                    ? 'bg-zinc-800 text-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.15)]' 
                    : 'text-zinc-500 hover:text-zinc-100'
                }`}
              >
                All Tasks
              </button>
              <button 
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-1.5 rounded font-semibold text-xs transition-all ${
                  activeTab === 'pending' 
                    ? 'bg-zinc-800 text-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.15)]' 
                    : 'text-zinc-500 hover:text-zinc-100'
                }`}
              >
                Pending
              </button>
              <button 
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-1.5 rounded font-semibold text-xs transition-all ${
                  activeTab === 'completed' 
                    ? 'bg-zinc-800 text-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.15)]' 
                    : 'text-zinc-500 hover:text-zinc-100'
                }`}
              >
                Completed
              </button>
            </div>

            {/* Search & Filters */}
            <div className="flex gap-3">
              <div className="relative w-64">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  className="w-full bg-zinc-900/40 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none placeholder-zinc-650"
                  placeholder="Search tasks..."
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Task List Grid */}
          <div className="space-y-3 animate-in fade-in duration-300">
            {filteredTasks.length === 0 ? (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
                <Clock className="w-12 h-12 mx-auto text-zinc-800 mb-4" />
                <p className="text-sm font-semibold">No tasks found matching current filters.</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const sourceMeetingTitle = task.meetingId ? meetingTitles[task.meetingId] : undefined;
                return (
                  <div
                    key={task.id}
                    onClick={() => toggleTaskStatus(task.id)}
                    className={`p-4 rounded-xl border select-none transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 ${
                      isCompleted
                        ? 'bg-zinc-900/20 border-zinc-800/60 opacity-60'
                        : 'bg-zinc-900/40 border-zinc-800/80 hover:border-violet-500/30 shadow-md shadow-black/10'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Custom Checkbox */}
                      <button className={`shrink-0 transition-colors ${isCompleted ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {isCompleted ? (
                          <CheckSquare2 className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <p className={`text-sm font-semibold leading-relaxed transition-all ${
                          isCompleted ? 'line-through text-zinc-600' : 'text-zinc-100'
                        }`}>
                          {task.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500 font-semibold">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Due: {task.dueDate || 'No due date'}
                          </span>
                          {task.meetingId && sourceMeetingTitle && (
                            <>
                              <span className="mx-1 text-zinc-800">•</span>
                              <Link
                                href={`/dashboard/meeting/${task.meetingId}`}
                                className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-violet-400 hover:text-violet-300 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Link2 className="w-3 h-3" /> {sourceMeetingTitle}
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Priority Badge */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${
                        task.priority === 'high'
                          ? 'bg-rose-950/20 text-rose-400 border-rose-800/40'
                          : task.priority === 'medium'
                            ? 'bg-amber-950/20 text-amber-400 border-amber-800/40'
                            : 'bg-zinc-800/20 text-zinc-400 border-zinc-800'
                      }`}>
                        {task.priority}
                      </span>

                      {/* Assignee Avatar */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-6 h-6 rounded-full bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 flex items-center justify-center font-bold text-[9px]">
                          {avatarTextFor(task.assignee)}
                        </div>
                        <span className="text-xs font-semibold text-zinc-200 hidden sm:inline">{task.assignee}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
