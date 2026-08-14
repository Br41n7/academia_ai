import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Wand2, Info, CheckCircle2, AlertCircle, MessageSquare, BookOpen, Globe, ExternalLink, Image as ImageIcon, X, Swords } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { ACADEMIC_MODES } from '../constants';
import { AcademicMode, ExplanationResponse, TunedQuestionResponse } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { apiFetch } from '../lib/api';

import VisualGenerator from './VisualGenerator';
import ConceptBattle from './ConceptBattle';

interface AskAIProps {
  projectId: string;
}

interface Citation {
  id: string;
  content: string;
}

export default function AskAI({ projectId }: AskAIProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<AcademicMode>('undergraduate');
  const [isLoading, setIsLoading] = useState(false);
  const [isTuning, setIsTuning] = useState(false);
  const [aiResponse, setAiResponse] = useState<{ text: string; sources: any[]; citations: Citation[] } | null>(null);
  const [tunedData, setTunedData] = useState<TunedQuestionResponse | null>(null);
  const [useGrounding, setUseGrounding] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showConceptBattle, setShowConceptBattle] = useState(false);
  const [battleConcepts, setBattleConcepts] = useState<[string, string] | undefined>(undefined);
  const [battleQuery, setBattleQuery] = useState<string | undefined>(undefined);

  const handleChat = async (topicToAsk: string = query) => {
    if (!topicToAsk.trim() || !auth.currentUser) return;
    setIsLoading(true);
    setTunedData(null);
    try {
      const res = await apiFetch('/api/ai/notebook/action', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'chat', 
          project_id: projectId, 
          query: topicToAsk,
          use_grounding: useGrounding,
          user_id: auth.currentUser.uid
        }),
      });
      const data = await res.json();
      setAiResponse(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTune = async () => {
    if (!query.trim()) return;
    setIsTuning(true);
    try {
      const res = await apiFetch('/api/ai/tune-question', {
        method: 'POST',
        body: JSON.stringify({ question: query }),
      });
      const data = await res.json();
      setTunedData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTuning(false);
    }
  };

  return (
    <div className="space-y-8 h-full flex flex-col">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">AI Research Chat</h2>
          <p className="text-gray-500 dark:text-gray-400">Ask questions grounded in your project documents.</p>
        </div>
        <button
          onClick={() => setUseGrounding(!useGrounding)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border",
            useGrounding 
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-600"
              : "bg-white dark:bg-[#111111] border-black/5 dark:border-white/5 text-gray-500"
          )}
        >
          <Globe size={16} />
          Search Grounding
        </button>
      </section>

      {/* Input Area */}
      <div className="bg-white dark:bg-[#111111] p-4 md:p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm space-y-4 shrink-0">
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleChat())}
            placeholder="Ask a question about your documents..."
            className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl p-4 pr-12 min-h-[80px] focus:ring-2 focus:ring-indigo-500 transition-all resize-none text-sm md:text-base"
          />
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={handleTune}
              disabled={isTuning || !query.trim()}
              className="p-2 bg-white dark:bg-black rounded-xl border border-black/5 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-all group"
              title="Improve my question"
            >
              <Wand2 size={18} className={cn("text-indigo-600", isTuning && "animate-pulse")} />
            </button>
            <button
              onClick={() => handleChat()}
              disabled={isLoading || !query.trim()}
              className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              <Search size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-4"
            >
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 animate-pulse">Analyzing project documents...</p>
            </motion.div>
          ) : tunedData ? (
            <motion.div 
              key="tuning"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-6 rounded-3xl space-y-4"
            >
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
                <Sparkles size={20} />
                <span>Question Tuner</span>
              </div>
              
              {tunedData.is_ambiguous && (
                <div className="flex gap-3 p-4 bg-white/50 dark:bg-black/20 rounded-2xl border border-amber-200/50 dark:border-amber-900/20">
                  <AlertCircle className="text-amber-600 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Ambiguity Detected</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">{tunedData.ambiguity_details}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600/70">Improved Version:</p>
                <p className="text-lg font-medium text-amber-900 dark:text-amber-100">{tunedData.improved_question}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setQuery(tunedData.improved_question);
                    handleChat(tunedData.improved_question);
                  }}
                  className="flex-1 py-3 bg-amber-600 text-white rounded-2xl font-medium hover:bg-amber-700 transition-all"
                >
                  Use Improved Question
                </button>
                {(tunedData as any).suggest_concept_battle && (
                  <button
                    onClick={() => {
                      setBattleConcepts((tunedData as any).concepts);
                      setBattleQuery(query);
                      setShowConceptBattle(true);
                    }}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-medium hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Swords size={18} />
                    Start Concept Battle
                  </button>
                )}
              </div>
            </motion.div>
          ) : aiResponse ? (
            <motion.div 
              key="response"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm">
                <div className="flex items-center gap-2 mb-6 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest">
                  <MessageSquare size={14} />
                  AI Response
                </div>

                <div className="prose dark:prose-invert max-w-none">
                  <Markdown>{aiResponse.text}</Markdown>
                </div>

                <div className="mt-6 flex gap-3">
                  <button 
                    onClick={() => setShowVisualizer(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                  >
                    <ImageIcon size={14} />
                    Visualize this Explanation
                  </button>
                  {(aiResponse.text.toLowerCase().includes('concept battle') || aiResponse.text.toLowerCase().includes('compare')) && (
                    <button 
                      onClick={() => {
                        setBattleConcepts(undefined);
                        setBattleQuery(query);
                        setShowConceptBattle(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-500/20"
                    >
                      <Swords size={14} />
                      Start Concept Battle
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {showVisualizer && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-8 pt-8 border-t border-black/5 dark:border-white/5"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-sm uppercase tracking-widest text-indigo-600">Visual Learning Aid</h3>
                        <button onClick={() => setShowVisualizer(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                          <X size={16} />
                        </button>
                      </div>
                      <VisualGenerator projectId={projectId} initialTopic={query} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {aiResponse.citations.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                      <BookOpen size={14} />
                      Citations
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {aiResponse.citations.map((citation, idx) => (
                        <div 
                          key={idx}
                          className="px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-lg text-[10px] text-gray-500 border border-black/5 dark:border-white/5"
                          title={citation.content}
                        >
                          Source {idx + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiResponse.sources.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/5">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                      <Globe size={14} />
                      Web Grounding
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {aiResponse.sources.map((source, idx) => (
                        <a 
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all group"
                        >
                          <span className="text-xs font-medium truncate pr-4">{source.title}</span>
                          <ExternalLink size={12} className="text-gray-400 group-hover:text-indigo-600 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30 py-20"
            >
              <MessageSquare size={64} className="text-gray-300" />
              <div className="max-w-xs">
                <p className="text-lg font-bold">Start a Research Chat</p>
                <p className="text-sm">Ask questions about your uploaded documents or explore new topics with search grounding.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showConceptBattle && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#F8F9FA] dark:bg-[#0A0A0A] w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#111111]">
                  <h3 className="font-bold text-lg">Concept Battle Mode</h3>
                  <button onClick={() => setShowConceptBattle(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                  <ConceptBattle 
                    concepts={battleConcepts} 
                    query={battleQuery} 
                    projectId={projectId}
                    onClose={() => setShowConceptBattle(false)} 
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
