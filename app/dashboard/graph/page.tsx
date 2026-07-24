'use client';

import React, { useState } from 'react';
import { 
  Network, 
  HelpCircle, 
  Layers, 
  User, 
  Award, 
  ClipboardList, 
  AlertTriangle,
  Calendar,
  ExternalLink
} from 'lucide-react';

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
}

interface GraphLink {
  source: string;
  target: string;
  id: string;
}

export default function KnowledgeGraphPage() {
  const [selectedNode, setSelectedNode] = useState<string>('apollo-sync');
  const [activeFilter, setActiveFilter] = useState<'all' | 'meeting' | 'person' | 'decision' | 'task' | 'risk'>('all');

  const nodes: GraphNode[] = [
    {
      id: 'apollo-sync',
      label: 'Project Apollo Sync',
      type: 'meeting',
      x: 250,
      y: 200,
      radius: 32,
      color: '#c0c1ff', // primary
      description: 'The core weekly planning meeting mapping marketing budgets, roadmap releases, and timeline updates.',
      meta: 'Oct 24 • 45 min sync • 4 attendees'
    },
    {
      id: 'sarah-chen',
      label: 'Sarah Chen',
      type: 'person',
      x: 100,
      y: 100,
      radius: 20,
      color: '#a2eeff', // secondary
      description: 'Lead Architect & project controller managing general budget allocations and timeline alignment.',
      meta: 'Sarah Chen • Lead Architect'
    },
    {
      id: 'marcus-wright',
      label: 'Marcus Wright',
      type: 'person',
      x: 400,
      y: 100,
      radius: 20,
      color: '#a2eeff',
      description: 'Technical Developer handling integration APIs and core database structures.',
      meta: 'Marcus Wright • Developer'
    },
    {
      id: 'cap-spend',
      label: 'Cap spend at $150k',
      type: 'decision',
      x: 120,
      y: 300,
      radius: 24,
      color: '#34D399', // success-glow
      description: 'Approved decision to cap initial spend at $150k and schedule budget audits every 30 days.',
      meta: 'Decided by Marcus W. • Q3 Marketing Sync'
    },
    {
      id: 'send-draft',
      label: 'Send draft to finance',
      type: 'task',
      x: 380,
      y: 300,
      radius: 22,
      color: '#8083ff', // primary-container
      description: 'Action item allocated to Marcus Wright to deliver the final proposal draft to the finance team by EOD.',
      meta: 'Owner: Marcus W. • Due: Today'
    },
    {
      id: 'api-delay',
      label: 'API Integration Delayed',
      type: 'risk',
      x: 250,
      y: 60,
      radius: 24,
      color: '#F59E0B', // warning
      description: 'High impact risk involving vendor credentials delay that might set back the general mobile launch date.',
      meta: 'Reported by Marcus W. • Vendor issue'
    }
  ];

  const links: GraphLink[] = [
    { source: 'apollo-sync', target: 'sarah-chen', id: 'l1' },
    { source: 'apollo-sync', target: 'marcus-wright', id: 'l2' },
    { source: 'apollo-sync', target: 'cap-spend', id: 'l3' },
    { source: 'apollo-sync', target: 'send-draft', id: 'l4' },
    { source: 'apollo-sync', target: 'api-delay', id: 'l5' },
    { source: 'sarah-chen', target: 'cap-spend', id: 'l6' },
    { source: 'marcus-wright', target: 'send-draft', id: 'l7' },
    { source: 'marcus-wright', target: 'api-delay', id: 'l8' }
  ];

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
  };

  const getActiveNodeData = () => {
    return nodes.find(n => n.id === selectedNode) || nodes[0];
  };

  const activeNode = getActiveNodeData();

  // Highlight connections
  const isNodeConnected = (nodeId: string) => {
    if (selectedNode === nodeId) return true;
    return links.some(link => 
      (link.source === selectedNode && link.target === nodeId) ||
      (link.target === selectedNode && link.source === nodeId)
    );
  };

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-[#232B45] pb-6">
        <div>
          <h2 className="text-3xl font-extrabold font-display text-white mb-1">Knowledge Graph</h2>
          <p className="text-sm text-[#94A3B8]">Interactive intelligence network mapping entities and context.</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-full font-semibold text-xs transition ${
            activeFilter === 'all' 
              ? 'bg-[#c0c1ff] text-[#1000a9]' 
              : 'bg-[#12172A] border border-[#232B45] text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          All Nodes
        </button>
        <button 
          onClick={() => setActiveFilter('meeting')}
          className={`px-4 py-2 rounded-full font-semibold text-xs transition ${
            activeFilter === 'meeting' 
              ? 'bg-[#c0c1ff] text-[#1000a9]' 
              : 'bg-[#12172A] border border-[#232B45] text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          Meetings
        </button>
        <button 
          onClick={() => setActiveFilter('person')}
          className={`px-4 py-2 rounded-full font-semibold text-xs transition ${
            activeFilter === 'person' 
              ? 'bg-[#c0c1ff] text-[#1000a9]' 
              : 'bg-[#12172A] border border-[#232B45] text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          People
        </button>
        <button 
          onClick={() => setActiveFilter('decision')}
          className={`px-4 py-2 rounded-full font-semibold text-xs transition ${
            activeFilter === 'decision' 
              ? 'bg-[#c0c1ff] text-[#1000a9]' 
              : 'bg-[#12172A] border border-[#232B45] text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          Decisions
        </button>
        <button 
          onClick={() => setActiveFilter('task')}
          className={`px-4 py-2 rounded-full font-semibold text-xs transition ${
            activeFilter === 'task' 
              ? 'bg-[#c0c1ff] text-[#1000a9]' 
              : 'bg-[#12172A] border border-[#232B45] text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          Tasks
        </button>
        <button 
          onClick={() => setActiveFilter('risk')}
          className={`px-4 py-2 rounded-full font-semibold text-xs transition ${
            activeFilter === 'risk' 
              ? 'bg-[#c0c1ff] text-[#1000a9]' 
              : 'bg-[#12172A] border border-[#232B45] text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
        >
          Risks
        </button>
      </div>

      {/* Main Graph Grid */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-270px)] min-h-[500px]">
        
        {/* Left: SVG Canvas Panel (Span 8) */}
        <div className="col-span-12 lg:col-span-8 bg-[#12172A] border border-[#232B45] rounded-xl relative overflow-hidden flex items-center justify-center p-6 shadow-2xl">
          {/* Glass Overlay instruction */}
          <div className="absolute top-4 left-4 bg-[#0a0e17]/80 backdrop-blur-md px-3.5 py-2 rounded-lg border border-[#232B45] text-[10px] text-[#94A3B8] flex items-center gap-1.5 z-10 pointer-events-none uppercase font-semibold">
            <HelpCircle className="w-3.5 h-3.5 text-[#5de6ff]" /> Click nodes to explore relationships
          </div>

          {/* Interactive SVG Canvas */}
          <svg viewBox="0 0 500 400" className="w-full h-full max-h-[420px] select-none">
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
                  stroke={isHighlighted ? '#5de6ff' : '#232B45'}
                  strokeWidth={isHighlighted ? 1.5 : 1}
                  strokeDasharray={sourceNode.type === 'task' || targetNode.type === 'task' ? '4 4' : undefined}
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
                  className="cursor-pointer group"
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
                      style={{ transformOrigin: `${node.x}px ${node.y}px`, animationDuration: '12s' }}
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
                    fill={node.type === 'meeting' ? 'url(#meeting-grad)' : '#181b25'}
                    stroke={isSelected ? '#5de6ff' : node.color}
                    strokeWidth={isSelected ? 3 : isHighlighted ? 2 : 1.2}
                    className="transition-all duration-200"
                  />

                  {/* Icons inside nodes */}
                  <g transform={`translate(${node.x - 7}, ${node.y - 7})`} opacity={0.8} className="pointer-events-none">
                    {node.type === 'meeting' && <Network className="w-3.5 h-3.5 text-white" />}
                    {node.type === 'person' && <User className="w-3.5 h-3.5 text-[#5de6ff]" />}
                    {node.type === 'decision' && <Award className="w-3.5 h-3.5 text-[#34D399]" />}
                    {node.type === 'task' && <ClipboardList className="w-3.5 h-3.5 text-[#8083ff]" />}
                    {node.type === 'risk' && <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />}
                  </g>

                  {/* Node Label Text */}
                  <text
                    x={node.x}
                    y={node.y + node.radius + 14}
                    textAnchor="middle"
                    fill={isSelected ? '#5de6ff' : isHighlighted ? '#F8FAFC' : '#94A3B8'}
                    fontSize={10}
                    fontWeight={isSelected || isHighlighted ? 'bold' : 'normal'}
                    className="transition-colors duration-200 pointer-events-none font-sans"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}

            {/* Gradient Definitions */}
            <defs>
              <linearGradient id="meeting-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8083ff" />
                <stop offset="100%" stopColor="#494bd6" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Right: Selected Node Details Panel (Span 4) */}
        <div className="col-span-12 lg:col-span-4 bg-[#12172A] border border-[#232B45] rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-center justify-between pb-4 border-b border-[#232B45]/50">
              <span className="font-mono text-[9px] text-[#94A3B8] uppercase tracking-widest font-bold">Node Details</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono ${
                activeNode.type === 'meeting' ? 'bg-[#c0c1ff]/15 text-[#c0c1ff]' :
                activeNode.type === 'person' ? 'bg-[#5de6ff]/15 text-[#5de6ff]' :
                activeNode.type === 'decision' ? 'bg-[#34D399]/15 text-[#34D399]' :
                activeNode.type === 'task' ? 'bg-[#8083ff]/15 text-[#8083ff]' : 'bg-[#F59E0B]/15 text-[#F59E0B]'
              }`}>
                {activeNode.type}
              </span>
            </div>

            {/* Node label */}
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-white font-display leading-tight">{activeNode.label}</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed bg-[#181b25] border border-[#232B45] p-3 rounded-lg">
                {activeNode.description}
              </p>
            </div>

            {/* Relations list */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] font-bold">Network Connections</h4>
              <div className="space-y-2">
                {links
                  .filter(link => link.source === activeNode.id || link.target === activeNode.id)
                  .map(link => {
                    const connectedNodeId = link.source === activeNode.id ? link.target : link.source;
                    const node = nodes.find(n => n.id === connectedNodeId);
                    if (!node) return null;
                    return (
                      <div 
                        key={node.id} 
                        onClick={() => handleNodeClick(node.id)}
                        className="bg-[#181b25] border border-[#232B45] hover:border-[#5de6ff]/30 p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition cursor-pointer group"
                      >
                        <span className="text-[#dfe2ef] group-hover:text-[#5de6ff] transition-colors">{node.label}</span>
                        <span className="text-[9px] font-mono text-[#94A3B8] uppercase shrink-0">{node.type}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="pt-4 border-t border-[#232B45]/50 flex items-center justify-between text-[11px] text-[#94A3B8] font-semibold">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#ffb0cd]" /> {activeNode.meta.split('•')[0]}
            </span>
            <button className="text-[#5de6ff] hover:text-[#c0c1ff] transition flex items-center gap-1">
              Explore Subgraph <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
