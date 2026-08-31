import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { BookOpen, FileText, Brain, Award, Flame, CheckCircle2, Clock } from 'lucide-react';

interface DashboardProps {
  projectId: string;
}

export default function Dashboard({ projectId }: DashboardProps) {
  const [docCount, setDocCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);
  const [userProfile, setUserProfile] = useState<{ points: number; study_streak: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const profile = await apiFetch('/api/profiles/me').catch(() => null);
          if (profile) {
            setUserProfile({
              points: profile.points ?? 0,
              study_streak: profile.study_streak ?? 0
            });
          }
        }

        const { count: docs } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId);

        const { count: notes } = await supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId);

        setDocCount(docs || 0);
        setNoteCount(notes || 0);
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workspace Overview</h1>
        <p className="text-gray-500 text-sm">Summary of your learning assets and study streak</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Documents</p>
            <p className="text-2xl font-bold">{docCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl flex items-center justify-center">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Notes</p>
            <p className="text-2xl font-bold">{noteCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-xl flex items-center justify-center">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Points</p>
            <p className="text-2xl font-bold">{userProfile?.points ?? 0}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950 text-rose-600 rounded-xl flex items-center justify-center">
            <Flame size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Study Streak</p>
            <p className="text-2xl font-bold">{userProfile?.study_streak ?? 0} days</p>
          </div>
        </div>
      </div>
    </div>
  );
}
