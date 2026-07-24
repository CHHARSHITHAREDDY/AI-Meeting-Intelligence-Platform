'use client';

import React, { useState } from 'react';
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

interface DecisionItem {
  id: string;
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
  const [expandedRow, setExpandedRow] = useState<string | null>('migrate-db');

  const decisions: DecisionItem[] = [
    {
      id: 'migrate-db',
      decision: 'Migrate Core DB to Postgres',
      meetingName: 'Q3 Architecture Sync',
      date: 'Oct 24, 2023',
      owner: 'David K.',
      avatarText: 'DK',
      status: 'Approved',
      quote: 'David K: "Given the scaling issues with Mongo, we need a relational structure for the new module."',
      contextHtml: 'Sarah C: "Agreed. Let\'s <span class="highlight-text font-semibold">officially decide to migrate the core DB to Postgres</span>. David, you own the rollout."'
    },
    {
      id: 'delay-launch',
      decision: 'Delay Mobile App Launch',
      meetingName: 'Product Roadmap Review',
      date: 'Oct 22, 2023',
      owner: 'Elena L.',
      avatarText: 'EL',
      status: 'Pending',
      quote: 'Elena L: "We are still waiting on store credential approvals and key testing reports."',
      contextHtml: 'Sarah C: "Understood. Let\'s hold the mobile launch until we clear QA. Let\'s mark it as <span class="highlight-text font-semibold">pending mobile app launch delay</span> for now."'
    },
    {
      id: 'cancel-vendor',
      decision: 'Cancel Vendor Contract X',
      meetingName: 'Budget Planning Q4',
      date: 'Oct 15, 2023',
      owner: 'Marcus R.',
      avatarText: 'MR',
      status: 'Rejected',
      quote: 'Marcus R: "Contract X is running at a higher cost than our backup options."',
      contextHtml: 'Jane D: "Our legal ties prevent us from breaking Contract X without heavy penalties. We should reject this cancelation."'
    }
  ];

