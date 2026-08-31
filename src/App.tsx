import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import ProjectSelector from './components/ProjectSelector';
import ProjectLayout from './components/ProjectLayout';
import Notebook from './components/Notebook';
import Quiz from './components/Quiz';
import Mnemonics from './components/Mnemonics';
import Dashboard from './components/Dashboard';
import StudyGuide from './components/StudyGuide';
import SlideDeck from './components/SlideDeck';
import Leaderboard from './components/Leaderboard';
import ExamMode from './components/ExamMode';
import CourseBuilder from './components/CourseBuilder';
import StudyReminders from './components/StudyReminders';
import Settings from './components/Settings';
import { supabase } from './lib/supabase';
import { signInWithGoogle } from './lib/auth';
import { GraduationCap, LogIn } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
}

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setIsAuthReady(true);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // On first sign-in, detect region from IP for cultural grounding:
  useEffect(() => {
    if (!localStorage.getItem('academia_region')) {
      fetch('https://ipapi.co/json/')
        .then(r => r.json())
        .then(data => {
          if (data?.country_name) {
            localStorage.setItem('academia_region', data.country_name);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleSignIn = async () => {
    try {
      setAuthError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign in error:', err);
      setAuthError(err.message || 'Failed to sign in with Google');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-[#0A0A0A]">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-[#111111] p-10 rounded-[2.5rem] shadow-2xl text-center space-y-6 border border-black/5 dark:border-white/5"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-500/20">
            <GraduationCap size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Academia AI</h1>
            <p className="text-gray-500 text-sm">AI study copilot for African students. Sign in to start learning.</p>
          </div>

          <button
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/25 mt-2"
          >
            <LogIn size={20} />
            Sign In with Google
          </button>

          {authError && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-rose-500 font-medium"
            >
              {authError}
            </motion.p>
          )}
        </motion.div>
      </div>
    );
  }

  if (!selectedProject) {
    return <ProjectSelector onSelect={setSelectedProject} user={user} />;
  }

  return (
    <div className={cn(
      "min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] text-[#1A1A1A] dark:text-[#F0F0F0] transition-colors duration-300",
      isDarkMode && "dark"
    )}>
      <ProjectLayout 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'overview' && <Dashboard projectId={selectedProject.id} />}
            {activeTab === 'course' && <CourseBuilder projectId={selectedProject.id} onNavigate={setActiveTab} />}
            {activeTab === 'documents' && <Notebook projectId={selectedProject.id} mode="documents" />}
            {activeTab === 'flashcards' && <Mnemonics projectId={selectedProject.id} />}
            {activeTab === 'quiz' && <Quiz projectId={selectedProject.id} />}
            {activeTab === 'exam' && <ExamMode projectId={selectedProject.id} onNavigate={setActiveTab} />}
            {activeTab === 'guide' && <StudyGuide projectId={selectedProject.id} />}
            {activeTab === 'slides' && <SlideDeck projectId={selectedProject.id} />}
            {activeTab === 'leaderboard' && <Leaderboard />}
            {activeTab === 'notes' && <Notebook projectId={selectedProject.id} mode="notes" />}
            {activeTab === 'mindmap' && <Notebook projectId={selectedProject.id} mode="mindmap" />}
            {activeTab === 'graph' && <Notebook projectId={selectedProject.id} mode="graph" />}
            {activeTab === 'planner' && <StudyReminders projectId={selectedProject.id} />}
            {activeTab === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </ProjectLayout>
    </div>
  );
}
