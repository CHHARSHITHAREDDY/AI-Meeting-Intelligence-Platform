'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, Trash2, Calendar, Clock, Sparkles } from 'lucide-react';
import { Meeting } from '@/lib/db';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/meetings')
      .then((res) => res.json())
      .then((data) => {
        setMeetings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load meetings:', err);
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMeetings((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    return (
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.analysis?.summary && m.analysis.summary.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1d3a4d] border border-[#2a4a5e] p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-bold font-display text-[#f5e2de]">Meeting Recordings</h1>
          <p className="text-xs text-[#9f8f99] mt-1 font-mono">
            Searchable institutional repository of captured discussions, transcripts, and intelligence.
          </p>
        </div>
        <Link
          href="/dashboard/upload"
          className="px-5 py-2.5 rounded-xl text-xs font-bold btn-primary-cta inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#9f8f99]" />
          <span>Upload Recording</span>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#9f8f99]" />
          <input
            type="text"
            placeholder="Search meetings by title, summary, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1d3a4d] border border-[#2a4a5e] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#f5e2de] placeholder-[#9f8f99] focus:outline-none focus:border-[#6a2153] transition"
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="inline-flex items-center gap-2 px-3 py-2.5 bg-[#1d3a4d] border border-[#2a4a5e] rounded-xl text-xs text-[#9f8f99]">
            <Filter className="w-3.5 h-3.5 text-[#9f8f99]" />
            <span>Total: <strong className="text-white font-mono">{filteredMeetings.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Meetings Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#9f8f99] font-mono animate-pulse bg-[#1d3a4d] border border-[#2a4a5e] rounded-2xl">
          Loading meeting repository...
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="p-12 text-center bg-[#1d3a4d] border border-[#2a4a5e] rounded-2xl space-y-3">
          <p className="text-sm font-semibold text-[#f5e2de]">No meetings found</p>
          <p className="text-xs text-[#9f8f99]">Upload a recording or adjust your search filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMeetings.map((m) => (
            <Link
              key={m.id}
              href={`/dashboard/meeting/${m.id}`}
              className="group bg-[#1d3a4d] border border-[#2a4a5e] hover:border-[#6a2153] rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between hover:scale-[1.01] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#6a2153]/5 rounded-bl-full pointer-events-none group-hover:bg-[#6a2153]/10 transition-all" />

              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-bold text-sm text-[#f5e2de] group-hover:text-[#9f8f99] transition-colors line-clamp-1">
                    {m.title}
                  </h3>
                  <button
                    onClick={(e) => handleDelete(m.id, e)}
                    className="p-1.5 rounded-lg text-[#9f8f99] hover:text-red-400 hover:bg-red-400/10 transition cursor-pointer"
                    title="Delete meeting"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-[#9f8f99] line-clamp-3 leading-relaxed mb-4">
                  {m.analysis?.summary || 'Summary processing complete.'}
                </p>
              </div>

              <div className="pt-3 border-t border-[#2a4a5e] flex items-center justify-between text-[11px] font-mono text-[#9f8f99]">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#6a2153]" />
                  <span>{m.date || 'Today'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-[#9f8f99]" />
                  <span>{m.duration || '0m'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
