import React, { useState, useEffect } from 'react';
import { Plus, Folder, Calendar, ArrowRight, BookOpen, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { db, collection, onSnapshot, query, where, orderBy, setDoc, doc, handleFirestoreError, OperationType } from '../firebase';
import { User } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface ProjectSelectorProps {
  onSelect: (project: Project) => void;
  user: User;
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
      await setDoc(doc(db, 'projects', projectId), newProject);
      setIsCreating(false);
      setNewName('');
      setNewDesc('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#050505] p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div className="space-y-2">
              <h1 className="text-5xl font-bold tracking-tight">My Projects</h1>
              <p className="text-gray-500 text-lg">Select a workspace to start learning.</p>
            </div>
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              />
            </div>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold hover:scale-105 transition-all shadow-lg shrink-0"
          >
            <Plus size={20} />
            New Project
          </button>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-white dark:bg-[#111111] rounded-3xl animate-pulse border border-black/5 dark:border-white/5" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6 bg-white dark:bg-[#111111] rounded-[3rem] border border-black/5 dark:border-white/5">
            <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center text-gray-400">
              <Folder size={40} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold">{searchQuery ? 'No results found' : 'No projects yet'}</h3>
              <p className="text-gray-500">
                {searchQuery ? `We couldn't find any projects matching "${searchQuery}"` : 'Create your first project to start organizing your study materials.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-8 py-4 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 transition-all"
              >
                Get Started
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProjects.map((project) => (
              <motion.button
                key={project.id}
                whileHover={{ y: -8 }}
                onClick={() => onSelect(project)}
                className="group relative flex flex-col text-left bg-white dark:bg-[#111111] p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 hover:border-indigo-500/50 transition-all shadow-sm hover:shadow-2xl"
              >
                <div className="mb-6 w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <BookOpen size={28} />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-2xl font-bold group-hover:text-indigo-600 transition-colors">{project.name}</h3>
                  <p className="text-gray-500 line-clamp-2 text-sm leading-relaxed">{project.description || 'No description provided.'}</p>
                </div>
                <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    {new Date(project.created_at).toLocaleDateString()}
                  </div>
                  <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform text-indigo-600" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setIsCreating(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-lg bg-white dark:bg-[#111111] rounded-[3rem] p-10 shadow-2xl space-y-8"
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">New Project</h2>
              <p className="text-gray-500">Give your workspace a name and description.</p>
            </div>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Project Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Quantum Physics"
                  className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-2xl p-4 text-lg focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What are you studying in this project?"
                  className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-2xl p-4 min-h-[120px] focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-6 py-4 font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
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
