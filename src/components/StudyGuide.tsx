import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, 
  Download, 
  Printer, 
  Share2, 
  RefreshCw,
  Sparkles,
  FileText,
  Bookmark
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateStudyGuide } from '../services/geminiService';

interface StudyGuideProps {
  projectId: string;
}

export default function StudyGuide({ projectId }: StudyGuideProps) {
  const [guide, setGuide] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGuide = async () => {
    setIsLoading(true);
    try {
      const data = await generateStudyGuide(projectId);
      setGuide(data);
    } catch (error) {
      console.error('Error generating study guide:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuide();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-2">
          <p className="text-xl font-black tracking-tight animate-pulse">Synthesizing Study Guide...</p>
          <p className="text-gray-500 text-sm">Organizing concepts and identifying key takeaways.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full text-sm font-bold uppercase tracking-widest">
            <BookOpen size={16} />
            AI Study Guide
          </div>
          <h2 className="text-5xl font-black tracking-tight">Mastery Blueprint</h2>
          <p className="text-gray-500 text-lg max-w-xl">A comprehensive synthesis of your project documents and notes, optimized for retention.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchGuide}
            className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl hover:bg-black/10 transition-all"
          >
            <RefreshCw size={20} />
          </button>
          <button className="flex items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
            <Download size={20} />
            Export PDF
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation (Optional) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 bg-white dark:bg-[#111111] rounded-[2rem] border border-black/5 dark:border-white/5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Quick Actions</h4>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium transition-all">
                <Printer size={18} className="text-gray-400" />
                Print Guide
              </button>
              <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium transition-all">
                <Share2 size={18} className="text-gray-400" />
                Share Link
              </button>
              <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium transition-all">
                <Bookmark size={18} className="text-gray-400" />
                Save to Library
              </button>
            </div>
          </div>

          <div className="p-6 bg-indigo-600 text-white rounded-[2rem] space-y-4 shadow-xl shadow-indigo-500/20">
            <Sparkles size={24} className="opacity-60" />
            <p className="text-sm font-medium leading-relaxed">This guide is dynamically updated whenever you add new documents or notes to your project.</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#111111] p-10 md:p-16 rounded-[3rem] border border-black/5 dark:border-white/5 shadow-sm"
          >
            <div className="prose prose-indigo dark:prose-invert max-w-none">
              <ReactMarkdown>{guide || ''}</ReactMarkdown>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
