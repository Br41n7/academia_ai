import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HelpCircle, 
  Lightbulb, 
  ArrowRight, 
  Sparkles, 
  MessageSquare,
  Zap,
  RefreshCw,
  X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { analyzeConfusion } from '../services/geminiService';

interface ConfusionHelperProps {
  projectId: string;
  initialQuery?: string;
  onClose?: () => void;
}

export default function ConfusionHelper({ projectId, initialQuery = '', onClose }: ConfusionHelperProps) {
  const [query, setQuery] = useState(initialQuery);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      const data = await analyzeConfusion(query, projectId);
      setExplanation(data);
    } catch (error) {
      console.error('Error analyzing confusion:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (initialQuery) {
      handleAnalyze();
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {!explanation && (
        <div className="space-y-8 py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-full text-sm font-bold uppercase tracking-widest">
              <HelpCircle size={16} />
              Confusion Solver
            </div>
            <h2 className="text-4xl font-black tracking-tight">What's confusing you?</h2>
            <p className="text-gray-500 text-lg">Tell us exactly what you don't understand, and we'll break it down into the simplest possible terms.</p>
          </div>

          <div className="bg-white dark:bg-[#111111] p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm space-y-6">
            <div className="space-y-4">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., I don't understand how the Krebs cycle produces ATP, or why we use 'let' instead of 'var' in JavaScript..."
                className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl p-6 focus:ring-2 focus:ring-rose-500 transition-all min-h-[150px] resize-none text-lg"
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={isLoading || !query.trim()}
              className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-rose-700 disabled:opacity-50 transition-all shadow-lg shadow-rose-500/20"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lightbulb size={20} />
                  Explain it simply
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {explanation && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight">Clarity Found</h3>
                <p className="text-gray-500 text-sm">Simplified explanation for your confusion.</p>
              </div>
            </div>
            <button 
              onClick={() => setExplanation(null)}
              className="p-3 bg-black/5 dark:bg-white/5 rounded-xl hover:bg-black/10 transition-all"
            >
              <RefreshCw size={20} />
            </button>
          </div>

          <div className="bg-white dark:bg-[#111111] p-10 md:p-12 rounded-[3rem] border border-black/5 dark:border-white/5 shadow-sm">
            <div className="prose prose-rose dark:prose-invert max-w-none">
              <ReactMarkdown>{explanation}</ReactMarkdown>
            </div>
            
            <div className="mt-12 pt-8 border-t border-black/5 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-full flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <p className="text-sm font-medium text-gray-500">Still confused? Try asking for a different analogy.</p>
              </div>
              <button 
                onClick={() => setExplanation(null)}
                className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:scale-105 transition-all"
              >
                Ask something else
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
