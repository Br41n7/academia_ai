import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { auth, signInWithGoogle, signInWithGoogleRedirect, getGoogleRedirectResult, signOut, awardPoints } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
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
import { LogIn, GraduationCap } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked. You can try the redirect method instead.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setAuthError('A sign-in request is already in progress.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in was cancelled.');
      } else {
        setAuthError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignInRedirect = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogleRedirect();
    } catch (error: any) {
      console.error('Redirect sign in error:', error);
      setAuthError('Redirect sign-in failed. Please try opening the app in a new tab.');
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    // Check for redirect result
    getGoogleRedirectResult().catch(err => {
      console.error('Redirect result error:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      if (user) {
        awardPoints(user.uid, 0); // Ensure profile exists
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
          className="max-w-md w-full bg-white dark:bg-[#111111] p-12 rounded-[3rem] shadow-2xl text-center space-y-8 border border-black/5 dark:border-white/5"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-500/20">
            <GraduationCap size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Academic AI</h1>
            <p className="text-gray-500">Your intelligent study companion. Sign in to start learning.</p>
          </div>
          <div className="space-y-4">
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:hover:scale-100"
            >
              {isSigningIn ? (
                <div className="w-5 h-5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn size={20} />
              )}
              {isSigningIn ? 'Connecting...' : 'Sign in with Google'}
            </button>

            {authError && (
              <div className="space-y-3">
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-rose-500 font-medium"
                >
                  {authError}
                </motion.p>
                {authError.includes('blocked') && (
                  <button
                    onClick={handleSignInRedirect}
                    className="text-sm font-bold text-indigo-600 hover:underline"
                  >
                    Try Redirect Method
                  </button>
                )}
              </div>
            )}
          </div>
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
          </motion.div>
        </AnimatePresence>
      </ProjectLayout>
    </div>
  );
}
