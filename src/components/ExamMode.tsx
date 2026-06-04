import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Clock, 
  BrainCircuit, 
  Target, 
  Play, 
  ShieldAlert, 
  ChevronRight, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Sparkles,
  History,
  BarChart3,
  RefreshCcw,
  Swords,
  BookOpen,
  Image as ImageIcon,
  HelpCircle,
  Flag,
  Calculator,
  Eraser,
  Delete
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  db, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  setDoc, 
  doc, 
  handleFirestoreError, 
  OperationType, 
  auth,
  awardPoints
} from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { generateExam, analyzeExam } from '../services/geminiService';
import { Exam, ExamAttempt } from '../types';
import VisualGenerator from './VisualGenerator';
import ConceptBattle from './ConceptBattle';

interface ExamModeProps {
  projectId: string;
  onNavigate?: (tab: string) => void;
}

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000000';

export default function ExamMode({ projectId, onNavigate }: ExamModeProps) {
  const [user, setUser] = useState<any>(null);
  const [step, setStep] = useState<'landing' | 'setup' | 'session' | 'results' | 'history'>('landing');
  const [isLoading, setIsLoading] = useState(false);
  const [exam, setExam] = useState<Exam | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<Partial<ExamAttempt> | null>(null);
  const [history, setHistory] = useState<ExamAttempt[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, { answer: string; response_time: number; confidence?: number }>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcValue, setCalcValue] = useState('');
  const [startTime, setStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  
  // Follow-up states
  const [showConceptBattle, setShowConceptBattle] = useState(false);
  const [battleConcepts, setBattleConcepts] = useState<[string, string] | undefined>(undefined);
  const [battleQuery, setBattleQuery] = useState<string | undefined>(undefined);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [visualTopic, setVisualTopic] = useState('');

  // Config
  const [config, setConfig] = useState({
    count: 10,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    time_limit: 20,
    question_types: ['multiple_choice', 'true_false', 'short_answer', 'theory', 'concept_trap'],
    is_cbt_mode: false
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (step === 'history' && user) {
      fetchHistory();
    }
  }, [step, user]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'session' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            finishExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const fetchHistory = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'exam_attempts'),
        where('user_id', '==', user.uid),
        where('project_id', '==', projectId),
        orderBy('created_at', 'desc')
      );
      const snapshot = await getDocs(q);
      const list: ExamAttempt[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ExamAttempt);
      });
      setHistory(list);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'exam_attempts');
    } finally {
      setIsLoading(false);
    }
  };

  const startExam = async () => {
    setIsLoading(true);
    try {
      const data = await generateExam(projectId, config);
      setExam(data);
      setStep('session');
      setCurrentIndex(0);
      setUserAnswers({});
      setStartTime(Date.now());
      setTimeLeft(config.time_limit * 60);
    } catch (error) {
      console.error('Failed to generate exam:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (answer: string, confidence?: number) => {
    const now = Date.now();
    const timeSpent = Math.round((now - startTime) / 1000);
    setUserAnswers(prev => ({
      ...prev,
      [exam!.questions[currentIndex].id]: {
        answer,
        response_time: timeSpent,
        confidence
      }
    }));
  };

  const finishExam = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Calculate Score
      let score = 0;
      const processedAnswers: Record<string, any> = {};
      
      exam!.questions.forEach(q => {
        const userAns = userAnswers[q.id];
        const isCorrect = userAns?.answer.toLowerCase() === q.correct_answer.toLowerCase();
        if (isCorrect) score++;
        processedAnswers[q.id] = {
          ...userAns,
          is_correct: isCorrect
        };
      });

      // 2. AI Analysis
      const analysis = await analyzeExam(exam, processedAnswers);

      // 3. Save Attempt
      const attemptId = crypto.randomUUID();
      const attemptData = {
        id: attemptId,
        project_id: projectId,
        user_id: user.uid,
        exam_id: exam!.id || 'generated_exam',
        score,
        total_questions: exam!.questions.length,
        answers: processedAnswers,
        analysis,
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'exam_attempts', attemptId), attemptData);
      
      // 4. Award Points
      const pointsEarned = score * 25; // More points for exams
      await awardPoints(user.uid, pointsEarned);

      setCurrentAttempt(attemptData);
      setStep('results');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'exam_attempts');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <section className="flex items-end justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Exam Mode</h2>
          <p className="text-gray-500 dark:text-gray-400">Simulate real examination conditions and identify deep misconceptions.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep('history')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl text-sm font-medium hover:bg-black/5 transition-all"
          >
            <History size={16} />
            History
          </button>
          {step !== 'landing' && (
            <button
              onClick={() => setStep('landing')}
              className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl text-sm font-medium hover:bg-black/10 transition-all"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          )}
        </div>
      </section>

      <AnimatePresence mode="wait">
        {step === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <div className="bg-white dark:bg-[#111111] p-10 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm space-y-8">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600">
                <ShieldAlert size={32} />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Ready for the Challenge?</h3>
                <p className="text-gray-500 leading-relaxed">
                  Exam Mode creates a high-stakes environment to test your true understanding. 
                  It includes concept traps, theory questions, and timed pressure.
                </p>
              </div>
              <ul className="space-y-3">
                {[
                  'Timed sessions to simulate pressure',
                  'Concept traps to find misconceptions',
                  'Deep theory and short answer questions',
                  'Detailed AI performance analytics'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setStep('setup')}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20"
              >
                <Play size={20} />
                Configure Exam
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-[2rem] border border-amber-100 dark:border-amber-900/20">
                <div className="flex items-center gap-3 mb-4 text-amber-600">
                  <BrainCircuit size={24} />
                  <h4 className="font-bold">Misconception Detection</h4>
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                  Our AI specifically crafts "Concept Trap" questions. These are designed to look correct if you have a common misunderstanding of the topic. Finding these is the fastest way to mastery.
                </p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/10 p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/20">
                <div className="flex items-center gap-3 mb-4 text-indigo-600">
                  <BarChart3 size={24} />
                  <h4 className="font-bold">Learning Analytics</h4>
                </div>
                <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">
                  Every exam builds your long-term profile. We track mastery over time and recommend specific Concept Battles to resolve recurring issues.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-[#111111] p-10 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm max-w-2xl mx-auto space-y-8"
          >
            <h3 className="text-2xl font-bold text-center">Exam Configuration</h3>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['easy', 'medium', 'hard'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setConfig(prev => ({ ...prev, difficulty: d }))}
                      className={cn(
                        "py-3 rounded-xl text-sm font-bold capitalize transition-all",
                        config.difficulty === d 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                          : "bg-black/5 dark:bg-white/5 text-gray-500 hover:bg-black/10"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Question Count</label>
                  <input 
                    type="number" 
                    value={config.count}
                    onChange={e => setConfig(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                    className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Time Limit (Mins)</label>
                  <input 
                    type="number" 
                    value={config.time_limit}
                    onChange={e => setConfig(prev => ({ ...prev, time_limit: parseInt(e.target.value) }))}
                    className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Question Types</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'multiple_choice', label: 'Multiple Choice' },
                    { id: 'true_false', label: 'True/False' },
                    { id: 'short_answer', label: 'Short Answer' },
                    { id: 'theory', label: 'Theory' },
                    { id: 'concept_trap', label: 'Concept Trap' }
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        question_types: prev.question_types.includes(type.id)
                          ? prev.question_types.filter(t => t !== type.id)
                          : [...prev.question_types, type.id]
                      }))}
                      className={cn(
                        "px-4 py-2 rounded-full text-xs font-bold transition-all border",
                        config.question_types.includes(type.id)
                          ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 text-indigo-600"
                          : "bg-transparent border-black/5 dark:border-white/5 text-gray-400"
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CBT Mode Toggle */}
              <div className="bg-black/5 dark:bg-white/5 p-6 rounded-3xl border border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
                      <ShieldAlert size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">CBT Mock Mode</h3>
                      <p className="text-xs text-gray-500">Simulate a real standardized examination environment.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, is_cbt_mode: !config.is_cbt_mode })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      config.is_cbt_mode ? "bg-indigo-600" : "bg-black/10 dark:bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all",
                      config.is_cbt_mode ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={startExam}
              disabled={isLoading || config.question_types.length === 0}
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles size={20} />
                  Generate & Start Exam
                </>
              )}
            </button>
          </motion.div>
        )}

        {step === 'session' && exam && (
          <motion.div
            key="session"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Exam Header */}
            <div className="flex items-center justify-between bg-white dark:bg-[#111111] p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-rose-600 font-bold">
                  <Clock size={20} />
                  <span className="tabular-nums">{formatTime(timeLeft)}</span>
                </div>
                <div className="h-8 w-px bg-black/5 dark:bg-white/5" />
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      const qId = exam.questions[currentIndex].id;
                      setFlaggedQuestions(prev => {
                        const next = new Set(prev);
                        if (next.has(qId)) next.delete(qId);
                        else next.add(qId);
                        return next;
                      });
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      flaggedQuestions.has(exam.questions[currentIndex].id)
                        ? "bg-amber-100 text-amber-600 border border-amber-200"
                        : "bg-black/5 dark:bg-white/5 text-gray-500 hover:bg-black/10"
                    )}
                  >
                    <Flag size={14} fill={flaggedQuestions.has(exam.questions[currentIndex].id) ? "currentColor" : "none"} />
                    {flaggedQuestions.has(exam.questions[currentIndex].id) ? "Flagged" : "Flag for Review"}
                  </button>
                  <button
                    onClick={() => setShowCalculator(!showCalculator)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      showCalculator
                        ? "bg-indigo-100 text-indigo-600 border border-indigo-200"
                        : "bg-black/5 dark:bg-white/5 text-gray-500 hover:bg-black/10"
                    )}
                  >
                    <Calculator size={14} />
                    Calculator
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                  Question {currentIndex + 1} of {exam.questions.length}
                </div>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to finish the exam now?')) {
                      finishExam();
                    }
                  }}
                  className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all"
                >
                  Finish Exam
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Question Area */}
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white dark:bg-[#111111] p-10 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm min-h-[400px] flex flex-col">
                  <div className="flex-1 space-y-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest",
                          exam.questions[currentIndex].type === 'concept_trap' ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
                        )}>
                          {exam.questions[currentIndex].type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Topic: {exam.questions[currentIndex].concept}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold leading-tight">{exam.questions[currentIndex].question}</h3>
                    </div>

                    <div className="space-y-3">
                      {(exam.questions[currentIndex].type === 'multiple_choice' || exam.questions[currentIndex].type === 'concept_trap') && (
                        <div className="grid grid-cols-1 gap-3">
                          {exam.questions[currentIndex].options?.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => handleAnswer(opt)}
                              className={cn(
                                "w-full p-5 rounded-2xl text-left border-2 transition-all",
                                userAnswers[exam.questions[currentIndex].id]?.answer === opt
                                  ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                                  : "border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10"
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                                  userAnswers[exam.questions[currentIndex].id]?.answer === opt
                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                    : "border-gray-300 text-gray-400"
                                )}>
                                  {String.fromCharCode(65 + i)}
                                </div>
                                <span>{opt}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {exam.questions[currentIndex].type === 'true_false' && (
                        <div className="grid grid-cols-2 gap-4">
                          {['True', 'False'].map(opt => (
                            <button
                              key={opt}
                              onClick={() => handleAnswer(opt)}
                              className={cn(
                                "p-8 rounded-2xl border-2 transition-all text-xl font-bold",
                                userAnswers[exam.questions[currentIndex].id]?.answer === opt
                                  ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                                  : "border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10"
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {(exam.questions[currentIndex].type === 'short_answer' || exam.questions[currentIndex].type === 'theory') && (
                        <textarea
                          value={userAnswers[exam.questions[currentIndex].id]?.answer || ''}
                          onChange={e => handleAnswer(e.target.value)}
                          placeholder="Type your answer here..."
                          className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl p-6 min-h-[200px] focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-10 pt-8 border-t border-black/5 dark:border-white/5">
                    <button
                      onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="px-6 py-3 text-gray-500 font-bold hover:text-gray-700 disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => {
                        if (currentIndex < exam.questions.length - 1) {
                          setCurrentIndex(prev => prev + 1);
                        } else {
                          finishExam();
                        }
                      }}
                      className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                    >
                      {currentIndex === exam.questions.length - 1 ? 'Finish Exam' : 'Next Question'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Navigation Grid */}
              <div className="lg:col-span-1 space-y-6">
                <AnimatePresence>
                  {showCalculator && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Calculator</h4>
                        <button onClick={() => setShowCalculator(false)} className="text-gray-400 hover:text-gray-600">
                          <XCircle size={14} />
                        </button>
                      </div>
                      <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl text-right font-mono text-2xl h-16 flex items-center justify-end overflow-hidden">
                        {calcValue || '0'}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'].map(btn => (
                          <button
                            key={btn}
                            onClick={() => {
                              if (btn === '=') {
                                try {
                                  // Simple eval for demo purposes, in real app use a math library
                                  setCalcValue(eval(calcValue).toString());
                                } catch {
                                  setCalcValue('Error');
                                }
                              } else {
                                setCalcValue(prev => prev === 'Error' ? btn : prev + btn);
                              }
                            }}
                            className="p-3 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-bold hover:bg-black/10 transition-all"
                          >
                            {btn}
                          </button>
                        ))}
                        <button
                          onClick={() => setCalcValue('')}
                          className="col-span-2 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-lg text-sm font-bold hover:bg-rose-100 transition-all"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setCalcValue(prev => prev.slice(0, -1))}
                          className="col-span-2 p-3 bg-black/5 dark:bg-white/5 rounded-lg text-sm font-bold hover:bg-black/10 transition-all flex items-center justify-center"
                        >
                          <Delete size={16} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Question Navigator</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {exam.questions.map((q, i) => (
                      <button
                        key={q.id}
                        onClick={() => setCurrentIndex(i)}
                        className={cn(
                          "aspect-square rounded-lg text-xs font-bold transition-all border relative",
                          currentIndex === i 
                            ? "bg-indigo-600 text-white border-indigo-600" 
                            : userAnswers[q.id]
                              ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 text-indigo-600"
                              : "bg-black/5 dark:bg-white/5 border-transparent text-gray-400"
                        )}
                      >
                        {i + 1}
                        {flaggedQuestions.has(q.id) && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white dark:border-[#111111]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {!config.is_cbt_mode && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-100 dark:border-amber-900/20">
                    <div className="flex items-center gap-2 mb-2 text-amber-600">
                      <AlertTriangle size={16} />
                      <span className="text-xs font-bold uppercase tracking-widest">Confidence Check</span>
                    </div>
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 mb-4">How confident are you in your current answer?</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(level => (
                        <button
                          key={level}
                          onClick={() => handleAnswer(userAnswers[exam.questions[currentIndex].id]?.answer || '', level)}
                          className={cn(
                            "flex-1 aspect-square rounded-lg text-xs font-bold transition-all border",
                            userAnswers[exam.questions[currentIndex].id]?.confidence === level
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-white dark:bg-black/20 border-amber-200 text-amber-600 hover:bg-amber-100"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'results' && currentAttempt && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            {/* Summary Card */}
            <div className="bg-white dark:bg-[#111111] p-12 rounded-[3rem] border border-black/5 dark:border-white/5 shadow-sm text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
              <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy size={48} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-4xl font-black mb-2">Exam Result</h3>
              <p className="text-gray-500 mb-8">You scored {currentAttempt.score} out of {currentAttempt.total_questions}</p>
              
              <div className="text-8xl font-black text-indigo-600 dark:text-indigo-400 mb-10">
                {Math.round((currentAttempt.score / currentAttempt.total_questions) * 100)}%
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="p-6 bg-black/5 dark:bg-white/5 rounded-3xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Time Spent</p>
                  <p className="text-xl font-bold">24:12</p>
                </div>
                <div className="p-6 bg-black/5 dark:bg-white/5 rounded-3xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Avg Confidence</p>
                  <p className="text-xl font-bold">4.2/5</p>
                </div>
                <div className="p-6 bg-black/5 dark:bg-white/5 rounded-3xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Accuracy</p>
                  <p className="text-xl font-bold">High</p>
                </div>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white dark:bg-[#111111] p-10 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm space-y-8">
                  <div className="flex items-center gap-3 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                    <Sparkles size={18} />
                    AI Performance Analysis
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="font-bold flex items-center gap-2">
                        <Target size={18} className="text-emerald-500" />
                        Topic Mastery
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries((currentAttempt.analysis?.topic_mastery as Record<string, number>) || {}).map(([topic, score]) => (
                          <div key={topic} className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                              <span>{topic as string}</span>
                              <span className="text-indigo-600">{score as number}%</span>
                            </div>
                            <div className="h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-600 transition-all duration-1000" 
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-black/5 dark:border-white/5">
                      <div className="space-y-4">
                        <h4 className="font-bold flex items-center gap-2 text-rose-600">
                          <AlertTriangle size={18} />
                          Weak Concepts
                        </h4>
                        <div className="flex flex-wrap gap-3">
                          {currentAttempt.analysis?.weak_concepts.map(concept => (
                            <div key={concept} className="flex items-center gap-1.5 group">
                              <span className="px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-full text-xs font-bold">
                                {concept}
                              </span>
                              <button
                                onClick={() => {
                                  setVisualTopic(`Detailed visual explanation of ${concept}`);
                                  setShowVisualizer(true);
                                }}
                                className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full hover:bg-indigo-100 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                title={`Visualize ${concept}`}
                              >
                                <ImageIcon size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-bold flex items-center gap-2 text-amber-600">
                          <ShieldAlert size={18} />
                          Misconceptions
                        </h4>
                        <div className="space-y-3">
                          {currentAttempt.analysis?.misconceptions.map((m, i) => (
                            <div key={i} className="flex items-start gap-2 group">
                              <p className="text-xs text-gray-500 leading-relaxed flex-1">• {m}</p>
                              <button
                                onClick={() => {
                                  setVisualTopic(`Visual explanation to correct this misconception: ${m}`);
                                  setShowVisualizer(true);
                                }}
                                className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full hover:bg-indigo-100 transition-all shadow-sm opacity-0 group-hover:opacity-100 shrink-0"
                                title="Visualize to correct misconception"
                              >
                                <ImageIcon size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Question Review */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 px-2">Detailed Review</h4>
                  {exam?.questions.map((q, i) => {
                    const userAns = currentAttempt.answers[q.id];
                    return (
                      <div key={q.id} className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-black/5 dark:border-white/5 flex gap-6">
                        <div className="shrink-0">
                          {userAns?.is_correct ? (
                            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600">
                              <CheckCircle2 size={24} />
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center text-rose-600">
                              <XCircle size={24} />
                            </div>
                          )}
                        </div>
                        <div className="space-y-4 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{q.type.replace('_', ' ')}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confidence: {userAns?.confidence || 'N/A'}/5</span>
                          </div>
                          <p className="font-bold text-lg">{q.question}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Your Answer</p>
                              <p className={userAns?.is_correct ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{userAns?.answer || 'No answer'}</p>
                            </div>
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Correct Answer</p>
                              <p className="text-emerald-700 dark:text-emerald-300 font-bold">{q.correct_answer}</p>
                            </div>
                          </div>
                          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20">
                            <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed italic">{q.explanation}</p>
                          </div>
                          {q.type === 'concept_trap' && !userAns?.is_correct && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Trap Detected</p>
                              <p className="text-xs text-amber-700 dark:text-amber-300">{q.trap_details}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recommendations Sidebar */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-[#111111] p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm space-y-6">
                  <h4 className="font-bold flex items-center gap-2">
                    <RefreshCcw size={18} className="text-indigo-600" />
                    Recommended Actions
                  </h4>
                  <div className="space-y-3">
                    {currentAttempt.analysis?.recommendations.map((rec, i) => (
                      <div key={i} className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        {rec}
                      </div>
                    ))}
                  </div>
                  
                  <div className="space-y-3 pt-6 border-t border-black/5 dark:border-white/5">
                    <button
                      onClick={() => {
                        setBattleQuery(`The user struggled with these concepts in their recent exam: ${currentAttempt.analysis?.weak_concepts.join(', ')}. Misconceptions identified: ${currentAttempt.analysis?.misconceptions.join(', ')}. Start a battle to clarify.`);
                        setShowConceptBattle(true);
                      }}
                      className="w-full py-4 bg-amber-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-700 transition-all"
                    >
                      <Swords size={18} />
                      Start Concept Battle
                    </button>
                    <button
                      onClick={() => {
                        setVisualTopic(`Summary of weak concepts: ${currentAttempt.analysis?.weak_concepts.join(', ')}`);
                        setShowVisualizer(true);
                      }}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
                    >
                      <ImageIcon size={18} />
                      Visual Study Pack
                    </button>
                    <button
                      onClick={() => onNavigate?.('quiz')}
                      className="w-full py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black/10 transition-all"
                    >
                      <HelpCircle size={18} />
                      Targeted Quiz
                    </button>
                    <button
                      onClick={() => onNavigate?.('flashcards')}
                      className="w-full py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black/10 transition-all"
                    >
                      <Sparkles size={18} />
                      Flashcards Review
                    </button>
                    <button
                      onClick={() => setStep('setup')}
                      className="w-full py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black/10 transition-all"
                    >
                      <RefreshCcw size={18} />
                      Retake Exam
                    </button>
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-8 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/20">
                  <h4 className="font-bold text-emerald-600 mb-4 flex items-center gap-2">
                    <Trophy size={18} />
                    Long-term Progress
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-emerald-700">Overall Mastery</span>
                      <span className="text-emerald-600">72%</span>
                    </div>
                    <div className="h-2 bg-white dark:bg-black/20 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: '72%' }} />
                    </div>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                      Your mastery has increased by 12% since your last exam. Keep focusing on the weak concepts identified above!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Exam History</h3>
              <p className="text-sm text-gray-500">{history.length} attempts recorded</p>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading your progress...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="bg-white dark:bg-[#111111] p-20 rounded-[3rem] border border-black/5 dark:border-white/5 text-center space-y-4">
                <History size={64} className="text-gray-200 mx-auto" />
                <div className="max-w-xs mx-auto">
                  <p className="text-lg font-bold">No history yet</p>
                  <p className="text-sm text-gray-500">Complete your first exam to start building your learning profile.</p>
                </div>
                <button
                  onClick={() => setStep('setup')}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                >
                  Start First Exam
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {history.map(attempt => (
                  <button
                    key={attempt.id}
                    onClick={() => {
                      setCurrentAttempt(attempt);
                      setStep('results');
                    }}
                    className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-black/5 dark:border-white/5 flex items-center justify-between hover:border-indigo-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black",
                        (attempt.score / attempt.total_questions) >= 0.7 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                      )}>
                        <span className="text-xl">{Math.round((attempt.score / attempt.total_questions) * 100)}%</span>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-lg">Exam Attempt</p>
                        <p className="text-xs text-gray-400">{new Date(attempt.created_at).toLocaleDateString()} at {new Date(attempt.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right hidden md:block">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Score</p>
                        <p className="font-bold">{attempt.score}/{attempt.total_questions}</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Weak Concepts</p>
                        <p className="font-bold text-rose-600">{attempt.analysis?.weak_concepts.length || 0}</p>
                      </div>
                      <ChevronRight size={24} className="text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals for follow-up */}
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
                  <ArrowLeft className="rotate-180" size={20} />
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

      <AnimatePresence>
        {showVisualizer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#F8F9FA] dark:bg-[#0A0A0A] w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#111111]">
                <h3 className="font-bold text-lg">Visual Study Aid</h3>
                <button onClick={() => setShowVisualizer(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                  <ArrowLeft className="rotate-180" size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                <VisualGenerator projectId={projectId} initialTopic={visualTopic} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
