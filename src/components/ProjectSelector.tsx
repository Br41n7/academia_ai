import React, { useState, useEffect } from 'react';
import { Plus, Folder, Calendar, ArrowRight, BookOpen, Search, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { db, collection, onSnapshot, query, where, orderBy, setDoc, doc, handleFirestoreError, OperationType } from '../firebase';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface ProjectSelectorProps {
  onSelect: (project: Project) => void;
  user: any;
}

export default function ProjectSelector({ onSelect, user }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    if (isSupabaseConfigured && supabase) {
      setIsLoading(true);
      supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.uid)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (data) {
            setProjects(data as Project[]);
          }
          setIsLoading(false);
        });

      const channel = supabase
        .channel('public:projects')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${user.uid}` }, () => {
          supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.uid)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (data) setProjects(data as Project[]);
            });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      const q = query(
        collection(db, 'projects'),
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const projectsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Project[];
        setProjects(projectsList);
        setIsLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'projects');
        setIsLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;

    const projectId = uuidv4();
    const newProject = {
      id: projectId,
      name: newName,
      description: newDesc,
      user_id: user.uid,
      created_at: new Date().toISOString()
    };

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('projects')
          .insert({
            id: projectId,
            name: newName,
            description: newDesc,
            user_id: user.uid
          });
        if (error) throw error;
      } else {
        await setDoc(doc(db, 'projects', projectId), newProject);
      }
      setIsCreating(false);
      setNewName('');
      setNewDesc('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] p-8 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-full text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={13} />
              Academic AI Workspaces
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              My Projects
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-base">Select a project workspace to manage study materials and AI tools.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-white dark:bg-[#0d111a] border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              />
            </div>

            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20 shrink-0 text-sm"
            >
              <Plus size={18} />
              New Project
            </button>
          </div>
        </header>

        {/* Project Grid / State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 bg-white dark:bg-[#0d111a] rounded-2xl animate-pulse border border-slate-200 dark:border-slate-800" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-5 bg-white dark:bg-[#0d111a] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Folder size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{searchQuery ? 'No results found' : 'No projects created yet'}</h3>
              <p className="text-slate-500 text-sm max-w-md">
                {searchQuery ? `No project matches "${searchQuery}". Try a different keyword.` : 'Create your first academic project workspace to start analyzing papers and generating quizzes.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={() => setIsCreating(true)}
                className="mt-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all text-sm shadow-md"
              >
                Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                whileHover={{ y: -4 }}
                onClick={() => onSelect(project)}
                className="group cursor-pointer flex flex-col text-left bg-white dark:bg-[#0d111a] p-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 hover:border-indigo-500 dark:hover:border-indigo-500/80 transition-all shadow-sm hover:shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                    <BookOpen size={24} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">Active</span>
                </div>

                <div className="flex-1 space-y-1.5">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{project.name}</h3>
                  <p className="text-slate-500 dark:text-slate-400 line-clamp-2 text-xs leading-relaxed">{project.description || 'No detailed summary provided.'}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    {new Date(project.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Open</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal Overlay */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setIsCreating(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-lg bg-white dark:bg-[#0d111a] rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6"
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create New Workspace</h2>
              <p className="text-slate-500 text-xs">Set up a dedicated project workspace for your study domain.</p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Project Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Quantum Computing & Algorithms"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Summary of research focus or exam goals..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-indigo-500 transition-all resize-none outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-3 font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold disabled:opacity-50 transition-all text-sm shadow-md"
                >
                  Create Project
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
