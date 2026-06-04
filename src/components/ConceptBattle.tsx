import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Swords, 
  Shield, 
  Zap, 
  Target, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  RefreshCw,
  Info,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { conceptBattle } from '../services/geminiService';

interface ConceptBattleProps {
  projectId: string;
  query?: string;
  concepts?: [string, string];
  onClose?: () => void;
}

export default function ConceptBattle({ projectId, query, concepts, onClose }: ConceptBattleProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [battleData, setBattleData] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  useEffect(() => {
    const startBattle = async () => {
      setIsLoading(true);
      try {
        const data = await conceptBattle(query, projectId, concepts);
        setBattleData(data);
      } catch (error) {
        console.error('Error starting concept battle:', error);
      } finally {
        setIsLoading(false);
      }
    };

    startBattle();
  }, [query, projectId, concepts]);

  const handleAnswer = (answer: string) => {
    if (isAnswered) return;
    setSelectedAnswer(answer);
    setIsAnswered(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
            <Swords size={32} className="animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-black tracking-tight animate-pulse">Preparing the Arena...</p>
          <p className="text-gray-500 text-sm">Analyzing concepts and identifying key differences.</p>
        </div>
      </div>
    );
  }

  if (!battleData) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/20 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <XCircle size={32} />
        </div>
        <h3 className="text-2xl font-bold">Battle Failed</h3>
        <p className="text-gray-500">We couldn't generate a battle for these concepts. Try a different query.</p>
        <button onClick={onClose} className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-full text-sm font-bold uppercase tracking-widest">
          <Swords size={16} />
          Concept Battle Mode
        </div>
        <div className="flex items-center justify-center gap-8">
          <h2 className="text-4xl font-black tracking-tight text-indigo-600">{battleData.concepts[0]}</h2>
          <span className="text-6xl font-black italic text-gray-200 dark:text-white/10">VS</span>
          <h2 className="text-4xl font-black tracking-tight text-rose-600">{battleData.concepts[1]}</h2>
        </div>
      </header>

      {/* Comparison Table */}
      <div className="bg-white dark:bg-[#111111] rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <Target size={16} />
            Key Differences
          </h3>
        </div>
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {battleData.comparison.map((row: any, i: number) => (
            <div key={i} className="grid grid-cols-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <div className="p-6 border-r border-black/5 dark:border-white/5 flex items-center">
                <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">{row.feature}</span>
              </div>
              <div className="p-6 border-r border-black/5 dark:border-white/5">
                <p className="text-indigo-600 font-medium">{row.concept1}</p>
              </div>
              <div className="p-6">
                <p className="text-rose-600 font-medium">{row.concept2}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analogy & Scenario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/20 space-y-4">
          <div className="flex items-center gap-3 text-indigo-600 font-bold uppercase tracking-widest text-xs">
            <Zap size={16} />
            The Analogy
          </div>
          <p className="text-lg font-medium leading-relaxed italic text-indigo-900 dark:text-indigo-100">
            "{battleData.analogy}"
          </p>
        </div>
        <div className="p-8 bg-rose-50 dark:bg-rose-900/10 rounded-[2rem] border border-rose-100 dark:border-rose-900/20 space-y-4">
          <div className="flex items-center gap-3 text-rose-600 font-bold uppercase tracking-widest text-xs">
            <Shield size={16} />
            Real-World Scenario
          </div>
          <p className="text-lg font-medium leading-relaxed text-rose-900 dark:text-rose-100">
            {battleData.scenario}
          </p>
        </div>
      </div>

      {/* Battle Quiz */}
      <div className="bg-black dark:bg-white text-white dark:text-black p-10 rounded-[3rem] space-y-8 shadow-2xl">
        <div className="flex items-center gap-3 text-indigo-400 dark:text-indigo-600 font-bold uppercase tracking-widest text-xs">
          <Sparkles size={16} />
          Final Battle Challenge
        </div>
        <h3 className="text-2xl font-bold leading-tight">{battleData.quiz_question.question}</h3>
        
        <div className="grid grid-cols-1 gap-3">
          {battleData.quiz_question.options.map((opt: string, i: number) => {
            const isCorrect = opt === battleData.quiz_question.correct_answer;
            const isSelected = selectedAnswer === opt;
            
            return (
              <button
                key={i}
                onClick={() => handleAnswer(opt)}
                disabled={isAnswered}
                className={cn(
                  "p-5 rounded-2xl text-left border-2 transition-all flex items-center justify-between group",
                  isAnswered
                    ? isCorrect
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 dark:text-emerald-600"
                      : isSelected
                        ? "border-rose-500 bg-rose-500/10 text-rose-400 dark:text-rose-600"
                        : "border-white/10 dark:border-black/10 opacity-30"
                    : "border-white/10 dark:border-black/10 hover:border-white/30 dark:hover:border-black/30 hover:bg-white/5 dark:hover:bg-black/5"
                )}
              >
                <span className="font-bold">{opt}</span>
                {isAnswered && (isCorrect ? <CheckCircle2 size={20} /> : isSelected ? <XCircle size={20} /> : null)}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-6 bg-white/5 dark:bg-black/5 rounded-2xl border border-white/10 dark:border-black/10 space-y-2"
            >
              <div className="flex items-center gap-2 text-indigo-400 dark:text-indigo-600 font-bold text-xs uppercase tracking-widest">
                <Info size={14} />
                Battle Analysis
              </div>
              <p className="text-sm opacity-80 leading-relaxed">
                {battleData.quiz_question.explanation}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {isAnswered && (
          <button
            onClick={onClose}
            className="w-full py-4 bg-white dark:bg-black text-black dark:text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            End Battle
            <ArrowRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
