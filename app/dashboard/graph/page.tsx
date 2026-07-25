'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Network, 
  HelpCircle, 
  User, 
  Award, 
  ClipboardList, 
  AlertTriangle,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { Meeting } from '@/lib/db';

interface GraphNode {
  id: string;
  label: string;
  type: 'meeting' | 'person' | 'decision' | 'task' | 'risk';
  x: number;
  y: number;
  radius: number;
  color: string;
  description: string;
  meta: string;
  meetingId?: string;
}

interface GraphLink {
  source: string;
  target: string;
  id: string;
}

export default function KnowledgeGraphPage() {
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'meeting' | 'person' | 'decision' | 'task' | 'risk'>('all');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const graphSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const generateGraph = async () => {
      try {
        const response = await fetch('/api/meetings');
        if (!response.ok) throw new Error('Failed to load meetings');
        const meetings: Meeting[] = await response.json();
        
        const completedMeetings = meetings.filter(m => m.status === 'completed');
        if (completedMeetings.length === 0) {
          setLoading(false);
          return;
        }

        const center = { x: 250, y: 200 };
        const tempNodes: GraphNode[] = [];
        const tempLinks: GraphLink[] = [];
        let linkCounter = 0;

        // 1. Identify all unique people across all meetings
        const uniquePeopleSet = new Set<string>();
        completedMeetings.forEach(m => {
          if (m.analysis) {
            m.analysis.actionItems?.forEach(a => {
              if (a.assignee) uniquePeopleSet.add(a.assignee);
            });
            m.analysis.decisions?.forEach(d => {
              if (d.decider) uniquePeopleSet.add(d.decider);
            });
          }
        });
        const peopleList = Array.from(uniquePeopleSet);

        // 2. Position People on an outer circle (radius = 175)
        const rPeople = 175;
        peopleList.forEach((person, idx) => {
          const angle = (idx * 2 * Math.PI) / peopleList.length;
          const x = center.x + rPeople * Math.cos(angle);
          const y = center.y + rPeople * Math.sin(angle);
          
          tempNodes.push({
            id: `person-${person.toLowerCase().replace(/\s+/g, '-')}`,
            label: person,
            type: 'person',
            x,
            y,
            radius: 16,
            color: '#9f8f99', // cyan accent
            description: `Active stakeholder participating in decisions and taking ownership of actions.`,
            meta: `Stakeholder • Active`
          });
        });

        // 3. Position Meetings on an inner circle (radius = 65)
        const rMeetings = 65;
        completedMeetings.forEach((meeting, mIdx) => {
          const mAngle = (mIdx * 2 * Math.PI) / completedMeetings.length;
          const mx = center.x + rMeetings * Math.cos(mAngle);
          const my = center.y + rMeetings * Math.sin(mAngle);
          const mNodeId = `meeting-${meeting.id}`;

          tempNodes.push({
            id: mNodeId,
            label: meeting.title,
            type: 'meeting',
            x: mx,
            y: my,
            radius: 28,
            color: '#6a2153', // primary violet
            description: meeting.analysis?.summary || 'No summary available.',
            meta: `${meeting.duration} sync • ${new Date(meeting.date).toLocaleDateString()}`,
            meetingId: meeting.id
          });

          // 4. Position details (decisions, tasks, risks) orbiting this meeting node
          const orbitItems: { type: 'decision' | 'task' | 'risk'; label: string; id: string; description: string; meta: string; ownerName?: string }[] = [];

          if (meeting.analysis) {
            meeting.analysis.decisions?.forEach(d => {
              orbitItems.push({
                type: 'decision',
                label: d.decision,
                id: `decision-${meeting.id}-${d.id}`,
                description: d.context || 'Decision reached during standup alignment.',
                meta: `Decided by ${d.decider || 'Team'}`,
                ownerName: d.decider
              });
            });

            meeting.analysis.actionItems?.forEach(a => {
              orbitItems.push({
                type: 'task',
                label: a.task,
                id: `task-${meeting.id}-${a.id}`,
                description: `Action item assigned to ${a.assignee || 'Team'}. Status: ${a.status.toUpperCase()}`,
                meta: `Owner: ${a.assignee || 'Team'} • Due: ${a.dueDate || 'ASAP'}`,
                ownerName: a.assignee
              });
            });

            meeting.analysis.risks?.forEach(r => {
              orbitItems.push({
                type: 'risk',
                label: r.risk,
                id: `risk-${meeting.id}-${r.id}`,
                description: `Mitigation: ${r.mitigation || 'No mitigation listed.'}`,
                meta: `Impact: ${r.impact.toUpperCase()}`
              });
            });
          }

          // Distribute orbiting items around the meeting node (radius = 80)
          const rOrbit = 80;
          orbitItems.forEach((item, oIdx) => {
            const oAngle = mAngle + ((oIdx + 1) * 2 * Math.PI) / (orbitItems.length + 1) - Math.PI / 4;
            const ox = mx + rOrbit * Math.cos(oAngle);
            const oy = my + rOrbit * Math.sin(oAngle);

            const colors = {
              decision: '#34d399', // emerald
              task: '#f5e2de', // pink tertiary
              risk: '#ffb4ab' // coral warning
            };

            const radiuses = {
              decision: 20,
              task: 18,
              risk: 18
            };

            tempNodes.push({
              id: item.id,
              label: item.label,
              type: item.type,
              x: ox,
              y: oy,
              radius: radiuses[item.type],
              color: colors[item.type],
              description: item.description,
              meta: item.meta,
              meetingId: meeting.id
            });

            // Link orbiting item to meeting
            tempLinks.push({
              source: mNodeId,
              target: item.id,
              id: `link-${mNodeId}-${item.id}`
            });

            // Link orbiting item to person if owner matches
            if (item.ownerName) {
              const personNodeId = `person-${item.ownerName.toLowerCase().replace(/\s+/g, '-')}`;
              if (tempNodes.some(n => n.id === personNodeId)) {
                tempLinks.push({
                  source: personNodeId,
                  target: item.id,
                  id: `link-${personNodeId}-${item.id}`
                });
              }
            }
          });
        });

        setNodes(tempNodes);
        setLinks(tempLinks);
        
        // Select first meeting node by default
        if (completedMeetings.length > 0) {
          setSelectedNode(`meeting-${completedMeetings[0].id}`);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    generateGraph();
  }, []);

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
  };

  const activeNode = nodes.find(n => n.id === selectedNode) || null;

  // Helper to determine if node is connected to selected node
  const isNodeConnected = (nodeId: string) => {
    if (!selectedNode) return true;
    if (selectedNode === nodeId) return true;
    return links.some(link => 
      (link.source === selectedNode && link.target === nodeId) ||
      (link.target === selectedNode && link.source === nodeId)
    );
  };

  // Helper to render type icons in inspector
  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <Network className="w-5 h-5 text-[#6a2153]" />;
      case 'person':
        return <User className="w-5 h-5 text-[#9f8f99]" />;
      case 'decision':
        return <Award className="w-5 h-5 text-[#34d399]" />;
      case 'task':
        return <ClipboardList className="w-5 h-5 text-[#f5e2de]" />;
      case 'risk':
        return <AlertTriangle className="w-5 h-5 text-[#ffb4ab]" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-zinc-800 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold font-display text-white mb-1">Knowledge Graph</h2>
          <p className="text-sm text-zinc-400">Interactive intelligence network mapping entities and context.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#9f8f99]">
          <div className="w-8 h-8 rounded-full border-2 border-[#2a4a5e] border-t-[#6a2153] animate-spin" />
          <p className="text-sm font-medium font-mono">Computing knowledge graph geometry...</p>
        </div>
      ) : nodes.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-805 rounded-xl p-12 text-center text-zinc-500">
          <Network className="w-12 h-12 mx-auto text-zinc-800 mb-4" />
          <p className="text-sm font-semibold">No sync documents found. Upload meetings to populate knowledge graph.</p>
        </div>
      ) : (
        <>
          {/* Filters Bar */}
          <div className="flex flex-wrap gap-2 animate-in fade-in duration-300">
            {['all', 'meeting', 'person', 'decision', 'task', 'risk'].map((filter) => (
              <button 
                key={filter}
                onClick={() => setActiveFilter(filter as any)}
                className={`px-4 py-2 rounded-full font-semibold text-xs transition capitalize ${
                  activeFilter === filter 
                    ? 'bg-[#6a2153] text-white shadow-md shadow-[#6a2153]/20' 
                    : 'bg-[#0f1f2d] border border-[#2a4a5e] text-[#9f8f99] hover:text-[#f5e2de]'
                }`}
              >
                {filter === 'all' ? 'All Nodes' : `${filter}s`}
              </button>
            ))}
          </div>

          {/* Main Graph Grid */}
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-270px)] min-h-[500px] animate-in fade-in duration-300">
            
            {/* Left: SVG Canvas Panel (Span 8) */}
            <div className="col-span-12 lg:col-span-8 bg-zinc-900/40 border border-zinc-805 rounded-xl relative overflow-hidden flex items-center justify-center p-6 shadow-2xl">
              {/* Glass Overlay instruction */}
              <div className="absolute top-4 left-4 bg-zinc-900/80 backdrop-blur-md px-3.5 py-2 rounded-lg border border-zinc-800 text-[10px] text-zinc-500 flex items-center gap-1.5 z-10 pointer-events-none uppercase font-semibold">
                <HelpCircle className="w-3.5 h-3.5 text-violet-400" /> Click nodes to explore relationships
              </div>

              {/* Interactive SVG Canvas */}
              <svg ref={graphSvgRef} viewBox="0 0 500 400" className="w-full h-full max-h-[420px] select-none">
                <defs>
                  <radialGradient id="meeting-grad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#4c1d95" />
                    <stop offset="100%" stopColor="#09090b" />
                  </radialGradient>
                </defs>

                {/* Draw Links */}
                {links.map((link) => {
                  const sourceNode = nodes.find(n => n.id === link.source);
                  const targetNode = nodes.find(n => n.id === link.target);
                  if (!sourceNode || !targetNode) return null;

                  const isSourceFiltered = activeFilter !== 'all' && sourceNode.type !== activeFilter;
                  const isTargetFiltered = activeFilter !== 'all' && targetNode.type !== activeFilter;
                  const isLinkFiltered = isSourceFiltered || isTargetFiltered;

                  const isHighlighted = isNodeConnected(sourceNode.id) && isNodeConnected(targetNode.id);

                  return (
                    <line
                      key={link.id}
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke={isHighlighted ? '#a78bfa' : '#27272a'}
                      strokeWidth={isHighlighted ? 1.5 : 1}
                      strokeDasharray={sourceNode.type === 'task' || targetNode.type === 'task' ? '3 3' : undefined}
                      opacity={isLinkFiltered ? 0.05 : isHighlighted ? 0.8 : 0.3}
                      className="transition-all duration-300"
                    />
                  );
                })}

                {/* Draw Nodes */}
                {nodes.map((node) => {
                  const isFiltered = activeFilter !== 'all' && node.type !== activeFilter;
                  const isSelected = selectedNode === node.id;
                  const isHighlighted = isNodeConnected(node.id);

                  return (
                    <g 
                      key={node.id} 
                      onClick={() => handleNodeClick(node.id)}
                      className="graph-node cursor-pointer group"
                      opacity={isFiltered ? 0.15 : 1}
                    >
                      {/* Outer Pulsing Aura (Selected Node) */}
                      {isSelected && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={node.radius + 8}
                          fill="none"
                          stroke={node.color}
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          className="animate-spin"
                          style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDuration: '16s' }}
                        />
                      )}

                      {/* Outer highlighting ring on hover */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.radius + 4}
                        fill="none"
                        stroke={node.color}
                        strokeWidth={isSelected ? 2 : 1}
                        opacity={isSelected ? 1 : 0}
                        className="group-hover:opacity-60 transition-opacity duration-200"
                      />

                      {/* Core Circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.radius}
                        fill={node.type === 'meeting' ? 'url(#meeting-grad)' : '#09090b'}
                        stroke={isSelected ? '#a78bfa' : node.color}
                        strokeWidth={isSelected ? 3 : isHighlighted ? 2 : 1.2}
                        className="transition-all duration-200"
                      />

                      {/* Node Label Text */}
                      <text
                        x={node.x}
                        y={node.y + 4}
                        textAnchor="middle"
                        fill="#f5e2de"
                        fontSize={node.type === 'meeting' ? '7px' : '6px'}
                        fontWeight="bold"
                        className="pointer-events-none select-none"
                      >
                        {node.type === 'meeting' 
                          ? (node.label.length > 10 ? node.label.substring(0, 10) + '...' : node.label)
                          : node.type === 'person' 
                            ? node.label.split(' ')[0] 
                            : (node.label.length > 8 ? node.label.substring(0, 8) + '...' : node.label)
                        }
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Right: Selected Node Details Inspector (Span 4) */}
            <div className="col-span-12 lg:col-span-4 bg-zinc-900/40 border border-zinc-805 rounded-xl p-6 shadow-2xl flex flex-col justify-between">
              {activeNode ? (
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Node Type Badge */}
                    <div className="flex items-center space-x-2">
                      {renderTypeIcon(activeNode.type)}
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">
                        {activeNode.type} Node
                      </span>
                    </div>

                    {/* Node Title */}
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">{activeNode.label}</h3>
                      <p className="text-[10px] font-mono text-violet-400 mt-1">{activeNode.meta}</p>
                    </div>

                    {/* Node Description */}
                    <div className="pt-4 border-t border-zinc-800">
                      <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                        {activeNode.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions based on node type */}
                  {activeNode.meetingId && (
                    <div className="pt-6 border-t border-zinc-800 shrink-0">
                      <Link 
                        href={`/dashboard/meeting/${activeNode.meetingId}`}
                        className="w-full bg-zinc-900 border border-zinc-800 hover:border-violet-500 hover:bg-zinc-850 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-xs transition duration-200"
                      >
                        <span>Open Dashboard</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500">
                  <Network className="w-8 h-8 opacity-25 mb-2" />
                  <p className="text-xs italic">Select a node in the network to inspect its relationships and metadata.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
