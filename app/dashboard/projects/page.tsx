'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, FolderKanban, Calendar, FileText, X, Trash2 } from 'lucide-react';
import { Project } from '@/lib/db';

interface ProjectWithCount extends Project {
  meetingCount: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create project');
      }
      setNewName('');
      setNewDescription('');
      setShowCreateModal(false);
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this project? Its meetings will be kept but unassigned from the project.')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#12172A] border border-[#232B45] p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-bold font-display text-[#F8FAFC]">Projects</h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-mono">
            Group related meetings into a living, AI-synthesized project workspace.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 rounded-xl text-xs font-bold btn-primary-cta inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-[#94A3B8] font-mono animate-pulse bg-[#12172A] border border-[#232B45] rounded-2xl">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="p-12 text-center bg-[#12172A] border border-[#232B45] rounded-2xl space-y-3">
          <FolderKanban className="w-8 h-8 text-[#6366F1] mx-auto" />
          <p className="text-sm font-semibold text-[#F8FAFC]">No projects yet</p>
          <p className="text-xs text-[#94A3B8]">Create a project, then upload meetings into it to build a living knowledge base.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="group bg-[#12172A] border border-[#232B45] hover:border-[#6366F1] rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between hover:scale-[1.01] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#6366F1]/5 rounded-bl-full pointer-events-none group-hover:bg-[#6366F1]/10 transition-all" />

              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center shrink-0">
                      <FolderKanban className="w-4 h-4 text-[#6366F1]" />
                    </div>
                    <h3 className="font-bold text-sm text-[#F8FAFC] group-hover:text-[#5de6ff] transition-colors line-clamp-1">
                      {p.name}
                    </h3>
                  </div>
                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    className="p-1.5 rounded-lg text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10 transition cursor-pointer shrink-0"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-[#94A3B8] line-clamp-3 leading-relaxed mb-4">
                  {p.description || p.aiSummary?.objective || 'No description yet.'}
                </p>
              </div>

              <div className="pt-3 border-t border-[#232B45] flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#6366F1]" />
                  <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-[#5de6ff]" />
                  <span>{p.meetingCount} meeting{p.meetingCount === 1 ? '' : 's'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreateModal(false)}>
          <div
            className="w-full max-w-md bg-[#12172A] border border-[#232B45] rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#F8FAFC]">New Project</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-[#94A3B8] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">Project Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Cue Intelligence Platform"
                  className="w-full bg-[#0a0e17] border border-[#232B45] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#6366F1] transition"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">Description (optional)</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What is this project about?"
                  rows={3}
                  className="w-full bg-[#0a0e17] border border-[#232B45] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#6366F1] transition resize-none"
                />
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}

              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="w-full py-2.5 rounded-xl text-xs font-bold btn-primary-cta disabled:opacity-50 cursor-pointer"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
