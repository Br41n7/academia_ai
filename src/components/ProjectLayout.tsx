import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  MessageSquare, 
  Sparkles, 
  HelpCircle, 
  StickyNote, 
  Share2, 
  Network, 
  Calendar,
  ChevronLeft,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  Presentation,
  Trophy,
  Swords,
  ShieldAlert,
  Image as ImageIcon
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
    <div className="flex h-screen bg-[#F8F9FA] dark:bg-[#050505] overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="relative flex flex-col bg-white dark:bg-[#111111] border-r border-black/5 dark:border-white/5 z-50"
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div
                key="full"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 overflow-hidden"
              >
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0">
                  <span className="font-bold">A</span>
                </div>
                <span className="font-bold truncate">{project.name}</span>
              </motion.div>
            ) : (
              <motion.div
                key="mini"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white mx-auto"
              >
                <span className="font-bold">A</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                activeTab === item.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
              )}
            >
              <item.icon size={20} className={cn("shrink-0", activeTab === item.id ? "text-white" : "group-hover:text-indigo-600")} />
              {isSidebarOpen && (
                <span className="font-medium text-sm truncate">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-black/5 dark:border-white/5 space-y-1">
          <button
            onClick={onBack}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group"
          >
            <LogOut size={20} className="shrink-0 group-hover:text-rose-500" />
            {isSidebarOpen && <span className="font-medium text-sm">Exit Project</span>}
          </button>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all"
          >
            <Menu size={20} className="shrink-0" />
            {isSidebarOpen && <span className="font-medium text-sm">Collapse</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-[#111111] border-b border-black/5 dark:border-white/5 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-lg capitalize">{activeTab.replace('_', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-all"
            >
              <Sparkles size={20} className={isDarkMode ? "text-amber-400" : "text-gray-400"} />
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-all">
              <Settings size={20} className="text-gray-400" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
