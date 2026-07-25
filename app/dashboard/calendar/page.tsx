'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, ChevronLeft, ChevronRight, X, Clock, Users, FileText,
  CheckCircle2, AlertTriangle, Mic, Sparkles, ListChecks
} from 'lucide-react';
import { Meeting, Task, Project } from '@/lib/db';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function meetingMoment(meeting: Meeting): Date {
  return new Date(meeting.scheduledAt || meeting.date);
}

function getMonthMatrix(anchor: Date): Date[][] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const weeks: Date[][] = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function getWeekDays(anchor: Date): Date[] {
  const start = addDays(anchor, -anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

interface MeetingBadge {
  label: string;
  tone: 'good' | 'warn' | 'neutral' | 'bad';
}

function getMeetingBadges(meeting: Meeting): MeetingBadge[] {
  const badges: MeetingBadge[] = [];
  const now = new Date();

  if (meeting.status === 'scheduled') {
    const isOverdue = meetingMoment(meeting) < now;
    badges.push(isOverdue ? { label: 'Overdue', tone: 'bad' } : { label: 'Scheduled', tone: 'neutral' });
  }
  if (meeting.status === 'live') badges.push({ label: 'Live Now', tone: 'warn' });
  if (meeting.status === 'processing') badges.push({ label: 'Processing', tone: 'warn' });
  if (meeting.status === 'failed') badges.push({ label: 'Failed', tone: 'bad' });
  if (meeting.status === 'cancelled') badges.push({ label: 'Cancelled', tone: 'bad' });
  if (meeting.transcript) badges.push({ label: 'Transcript Ready', tone: 'good' });
  else if (meeting.status !== 'scheduled' && meeting.status !== 'cancelled') badges.push({ label: 'Recording Pending', tone: 'neutral' });
  if (meeting.analysis) badges.push({ label: 'Summary Ready', tone: 'good' });

  return badges;
}

const toneClasses: Record<MeetingBadge['tone'], string> = {
  good: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  warn: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
  bad: 'bg-rose-400/10 text-rose-400 border-rose-400/30',
  neutral: 'bg-[#6366F1]/10 text-[#c0c1ff] border-[#6366F1]/30',
};

const priorityClasses: Record<string, string> = {
  high: 'bg-rose-400/15 text-rose-400',
  medium: 'bg-amber-400/15 text-amber-400',
  low: 'bg-[#94A3B8]/15 text-[#94A3B8]',
};

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Task[]>([]);
  const [todaysMeetings, setTodaysMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'month') {
      const weeks = getMonthMatrix(anchorDate);
      return { rangeStart: weeks[0][0], rangeEnd: addDays(weeks[5][6], 1) };
    }
    if (viewMode === 'week') {
      const days = getWeekDays(anchorDate);
      return { rangeStart: days[0], rangeEnd: addDays(days[6], 1) };
    }
    if (viewMode === 'day') {
      return { rangeStart: anchorDate, rangeEnd: addDays(anchorDate, 1) };
    }
    // agenda: rolling 30-day window from the anchor
    return { rangeStart: anchorDate, rangeEnd: addDays(anchorDate, 30) };
  }, [viewMode, anchorDate]);

  const loadRangeData = useCallback(async () => {
    setLoading(true);
    try {
      const [meetingsRes, tasksRes] = await Promise.all([
        fetch(`/api/meetings?start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`),
        fetch(`/api/tasks?dueAfter=${toISODate(rangeStart)}&dueBefore=${toISODate(rangeEnd)}`),
      ]);
      setMeetings(meetingsRes.ok ? await meetingsRes.json() : []);
      setTasks(tasksRes.ok ? await tasksRes.json() : []);
    } catch (err) {
      console.error('Failed to load calendar range:', err);
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd]);

  const loadSidebarData = useCallback(async () => {
    try {
      const today = toISODate(new Date());
      const [todayMeetingsRes, overdueRes, deadlinesRes] = await Promise.all([
        fetch(`/api/meetings?start=${startOfDay(new Date()).toISOString()}&end=${addDays(startOfDay(new Date()), 1).toISOString()}`),
        fetch(`/api/tasks?status=pending&dueBefore=${today}`),
        fetch(`/api/tasks?status=pending&dueAfter=${today}`),
      ]);
      setTodaysMeetings(todayMeetingsRes.ok ? await todayMeetingsRes.json() : []);
      setOverdueTasks(overdueRes.ok ? await overdueRes.json() : []);
      const deadlines = deadlinesRes.ok ? await deadlinesRes.json() : [];
      setUpcomingDeadlines(deadlines.slice(0, 8));
    } catch (err) {
      console.error('Failed to load calendar sidebar data:', err);
    }
  }, []);

  useEffect(() => { loadRangeData(); }, [loadRangeData]);
  useEffect(() => { loadSidebarData(); }, [loadSidebarData]);
  useEffect(() => {
    fetch('/api/projects').then(r => r.ok ? r.json() : []).then(setProjects).catch(() => setProjects([]));
  }, []);

  const tasksByMeeting = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(t => {
      if (!t.meetingId) return;
      (map[t.meetingId] ||= []).push(t);
    });
    return map;
  }, [tasks]);

  const meetingsByDay = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    meetings.forEach(m => {
      const key = toISODate(meetingMoment(m));
      (map[key] ||= []).push(m);
    });
    Object.values(map).forEach(list => list.sort((a, b) => meetingMoment(a).getTime() - meetingMoment(b).getTime()));
    return map;
  }, [meetings]);

  const periodLabel = useMemo(() => {
    if (viewMode === 'month') return anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (viewMode === 'week') {
      const days = getWeekDays(anchorDate);
      return `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (viewMode === 'day') return anchorDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return `Next 30 days from ${anchorDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }, [viewMode, anchorDate]);

  const navigate = (direction: 1 | -1) => {
    if (viewMode === 'month') {
      setAnchorDate(d => new Date(d.getFullYear(), d.getMonth() + direction, 1));
    } else if (viewMode === 'week') {
      setAnchorDate(d => addDays(d, 7 * direction));
    } else if (viewMode === 'day') {
      setAnchorDate(d => addDays(d, direction));
    } else {
      setAnchorDate(d => addDays(d, 30 * direction));
    }
  };

  const renderEventCard = (meeting: Meeting, compact = false) => {
    const badges = getMeetingBadges(meeting);
    const relatedTasks = tasksByMeeting[meeting.id] || [];
    const decisionCount = meeting.analysis?.decisions?.length || 0;
    const actionItemCount = meeting.analysis?.actionItems?.length || 0;

    return (
      <Link
        key={meeting.id}
        href={`/dashboard/meeting/${meeting.id}`}
        className={`block bg-[#0f131c] border border-[#232B45] hover:border-[#6366F1] rounded-xl p-3 transition-colors ${compact ? '' : 'space-y-2'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-bold text-[#F8FAFC] line-clamp-1">{meeting.title}</p>
          {meeting.priority && (
            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${priorityClasses[meeting.priority]}`}>
              {meeting.priority}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#94A3B8] font-mono">
          <Clock className="w-3 h-3" />
          <span>{meetingMoment(meeting).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
          {meeting.durationMinutes && <span>· {meeting.durationMinutes}m</span>}
          {meeting.participants && meeting.participants.length > 0 && (
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{meeting.participants.length}</span>
          )}
        </div>
        {!compact && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {badges.map((b, i) => (
              <span key={i} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${toneClasses[b.tone]}`}>{b.label}</span>
            ))}
          </div>
        )}
        {!compact && (decisionCount > 0 || actionItemCount > 0 || relatedTasks.length > 0) && (
          <div className="flex items-center gap-3 text-[10px] text-[#94A3B8] font-mono pt-1 border-t border-[#232B45]">
            {decisionCount > 0 && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#5de6ff]" />{decisionCount}</span>}
            {actionItemCount > 0 && <span className="flex items-center gap-1"><ListChecks className="w-3 h-3 text-[#6366F1]" />{actionItemCount}</span>}
            {relatedTasks.length > 0 && <span>{relatedTasks.filter(t => t.status === 'pending').length}/{relatedTasks.length} tasks open</span>}
          </div>
        )}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#12172A] border border-[#232B45] p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-bold font-display text-[#F8FAFC]">Meeting Calendar</h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-mono">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-[#0f131c] border border-[#232B45] rounded-xl p-1">
            {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider rounded-lg transition cursor-pointer ${
                  viewMode === mode ? 'bg-[#6366F1] text-white' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg border border-[#232B45] text-[#94A3B8] hover:text-white hover:border-[#6366F1] transition cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAnchorDate(startOfDay(new Date()))}
              className="px-3 py-2 rounded-lg border border-[#232B45] text-[11px] font-mono text-[#94A3B8] hover:text-white hover:border-[#6366F1] transition cursor-pointer"
            >
              Today
            </button>
            <button onClick={() => navigate(1)} className="p-2 rounded-lg border border-[#232B45] text-[#94A3B8] hover:text-white hover:border-[#6366F1] transition cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowNewEvent(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold btn-primary-cta inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Meeting Event</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main calendar area */}
        <div className="xl:col-span-3 bg-[#12172A] border border-[#232B45] rounded-2xl p-5 shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#94A3B8] font-mono animate-pulse">Loading calendar...</div>
          ) : viewMode === 'month' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-2 text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] px-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
              </div>
              {getMonthMatrix(anchorDate).map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-2">
                  {week.map(day => {
                    const dayMeetings = meetingsByDay[toISODate(day)] || [];
                    const inMonth = day.getMonth() === anchorDate.getMonth();
                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[100px] rounded-xl border p-2 space-y-1 ${
                          isSameDay(day, new Date()) ? 'border-[#6366F1] bg-[#6366F1]/5' : 'border-[#232B45] bg-[#0f131c]/40'
                        } ${inMonth ? '' : 'opacity-40'}`}
                      >
                        <p className="text-[10px] font-mono text-[#94A3B8]">{day.getDate()}</p>
                        <div className="space-y-1">
                          {dayMeetings.slice(0, 3).map(m => (
                            <Link
                              key={m.id}
                              href={`/dashboard/meeting/${m.id}`}
                              className="block text-[9px] px-1.5 py-1 rounded bg-[#181b25] border border-[#232B45] text-[#c0c1ff] hover:border-[#6366F1] line-clamp-1"
                            >
                              {m.title}
                            </Link>
                          ))}
                          {dayMeetings.length > 3 && (
                            <p className="text-[9px] text-[#94A3B8] font-mono">+{dayMeetings.length - 3} more</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : viewMode === 'week' ? (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {getWeekDays(anchorDate).map(day => (
                <div key={day.toISOString()} className={`rounded-xl border p-3 space-y-2 ${isSameDay(day, new Date()) ? 'border-[#6366F1] bg-[#6366F1]/5' : 'border-[#232B45]'}`}>
                  <p className="text-[10px] font-mono uppercase text-[#94A3B8]">{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</p>
                  <div className="space-y-2">
                    {(meetingsByDay[toISODate(day)] || []).map(m => renderEventCard(m, true))}
                    {(meetingsByDay[toISODate(day)] || []).length === 0 && <p className="text-[10px] text-[#94A3B8] font-mono">No meetings</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'day' ? (
            <div className="space-y-3">
              {(meetingsByDay[toISODate(anchorDate)] || []).length === 0 ? (
                <p className="text-xs text-[#94A3B8] font-mono p-8 text-center">No meetings scheduled for this day.</p>
              ) : (
                (meetingsByDay[toISODate(anchorDate)] || []).map(m => renderEventCard(m))
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {Object.keys(meetingsByDay).length === 0 ? (
                <p className="text-xs text-[#94A3B8] font-mono p-8 text-center">Nothing on the calendar in this window.</p>
              ) : (
                Object.entries(meetingsByDay)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dateKey, dayMeetings]) => (
                    <div key={dateKey}>
                      <p className="text-[11px] font-mono uppercase tracking-wider text-[#5de6ff] mb-2">
                        {new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                      <div className="space-y-2">{dayMeetings.map(m => renderEventCard(m))}</div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          <div className="bg-[#12172A] border border-[#232B45] rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-[#F8FAFC] flex items-center gap-2"><Mic className="w-3.5 h-3.5 text-[#6366F1]" />Today's Meetings</h3>
            {todaysMeetings.length === 0 ? (
              <p className="text-[11px] text-[#94A3B8] font-mono">Nothing scheduled today.</p>
            ) : (
              <div className="space-y-2">{todaysMeetings.map(m => renderEventCard(m, true))}</div>
            )}
          </div>

          <div className="bg-[#12172A] border border-[#232B45] rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-[#F8FAFC] flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-rose-400" />Overdue Tasks</h3>
            {overdueTasks.length === 0 ? (
              <p className="text-[11px] text-[#94A3B8] font-mono">Nothing overdue. 🎉</p>
            ) : (
              <div className="space-y-2">
                {overdueTasks.map(t => (
                  <div key={t.id} className="text-[11px] bg-rose-400/5 border border-rose-400/20 rounded-lg p-2">
                    <p className="text-[#F8FAFC] font-semibold line-clamp-1">{t.title}</p>
                    <p className="text-rose-400 font-mono text-[10px]">Due {t.dueDate} · {t.assignee}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#12172A] border border-[#232B45] rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-[#F8FAFC] flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-[#5de6ff]" />Upcoming Deadlines</h3>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-[11px] text-[#94A3B8] font-mono">No upcoming deadlines.</p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map(t => (
                  <div key={t.id} className="text-[11px] bg-[#0f131c] border border-[#232B45] rounded-lg p-2">
                    <p className="text-[#F8FAFC] font-semibold line-clamp-1">{t.title}</p>
                    <p className="text-[#94A3B8] font-mono text-[10px]">Due {t.dueDate} · {t.assignee}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showNewEvent && (
        <NewEventModal
          projects={projects}
          onClose={() => setShowNewEvent(false)}
          onCreated={() => { setShowNewEvent(false); loadRangeData(); loadSidebarData(); }}
        />
      )}
    </div>
  );
}

function NewEventModal({ projects, onClose, onCreated }: { projects: Project[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [time, setTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [participants, setParticipants] = useState('');
  const [agenda, setAgenda] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [projectId, setProjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !time) return;
    setSubmitting(true);
    setError('');
    try {
      const scheduledAt = new Date(`${date}T${time}`);
      if (isNaN(scheduledAt.getTime())) throw new Error('Invalid date/time');

      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes,
          participants: participants.split(',').map(p => p.trim()).filter(Boolean),
          agenda: agenda.trim() || undefined,
          priority,
          projectId: projectId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to schedule meeting');
      }
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule meeting');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#12172A] border border-[#232B45] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#6366F1]" />New Meeting Event</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">Title</label>
            <input
              type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint Planning"
              className="w-full bg-[#0a0e17] border border-[#232B45] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#6366F1] transition"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">Date</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#0a0e17] border border-[#232B45] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#6366F1] transition" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">Time</label>
              <input type="time" required value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full bg-[#0a0e17] border border-[#232B45] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#6366F1] transition" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">Duration (min)</label>
              <input type="number" min={5} step={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full bg-[#0a0e17] border border-[#232B45] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#6366F1] transition" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-[#0a0e17] border border-[#232B45] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#6366F1] transition">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">Participants (comma-separated)</label>
            <input type="text" value={participants} onChange={(e) => setParticipants(e.target.value)}
              placeholder="e.g. Alex, Sam, Priya"
              className="w-full bg-[#0a0e17] border border-[#232B45] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#6366F1] transition" />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">Agenda (optional)</label>
            <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3}
              placeholder="What will this meeting cover?"
              className="w-full bg-[#0a0e17] border border-[#232B45] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#6366F1] transition resize-none" />
          </div>
          {projects.length > 0 && (
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">Project (optional)</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-[#0a0e17] border border-[#232B45] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#6366F1] transition">
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <button type="submit" disabled={submitting || !title.trim()}
            className="w-full py-2.5 rounded-xl text-xs font-bold btn-primary-cta disabled:opacity-50 cursor-pointer">
            {submitting ? 'Scheduling...' : 'Schedule Meeting'}
          </button>
        </form>
      </div>
    </div>
  );
}
