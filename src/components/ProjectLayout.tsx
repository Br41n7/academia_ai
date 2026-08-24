import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Sparkles, 
  HelpCircle, 
  StickyNote, 
  Share2, 
  Network, 
  Calendar,
  Settings,
  LogOut,
  Menu,
  BookOpen,
  Presentation,
  Trophy,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Project {
  id: string;
  name: string;
  description: string;
}

interface ProjectLayoutProps {
  project: Project;
  onBack: () => void;
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'flashcards', label: 'Flashcards', icon: Sparkles },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'exam', label: 'Exam Mode', icon: ShieldAlert },
  { id: 'guide', label: 'Study Guide', icon: BookOpen },
  { id: 'slides', label: 'Slide Deck', icon: Presentation },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'mindmap', label: 'Mindmap', icon: Share2 },
  { id: 'graph', label: 'Knowledge Graph', icon: Network },
  { id: 'planner', label: 'Study Planner', icon: Calendar },
];

export default function ProjectLayout({ 
  project, 
  onBack, 
  children, 
  activeTab, 
  setActiveTab,
  isDarkMode,
  setIsDarkMode
}: ProjectLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 270 : 80 }}
        className="relative flex flex-col bg-white/80 dark:bg-[#0d111a]/80 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 z-50 shadow-sm"
      >
        {/* Header Branding */}
        <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div
                key="full"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 overflow-hidden"
              >
                <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/20">
                  <span className="font-extrabold text-sm tracking-wider">A</span>
                </div>
                <div className="flex flex-col truncate">
                  <span className="font-bold text-sm tracking-tight truncate">{project.name}</span>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Workspace</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="mini"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center text-white mx-auto shadow-md shadow-indigo-500/20"
              >
                <span className="font-extrabold text-sm">A</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 group relative font-medium text-sm",
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <item.icon
                  size={19}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-white" : "text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                  )}
                />
                {isSidebarOpen && (
                  <span className="truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer controls */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/60 space-y-1">
          <button
            onClick={onBack}
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all group font-medium text-sm"
          >
            <LogOut size={19} className="shrink-0 text-slate-400 group-hover:text-rose-600 transition-colors" />
            {isSidebarOpen && <span>Exit Workspace</span>}
          </button>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-all font-medium text-sm"
          >
            <Menu size={19} className="shrink-0" />
            {isSidebarOpen && <span>Collapse Sidebar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-16 bg-white/80 dark:bg-[#0d111a]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-8 shrink-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 tracking-tight capitalize">
              {activeTab.replace('_', ' ')}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="Toggle Dark Mode"
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400 rounded-xl transition-all border border-slate-200/50 dark:border-slate-700/50"
            >
              <Sparkles size={18} className={isDarkMode ? "text-amber-400 fill-amber-400/20" : "text-slate-500"} />
            </button>
            <button
              aria-label="Settings"
              onClick={() => setActiveTab('settings')}
              title="Settings"
              className={cn(
                "p-2.5 rounded-xl transition-all border",
                activeTab === 'settings'
                  ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50"
              )}
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Content View Area */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-50/50 dark:bg-[#07090e]/50">
          {children}
        </div>
      </main>
    </div>
  );
}
