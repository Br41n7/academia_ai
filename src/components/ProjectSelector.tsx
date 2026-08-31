import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { FolderPlus, BookOpen, Trash2, Users, Share2, Plus, Sparkles } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
}

interface ProjectSelectorProps {
  onSelect: (project: Project) => void;
  user: any;
}

export default function ProjectSelector({ onSelect, user }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/projects');
      setProjects(data || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      // Fallback query directly using Supabase if server API is launching
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      setProjects(data as Project[] || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || creating) return;

    setCreating(true);
    try {
      const newProj = await apiFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description })
      });
      setShowNewModal(false);
      setName('');
      setDescription('');
      fetchProjects();
      if (newProj) onSelect(newProj);
    } catch (err) {
      console.error('Error creating project:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workspace?')) return;

    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
            <p className="text-gray-500 text-sm">Select or create a study project workspace</p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md transition-all"
          >
            <Plus size={18} />
            New Workspace
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <BookOpen size={32} />
            </div>
            <h3 className="text-lg font-semibold">No workspaces yet</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              Create your first study workspace to manage documents, quizzes, and notes.
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md"
            >
              <Plus size={18} />
              Create Workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(proj => (
              <div
                key={proj.id}
                onClick={() => onSelect(proj)}
                className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 hover:border-indigo-500/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                      <BookOpen size={20} />
                    </div>
                    <button
                      onClick={(e) => handleDeleteProject(proj.id, e)}
                      className="text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 className="font-bold text-lg group-hover:text-indigo-600 transition-colors">
                    {proj.name}
                  </h3>
                  <p className="text-gray-500 text-sm line-clamp-2">
                    {proj.description || 'No description provided.'}
                  </p>
                </div>
                <div className="pt-4 text-xs font-semibold text-indigo-600 flex items-center gap-1 mt-4">
                  Open Workspace &rarr;
                </div>
              </div>
            ))}
          </div>
        )}

        {showNewModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full space-y-4 border border-black/5 dark:border-white/5 shadow-2xl">
              <h2 className="text-xl font-bold">Create New Workspace</h2>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Organic Chemistry 101"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional details about this subject or course..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