  const handleRowClick = (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(id);
    }
  };

  const filteredDecisions = decisions.filter(item => 
    item.decision.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.meetingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 border-b border-[#232B45] pb-6">
        <div>
          <h2 className="text-3xl font-extrabold font-display text-white mb-1">Decisions Register</h2>
          <p className="text-sm text-[#94A3B8]">Track and verify executive commitments.</p>
        </div>
        
        {/* View Toggle */}
        <div className="flex bg-[#12172A] border border-[#232B45] rounded-lg p-1 self-start sm:self-auto">
          <button 
            onClick={() => setActiveTab('table')}
            className={`px-4 py-1.5 rounded font-semibold text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'table' 
                ? 'bg-[#262a34] text-[#5de6ff] shadow-[0_0_10px_rgba(93,230,255,0.1)]' 
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            Table
          </button>
          <button 
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-1.5 rounded font-semibold text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'timeline' 
                ? 'bg-[#262a34] text-[#5de6ff] shadow-[0_0_10px_rgba(93,230,255,0.1)]' 
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            Timeline
          </button>
        </div>
      </header>

      {activeTab === 'table' ? (
        <>
          {/* Filters Area */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] flex items-center">
                <Search className="w-4 h-4" />
              </span>
              <input
                className="w-full bg-[#12172A] border border-[#232B45] rounded-lg pl-10 pr-4 py-2 text-xs text-[#F8FAFC] focus:border-[#5de6ff] focus:outline-none transition-colors placeholder-[#94A3B8]/30"
                placeholder="Search decisions..."
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

          {/* Table Container */}
          <div className="bg-[#12172A] border border-[#232B45] rounded-xl overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#1c1f29] border-b border-[#232B45] font-mono text-[10px] text-[#94A3B8] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Decision</th>
                  <th className="px-6 py-4 font-semibold">Source Meeting</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Owner</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-[#232B45]">
                {filteredDecisions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-[#94A3B8] italic">No decisions match search filters.</td>
                  </tr>
                ) : (
                  filteredDecisions.map((item) => {
                    const isExpanded = expandedRow === item.id;
                    return (
                      <React.Fragment key={item.id}>
                        {/* Table Row */}
                        <tr 
                          onClick={() => handleRowClick(item.id)}
                          className={`hover:bg-[#1c1f29]/40 transition-colors group cursor-pointer ${
                            isExpanded ? 'bg-[#181b25] border-l-2 border-l-[#5de6ff]' : ''
                          }`}
                        >
                          <td className="px-6 py-4 font-bold text-[#F8FAFC] flex items-center justify-between">
                            <span>{item.decision}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[#c0c1ff] hover:text-[#5de6ff] underline decoration-[#c0c1ff]/30 underline-offset-4 flex items-center gap-1.5">
                              {item.meetingName}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#94A3B8] font-medium">{item.date}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-full bg-[#5de6ff]/10 text-[#5de6ff] border border-[#5de6ff]/20 flex items-center justify-center font-bold text-[9px]">
                                {item.avatarText}
                              </div>
                              <span className="font-semibold text-[#dfe2ef]">{item.owner}</span>
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
                          <tr className="bg-[#0a0e17]/30">
                            <td className="p-0" colSpan={5}>
                              <div className="px-6 py-4 border-l-2 border-l-[#5de6ff]/40 animate-in fade-in slide-in-from-top-1 duration-300">
                                <div className="bg-[#12172A] rounded-lg border border-[#232B45] p-4 shadow-lg neon-underglow">
                                  <div className="flex items-center gap-2 mb-2 text-[#5de6ff]">
                                    <Award className="w-4 h-4" />
                                    <span className="font-mono text-[10px] text-[#94A3B8] uppercase tracking-wider">Transcript Context</span>
                                  </div>
                                  <div className="font-medium text-[#c7c4d7] leading-relaxed text-xs space-y-1">
                                    <p className="opacity-70">{item.quote}</p>
                                    <p dangerouslySetInnerHTML={{ __html: item.contextHtml }} />
                                  </div>
                                  <div className="mt-4 flex gap-2">
                                    <button className="text-[10px] bg-[#1c1f29] px-2.5 py-1.5 rounded border border-[#232B45] hover:border-[#5de6ff] text-[#94A3B8] hover:text-[#F8FAFC] transition flex items-center gap-1">
                                      <Play className="w-3 h-3 fill-current" /> Play snippet
                                    </button>
                                    <button className="text-[10px] bg-[#1c1f29] px-2.5 py-1.5 rounded border border-[#232B45] hover:border-[#5de6ff] text-[#94A3B8] hover:text-[#F8FAFC] transition flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" /> View thread
                                    </button>
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
        <div className="bg-[#12172A] border border-[#232B45] rounded-xl p-8 shadow-xl flex flex-col justify-center min-h-[300px]">
          <div className="relative w-full py-12">
            {/* Axis Line */}
            <div className="absolute left-0 right-0 h-[2px] bg-[#232B45] top-1/2 -translate-y-1/2"></div>
            
            {/* Timeline nodes */}
            <div className="w-full flex justify-between relative z-10">
              {/* Node 1 */}
              <div className="flex flex-col items-center gap-3 -mt-6">
                <div className="w-4 h-4 rounded-full bg-[#12172A] border-2 border-rose-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]"></div>
                <div className="text-center">
                  <span className="font-mono text-[10px] text-[#94A3B8] block">Oct 15</span>
                  <span className="text-[11px] font-bold text-[#F8FAFC] max-w-[120px] block truncate">Cancel Vendor Contract X</span>
                  <span className="text-[9px] text-rose-400">Rejected</span>
                </div>
              </div>

              {/* Node 2 */}
              <div className="flex flex-col items-center gap-3 -mt-6">
                <div className="w-4 h-4 rounded-full bg-[#12172A] border-2 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>
                <div className="text-center">
                  <span className="font-mono text-[10px] text-[#94A3B8] block">Oct 22</span>
                  <span className="text-[11px] font-bold text-[#F8FAFC] max-w-[120px] block truncate">Delay Mobile App Launch</span>
                  <span className="text-[9px] text-amber-400">Pending</span>
                </div>
              </div>

              {/* Node 3 - Active */}
              <div className="flex flex-col items-center gap-3 -mt-8">
                <div className="w-7 h-7 rounded-full bg-[#5de6ff]/10 border-2 border-[#5de6ff] shadow-[0_0_15px_rgba(93,230,255,0.6)] flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#5de6ff]"></div>
                </div>
                <div className="text-center">
                  <span className="font-mono text-[10px] text-[#5de6ff] font-bold block">Oct 24</span>
                  <span className="text-[12px] font-bold text-[#dfe2ef] max-w-[150px] block truncate">Migrate Core DB to Postgres</span>
                  <span className="text-[10px] text-emerald-400 font-bold">Approved</span>
                </div>
              </div>

              {/* Node 4 */}
              <div className="flex flex-col items-center gap-3 -mt-6">
                <div className="w-4 h-4 rounded-full bg-[#12172A] border-2 border-[#31353f]"></div>
                <div className="text-center">
                  <span className="font-mono text-[10px] text-[#94A3B8] block">Future</span>
                  <span className="text-[11px] text-zinc-500 block">Upcoming Decisions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conceptual Timeline Preview (visible at bottom of table only) */}
      {activeTab === 'table' && (
        <div className="mt-8 relative pt-6 border-t border-[#232B45]">
          <h3 className="font-bold font-display text-[15px] text-[#dfe2ef] mb-6 flex items-center gap-2 opacity-50">
            <GitFork className="w-4.5 h-4.5" /> Timeline Preview
          </h3>
          
          <div className="w-full h-32 bg-[#12172A] border border-[#232B45] rounded-xl relative overflow-hidden flex items-center px-8 opacity-60">
            {/* Axis Line */}
            <div className="absolute left-0 right-0 h-[1px] bg-[#232B45] top-1/2"></div>
            
            <div className="w-full flex justify-between relative z-10">
              <div className="flex flex-col items-center gap-2 -mt-4 cursor-not-allowed">
                <div className="w-3.5 h-3.5 rounded-full bg-[#12172A] border-2 border-rose-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]"></div>
                <span className="font-mono text-[9px] text-[#94A3B8]">Oct 15</span>
              </div>
              <div className="flex flex-col items-center gap-2 -mt-4 cursor-not-allowed">
                <div className="w-3.5 h-3.5 rounded-full bg-[#12172A] border-2 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>
                <span className="font-mono text-[9px] text-[#94A3B8]">Oct 22</span>
              </div>
              <div className="flex flex-col items-center gap-2 mt-4 cursor-not-allowed">
                <span className="font-mono text-[9px] text-[#94A3B8]">Oct 24</span>
                <div className="w-5 h-5 rounded-full bg-[#5de6ff]/20 border-2 border-[#5de6ff] shadow-[0_0_15px_rgba(93,230,255,0.6)] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5de6ff]"></div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 -mt-4 cursor-not-allowed">
                <div className="w-3.5 h-3.5 rounded-full bg-[#12172A] border-2 border-[#31353f]"></div>
                <span className="font-mono text-[9px] text-[#94A3B8]">Future</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
