'use client';

import React, { useState } from 'react';
import { 
  Square, 
  CheckSquare2, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Link2,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

interface TaskItem {
  id: string;
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
  
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: 'task-1',
      task: 'Send draft proposal to finance team',
      assignee: 'Marcus Wright',
      avatarText: 'MW',
      dueDate: 'Today, EOD',
      sourceMeeting: 'Project Apollo Sync',
      priority: 'High',
      status: 'pending'
    },
    {
      id: 'task-2',
      task: 'Finalize Q3 marketing budget numbers',
      assignee: 'Sarah Chen',
      avatarText: 'SC',
      dueDate: 'Tomorrow',
      sourceMeeting: 'Project Apollo Sync',
      priority: 'High',
      status: 'pending'
    },
    {
      id: 'task-3',
      task: 'Check contract termination clauses',
      assignee: 'Jane Doe',
      avatarText: 'JD',
      dueDate: 'Oct 28, 2023',
      sourceMeeting: 'Budget Planning Q4',
      priority: 'Medium',
      status: 'completed'
    },
    {
      id: 'task-4',
      task: 'Draft Postgres migration database rollout plan',
      assignee: 'David Kim',
      avatarText: 'DK',
      dueDate: 'Nov 2, 2023',
      sourceMeeting: 'Q3 Architecture Sync',
      priority: 'Medium',
      status: 'pending'
    },
    {
      id: 'task-5',
      task: 'Contact vendor regarding API integration credentials',
      assignee: 'Marcus Wright',
      avatarText: 'MW',
      dueDate: 'Oct 30, 2023',
      sourceMeeting: 'Product Roadmap Review',
      priority: 'Low',
      status: 'completed'
    }
  ]);

  const toggleTaskStatus = (id: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        return {
          ...task,
          status: task.status === 'completed' ? 'pending' : 'completed'
        };
      }
      return task;
    }));
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

  // Calculate statistics
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

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-[#12172A] border border-[#232B45] rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider">Total Tasks</p>
            <h3 className="text-2xl font-bold text-[#F8FAFC] mt-1">{totalTasks}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#c0c1ff]/10 flex items-center justify-center text-[#c0c1ff]">
            <Link2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#12172A] border border-[#232B45] rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider">Pending Tasks</p>
            <h3 className="text-2xl font-bold text-[#ffb0cd] mt-1">{pendingTasks}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#ffb0cd]/10 flex items-center justify-center text-[#ffb0cd]">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-[#12172A] border border-[#232B45] rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider">Completed Tasks</p>
            <h3 className="text-2xl font-bold text-[#34D399] mt-1">{completedTasks}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#34D399]/10 flex items-center justify-center text-[#34D399]">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tab buttons */}
        <div className="flex bg-[#12172A] border border-[#232B45] rounded-lg p-1">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded font-semibold text-xs transition-all ${
              activeTab === 'all' 
                ? 'bg-[#262a34] text-[#5de6ff] shadow-[0_0_10px_rgba(93,230,255,0.1)]' 
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            All Tasks
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-1.5 rounded font-semibold text-xs transition-all ${
              activeTab === 'pending' 
                ? 'bg-[#262a34] text-[#5de6ff] shadow-[0_0_10px_rgba(93,230,255,0.1)]' 
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Pending
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-1.5 rounded font-semibold text-xs transition-all ${
              activeTab === 'completed' 
                ? 'bg-[#262a34] text-[#5de6ff] shadow-[0_0_10px_rgba(93,230,255,0.1)]' 
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Completed
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-3">
          <div className="relative w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
              <Search className="w-4 h-4" />
            </span>
            <input
              className="w-full bg-[#12172A] border border-[#232B45] rounded-lg pl-10 pr-4 py-2 text-xs text-[#F8FAFC] focus:border-[#5de6ff] focus:outline-none placeholder-[#94A3B8]/30"
              placeholder="Search tasks..."
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="bg-[#12172A] border border-[#232B45] rounded-lg px-4 py-2 flex items-center gap-2 text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#dfe2ef]/30 text-xs font-semibold transition">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Task List Grid */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-[#12172A] border border-[#232B45] rounded-xl p-12 text-center text-[#94A3B8]">
            <CheckSquare2 className="w-12 h-12 mx-auto text-[#232B45] mb-4" />
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
                    ? 'bg-[#12172A]/40 border-[#232B45] opacity-60' 
                    : 'bg-[#12172A] border-[#232B45] hover:border-[#5de6ff]/30 shadow-md shadow-black/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Custom Checkbox */}
                  <button className={`shrink-0 transition-colors ${isCompleted ? 'text-[#34D399]' : 'text-[#94A3B8]'}`}>
                    {isCompleted ? (
                      <CheckSquare2 className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>

                  <div className="space-y-1">
                    <p className={`text-sm font-semibold leading-relaxed transition-all ${
                      isCompleted ? 'line-through text-zinc-500' : 'text-[#F8FAFC]'
                    }`}>
                      {task.task}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#94A3B8] font-semibold">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Due: {task.dueDate}
                      </span>
                      <span className="mx-1 text-[#232B45]">•</span>
                      <span className="flex items-center gap-1 bg-[#1c1f29] border border-[#232B45] px-2 py-0.5 rounded text-[#c0c1ff]">
                        <Link2 className="w-3 h-3" /> {task.sourceMeeting}
                      </span>
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
                        : 'bg-zinc-800/20 text-zinc-400 border-[#232B45]'
                  }`}>
                    {task.priority}
                  </span>

                  {/* Assignee Avatar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-[#ffb0cd]/10 text-[#ffb0cd] border border-[#ffb0cd]/20 flex items-center justify-center font-bold text-[9px]">
                      {task.avatarText}
                    </div>
                    <span className="text-xs font-semibold text-[#dfe2ef] hidden sm:inline">{task.assignee}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
