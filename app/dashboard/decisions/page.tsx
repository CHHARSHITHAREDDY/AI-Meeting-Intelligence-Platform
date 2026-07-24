'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TableProperties, 
  GitFork, 
  Search, 
  Filter, 
  ExternalLink, 
  Play, 
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Award
} from 'lucide-react';
import { Meeting } from '@/lib/db';

interface DecisionItem {
  id: string;
  meetingId: string;
  decision: string;
  meetingName: string;
  date: string;
  owner: string;
  avatarText: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  quote: string;
  contextHtml: string;
}

export default function DecisionsPage() {
  const [activeTab, setActiveTab] = useState<'table' | 'timeline'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDecisions = async () => {
      try {
        const response = await fetch('/api/meetings');
        if (response.ok) {
          const meetings: Meeting[] = await response.json();
          const extracted: DecisionItem[] = [];

          meetings.forEach(meeting => {
            if (meeting.status === 'completed' && meeting.analysis?.decisions) {
              const formattedDate = new Date(meeting.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              meeting.analysis.decisions.forEach(d => {
                const owner = d.decider || 'Team';
                
                // Get initials
                const parts = owner.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/);
                let avatarText = 'TM';
                if (parts.length >= 2) {
                  avatarText = (parts[0][0] + parts[1][0]).toUpperCase();
                } else if (parts.length === 1 && parts[0]) {
                  avatarText = parts[0].substring(0, 2).toUpperCase();
                }

                // Decide status based on keywords
                let status: 'Approved' | 'Pending' | 'Rejected' = 'Approved';
                const lowerDecision = d.decision.toLowerCase();
                if (
                  lowerDecision.includes('delay') || 
                  lowerDecision.includes('postpone') || 
                  lowerDecision.includes('hold') || 
                  lowerDecision.includes('pending')
                ) {
                  status = 'Pending';
                } else if (
                  lowerDecision.includes('cancel') || 
                  lowerDecision.includes('reject') || 
                  lowerDecision.includes('remove') || 
                  lowerDecision.includes('abort')
                ) {
                  status = 'Rejected';
                }

                // Highlight decision keyword inside context
                let contextHtml = d.context || 'Aligned during meeting sync.';
                const dText = d.decision.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex
                const regex = new RegExp(`(${dText})`, 'gi');
                if (regex.test(contextHtml)) {
                  contextHtml = contextHtml.replace(regex, '<span class="highlight-text font-semibold text-[#5de6ff]">$1</span>');
                } else {
                  contextHtml = `<span class="highlight-text font-semibold text-[#5de6ff]">${d.decision}</span>. ${contextHtml}`;
                }

                extracted.push({
                  id: `${meeting.id}-${d.id}`,
                  meetingId: meeting.id,
                  decision: d.decision,
                  meetingName: meeting.title,
                  date: formattedDate,
                  owner: owner,
                  avatarText: avatarText,
                  status: status,
                  quote: `${owner}: "${d.decision}"`,
                  contextHtml: contextHtml
                });
              });
            }
          });

          setDecisions(extracted);
          if (extracted.length > 0) {
            setExpandedRow(extracted[0].id); // Expand first row by default
          }
        }
      } catch (error) {
        console.error('Failed to fetch decisions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDecisions();
  }, []);

  const handleRowClick = (id: string) => {
    setExpandedRow(prev => prev === id ? null : id);
  };

  const filteredDecisions = decisions.filter(item => 
    item.decision.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.meetingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 border-b border-zinc-800 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold font-display text-white mb-1">Decisions Register</h2>
          <p className="text-sm text-zinc-400">Track and verify executive commitments.</p>
        </div>
        
        {/* View Toggle */}
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 self-start sm:self-auto">
          <button 
            onClick={() => setActiveTab('table')}
            className={`px-4 py-1.5 rounded font-semibold text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'table' 
                ? 'bg-zinc-800 text-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.15)]' 
                : 'text-zinc-500 hover:text-zinc-100'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            Table
          </button>
          <button 
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-1.5 rounded font-semibold text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'timeline' 
                ? 'bg-zinc-800 text-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.15)]' 
                : 'text-zinc-500 hover:text-zinc-100'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            Timeline
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#94A3B8]">
          <div className="w-8 h-8 rounded-full border-2 border-[#8083ff]/20 border-t-[#8083ff] animate-spin" />
          <p className="text-sm font-medium font-mono">Loading decisions...</p>
        </div>
      ) : activeTab === 'table' ? (
        <>
          {/* Filters Area */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 flex items-center">
                <Search className="w-4 h-4" />
              </span>
              <input
                className="w-full bg-zinc-900/40 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none transition-colors placeholder-zinc-650"
                placeholder="Search decisions..."
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-zinc-900 border-b border-zinc-800 font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Decision</th>
                  <th className="px-6 py-4 font-semibold">Source Meeting</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Owner</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-zinc-800">
                {filteredDecisions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 italic">No decisions match search filters.</td>
                  </tr>
                ) : (
                  filteredDecisions.map((item) => {
                    const isExpanded = expandedRow === item.id;
                    return (
                      <React.Fragment key={item.id}>
                        {/* Table Row */}
                        <tr 
                          onClick={() => handleRowClick(item.id)}
                          className={`hover:bg-zinc-900/30 transition-colors group cursor-pointer ${
                            isExpanded ? 'bg-zinc-950 border-l-2 border-l-violet-500' : ''
                          }`}
                        >
                          <td className="px-6 py-4 font-bold text-zinc-100 flex items-center justify-between">
                            <span>{item.decision}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Link 
                              href={`/dashboard/meeting/${item.meetingId}`}
                              className="text-violet-400 hover:text-violet-300 underline decoration-violet-500/30 underline-offset-4 flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.meetingName}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-zinc-500 font-medium">{item.date}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center font-bold text-[9px]">
                                {item.avatarText}
                              </div>
                              <span className="font-semibold text-zinc-200">{item.owner}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              item.status === 'Approved'
                                ? 'bg-emerald-950/20 text-emerald-400 border-emerald-800/40 shadow-[0_0_8px_rgba(52,211,153,0.1)]'
                                : item.status === 'Pending'
                                  ? 'bg-amber-950/20 text-amber-400 border-amber-800/40 shadow-[0_0_8px_rgba(251,191,36,0.1)]'
                                  : 'bg-rose-950/20 text-rose-400 border-rose-800/40 shadow-[0_0_8px_rgba(248,113,113,0.1)]'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                        
                        {/* Expanded Row Content */}
                        {isExpanded && (
                          <tr className="bg-zinc-950/20">
                            <td className="p-0" colSpan={5}>
                              <div className="px-6 py-4 border-l-2 border-l-violet-500/40 animate-in fade-in slide-in-from-top-1 duration-300">
                                <div className="bg-zinc-900/40 rounded-lg border border-zinc-800 p-4 shadow-lg">
                                  <div className="flex items-center gap-2 mb-2 text-violet-400">
                                    <Award className="w-4.5 h-4.5" />
                                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">Transcript Context</span>
                                  </div>
                                  <div className="font-medium text-zinc-400 leading-relaxed text-xs space-y-1">
                                    <p className="opacity-70 italic">{item.quote}</p>
                                    <p dangerouslySetInnerHTML={{ __html: item.contextHtml }} />
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Timeline View */
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-8 shadow-xl flex flex-col justify-center min-h-[300px]">
          {decisions.length === 0 ? (
            <p className="text-zinc-500 text-center italic">No decisions logged yet.</p>
          ) : (
            <div className="relative w-full py-12">
              {/* Axis Line */}
              <div className="absolute left-0 right-0 h-[2px] bg-zinc-800 top-1/2 -translate-y-1/2"></div>
              
              {/* Timeline nodes */}
              <div className="w-full flex justify-between relative z-10 overflow-x-auto gap-12 px-4 scrollbar-none">
                {decisions.slice(0, 4).map((dec, i) => {
                  const colors = {
                    Approved: 'border-emerald-405 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)]',
                    Pending: 'border-amber-405 text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]',
                    Rejected: 'border-rose-405 text-rose-400 shadow-[0_0_10px_rgba(248,113,113,0.3)]'
                  };

                  return (
                    <div key={dec.id} className="flex flex-col items-center gap-3 -mt-6 min-w-[120px] max-w-[180px] shrink-0">
                      <div className={`w-4 h-4 rounded-full bg-zinc-950 border-2 ${colors[dec.status]}`}></div>
                      <div className="text-center">
                        <span className="font-mono text-[9px] text-zinc-500 block">{dec.date}</span>
                        <span className="text-[11px] font-bold text-zinc-100 block truncate" title={dec.decision}>
                          {dec.decision}
                        </span>
                        <span className="text-[9px] block font-semibold">{dec.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conceptual Timeline Preview (visible at bottom of table only) */}
      {activeTab === 'table' && decisions.length > 0 && (
        <div className="mt-8 relative pt-6 border-t border-zinc-800">
          <h3 className="font-bold font-display text-[15px] text-zinc-200 mb-6 flex items-center gap-2 opacity-50">
            <GitFork className="w-4.5 h-4.5" /> Timeline Preview
          </h3>
          
          <div className="w-full h-32 bg-zinc-900/40 border border-zinc-800 rounded-xl relative overflow-hidden flex items-center px-8 opacity-60">
            {/* Axis Line */}
            <div className="absolute left-0 right-0 h-[1px] bg-zinc-800 top-1/2"></div>
            
            <div className="w-full flex justify-between relative z-10">
              {decisions.slice(0, 4).map((dec) => {
                const colors = {
                  Approved: 'border-emerald-405 shadow-[0_0_10px_rgba(52,211,153,0.3)]',
                  Pending: 'border-amber-405 shadow-[0_0_10px_rgba(251,191,36,0.3)]',
                  Rejected: 'border-rose-405 shadow-[0_0_10px_rgba(248,113,113,0.3)]'
                };

                return (
                  <div key={dec.id} className="flex flex-col items-center gap-2 -mt-4">
                    <div className={`w-3.5 h-3.5 rounded-full bg-zinc-950 border-2 ${colors[dec.status]}`}></div>
                    <span className="font-mono text-[9px] text-zinc-500">{dec.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
