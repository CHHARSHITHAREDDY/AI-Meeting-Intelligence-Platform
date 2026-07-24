'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
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
import { Meeting, ActionItem } from '@/lib/db';

interface TaskItem {
  id: string; // page-unique ID: meetingId-itemId
  dbId: string; // raw ID in database
  meetingId: string;
  task: string;
  assignee: string;
  avatarText: string;
  dueDate: string;
  sourceMeeting: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'pending' | 'completed';
}

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const statsRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const counters = statsRef.current?.querySelectorAll('.task-stat-counter');
      counters?.forEach((counter) => {
        const targetVal = parseFloat(counter.getAttribute('data-target') || '0');
        const obj = { val: 0 };

        gsap.to(obj, {
          val: targetVal,
          duration: 1.5,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: counter,
            start: 'top 80%',
            once: true,
          },
          onUpdate: () => {
            counter.textContent = `${Math.round(obj.val)}`;
          },
        });
      });
    });

    return () => mm.revert();
  }, { scope: statsRef, dependencies: [tasks] });

  const fetchTasksAndMeetings = async () => {
    try {
      const response = await fetch('/api/meetings');
      if (response.ok) {
        const meetingsData: Meeting[] = await response.json();
        setMeetings(meetingsData);

        const extractedTasks: TaskItem[] = [];
        meetingsData.forEach(meeting => {
          if (meeting.status === 'completed' && meeting.analysis?.actionItems) {
            meeting.analysis.actionItems.forEach((a, idx) => {
              const itemId = a.id || `act-${idx + 1}`;

              // Avatar initials
              const owner = a.assignee || 'Team';
              const parts = owner.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/);
              let avatarText = 'TM';
              if (parts.length >= 2) {
                avatarText = (parts[0][0] + parts[1][0]).toUpperCase();
              } else if (parts.length === 1 && parts[0]) {
                avatarText = parts[0].substring(0, 2).toUpperCase();
              }

              // Priority calculation based on task keywords
              let priority: 'High' | 'Medium' | 'Low' = 'Medium';
              const lowerTask = a.task.toLowerCase();
              if (
                lowerTask.includes('critical') || 
                lowerTask.includes('immediate') || 
                lowerTask.includes('urgent') || 
                lowerTask.includes('db') || 
                lowerTask.includes('redis') || 
                lowerTask.includes('latency')
              ) {
                priority = 'High';
              } else if (
                lowerTask.includes('document') || 
                lowerTask.includes('copy') || 
                lowerTask.includes('pricing sheet') || 
                lowerTask.includes('nice to')
              ) {
                priority = 'Low';
              }

              extractedTasks.push({
                id: `${meeting.id}-${itemId}`,
                dbId: itemId,
                meetingId: meeting.id,
                task: a.task,
                assignee: owner,
                avatarText: avatarText,
                dueDate: a.dueDate || 'No due date',
                sourceMeeting: meeting.title,
                priority: priority,
                status: a.status || 'pending'
              });
            });
          }
        });

        setTasks(extractedTasks);
      }
    } catch (error) {
      console.error('Failed to fetch tasks/meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksAndMeetings();
  }, []);

  const toggleTaskStatus = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Toggle local state immediately
    const updatedStatus = task.status === 'completed' ? 'pending' : 'completed';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: updatedStatus } : t));

    // Prepare update request for meeting
    const parentMeeting = meetings.find(m => m.id === task.meetingId);
    if (!parentMeeting || !parentMeeting.analysis) return;

    const updatedDbActionItems: ActionItem[] = parentMeeting.analysis.actionItems.map((item, idx) => {
      const itemId = item.id || `act-${idx + 1}`;
      if (itemId === task.dbId || item.id === task.dbId) {
        return { ...item, status: updatedStatus as 'pending' | 'completed' };
      }
      return item;
    });

    try {
      const response = await fetch(`/api/meetings/${task.meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionItems: updatedDbActionItems }),
      });
      if (!response.ok) {
        throw new Error('Failed to update action item on the server');
      }
      
      // Update local meetings state
      setMeetings(prev => prev.map(m => {
        if (m.id === task.meetingId && m.analysis) {
          return {
            ...m,
            analysis: {
              ...m.analysis,
              actionItems: updatedDbActionItems
            }
          };
        }
        return m;
      }));
    } catch (error) {
      console.error(error);
      // Revert if API failed
      fetchTasksAndMeetings();
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.task.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.sourceMeeting.toLowerCase().includes(searchQuery.toLowerCase());
    
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
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-[#232B45] pb-6">
        <div>
          <h2 className="text-3xl font-extrabold font-display text-white mb-1">Tasks Register</h2>
          <p className="text-sm text-[#94A3B8]">Assign, track, and complete action items from all meetings.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#94A3B8]">
          <div className="w-8 h-8 rounded-full border-2 border-[#8083ff]/20 border-t-[#8083ff] animate-spin" />
          <p className="text-sm font-medium font-mono">Loading tasks register...</p>
        </div>
      ) : (
        <>
          {/* Stats Summary cards */}
          <div ref={statsRef} className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in fade-in duration-300">
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Total Tasks</p>
                <h3 className="text-2xl font-bold text-zinc-100 mt-1">
                  <span className="task-stat-counter" data-target={totalTasks}>0</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                <Link2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Pending Tasks</p>
                <h3 className="text-2xl font-bold text-fuchsia-400 mt-1">
                  <span className="task-stat-counter" data-target={pendingTasks}>0</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Completed Tasks</p>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                  <span className="task-stat-counter" data-target={completedTasks}>0</span>
                </h3>
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
                          {task.task}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500 font-semibold">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Due: {task.dueDate}
                          </span>
                          <span className="mx-1 text-zinc-800">•</span>
                          <Link 
                            href={`/dashboard/meeting/${task.meetingId}`}
                            className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-violet-400 hover:text-violet-300 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link2 className="w-3 h-3" /> {task.sourceMeeting}
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Priority Badge */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${
                        task.priority === 'High'
                          ? 'bg-rose-950/20 text-rose-400 border-rose-800/40'
                          : task.priority === 'Medium'
                            ? 'bg-amber-950/20 text-amber-400 border-amber-800/40'
                            : 'bg-zinc-800/20 text-zinc-400 border-zinc-800'
                      }`}>
                        {task.priority}
                      </span>

                      {/* Assignee Avatar */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-6 h-6 rounded-full bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 flex items-center justify-center font-bold text-[9px]">
                          {task.avatarText}
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
