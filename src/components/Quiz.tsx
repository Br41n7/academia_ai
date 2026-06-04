import React, { useState, useEffect } from 'react';
import { BrainCircuit, Play, CheckCircle2, XCircle, RefreshCcw, ArrowRight, Image as ImageIcon, X, Swords, Bookmark, BookmarkCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { QuizQuestion, SavedQuestion } from '../types';
import VisualGenerator from './VisualGenerator';
import ConceptBattle from './ConceptBattle';
import { db, collection, setDoc, doc, handleFirestoreError, OperationType, auth, awardPoints, getDocs, query, where } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { generateQuiz as generateQuizAi } from '../services/geminiService';

interface QuizProps {
  projectId: string;
}

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000000';

export default function Quiz({ projectId }: QuizProps) {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentStep, setCurrentStep] = useState<'setup' | 'quiz' | 'results'>('setup');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showConceptBattle, setShowConceptBattle] = useState(false);
  const [battleQuery, setBattleQuery] = useState('');
  const [visualTopic, setVisualTopic] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedQuestionIds, setSavedQuestionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchSavedQuestions = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(collection(db, 'saved_questions'), where('user_id', '==', auth.currentUser.uid), where('project_id', '==', projectId));
        const snapshot = await getDocs(q);
        const ids = new Set(snapshot.docs.map(d => d.data().id));
        setSavedQuestionIds(ids);
      } catch (error) {
        console.error('Error fetching saved questions:', error);
      }
    };
    fetchSavedQuestions();
  }, [projectId]);

  useEffect(() => {
    if (currentStep === 'results' && score / questions.length < 0.5) {
      const weakQuestions = questions.filter(q => userAnswers[q.id]?.toLowerCase() !== q.correct_answer.toLowerCase());
      setBattleQuery(`The user missed these questions: ${weakQuestions.map(q => q.question).join('; ')}. Identify the core concepts they are confused about and start a battle.`);
      setShowConceptBattle(true);
    }
  }, [currentStep]);

  const saveQuestion = async (q: QuizQuestion) => {
    if (!auth.currentUser) return;
    try {
      const savedQuestion: SavedQuestion = {
        ...q,
        project_id: projectId,
        user_id: auth.currentUser.uid,
        saved_at: new Date().toISOString()
      };
      await setDoc(doc(db, 'saved_questions', q.id), savedQuestion);
      setSavedQuestionIds(prev => new Set(prev).add(q.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'saved_questions');
    }
  };

  const startQuiz = async () => {
    setIsLoading(true);
    try {
      const quizData = await generateQuizAi(topic, difficulty, projectId);
      setQuestions(quizData.questions);
      setCurrentStep('quiz');
      setCurrentIndex(0);
      setUserAnswers({});
      setIsAnswered(false);
      setScore(0);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveResults = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const attemptId = uuidv4();
      await setDoc(doc(db, 'quiz_attempts', attemptId), {
        id: attemptId,
        project_id: projectId,
        score,
        total_questions: questions.length,
        user_id: auth.currentUser.uid,
        created_at: new Date().toISOString()
      });

      // Award Points
      if (auth.currentUser) {
        const pointsEarned = score * 10; // 10 points per correct answer
        awardPoints(auth.currentUser.uid, pointsEarned);
      }
      const pointsToAward = score * 10;
      const profileId = auth.currentUser.uid;
      // We'll just update a 'profiles' collection for gamification
      // For now, let's just save the attempt.
      
      alert(`Results saved! You earned ${pointsToAward} points!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quiz_attempts');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnswer = (answer: string) => {
    if (isAnswered) return;
    setUserAnswers(prev => ({ ...prev, [questions[currentIndex].id]: answer }));
  };

  const submitAnswer = () => {
    const q = questions[currentIndex];
    const isCorrect = userAnswers[q.id]?.toLowerCase() === q.correct_answer.toLowerCase();
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    setIsAnswered(true);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsAnswered(false);
    } else {
      setCurrentStep('results');
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Smart Quiz Engine</h2>
        <p className="text-gray-500 dark:text-gray-400">Test your knowledge with AI-generated adaptive quizzes.</p>
      </section>

      <AnimatePresence mode="wait">
        {currentStep === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm space-y-6"
          >
            <div className="space-y-4">
              <label className="block text-sm font-bold uppercase tracking-wider text-gray-400">What do you want to be tested on?</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Quantum Physics, French Revolution, Python Lists"
                className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold uppercase tracking-wider text-gray-400">Difficulty Level</label>
              <div className="grid grid-cols-3 gap-3">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "py-3 rounded-xl text-sm font-medium capitalize transition-all",
                      difficulty === d 
                        ? "bg-indigo-600 text-white" 
                        : "bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startQuiz}
              disabled={isLoading || !topic.trim()}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Play size={20} />
                  Start Assessment
                </>
              )}
            </button>
          </motion.div>
        )}

        {currentStep === 'quiz' && questions.length > 0 && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Question {currentIndex + 1} of {questions.length}
              </div>
              <div className="w-32 h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-300" 
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm">
              <h3 className="text-xl font-semibold mb-8">{questions[currentIndex].question}</h3>

              <div className="space-y-3">
                {questions[currentIndex].type === 'multiple_choice' && questions[currentIndex].options?.map((opt, i) => {
                  const isSelected = userAnswers[questions[currentIndex].id] === opt;
                  const isCorrect = opt.toLowerCase() === questions[currentIndex].correct_answer.toLowerCase();
                  const userWasWrong = isAnswered && isSelected && !isCorrect;
                  const showAsCorrect = isAnswered && isCorrect;
                  
                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(opt)}
                      disabled={isAnswered}
                      className={cn(
                        "w-full p-4 rounded-2xl text-left border-2 transition-all relative overflow-hidden",
                        isAnswered
                          ? showAsCorrect
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                            : isSelected
                              ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300"
                              : "border-transparent bg-black/5 dark:bg-white/5 opacity-50"
                          : isSelected
                            ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                            : "border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{opt}</span>
                        {isAnswered && (isCorrect ? <CheckCircle2 size={18} /> : isSelected ? <XCircle size={18} /> : null)}
                      </div>
                    </button>
                  );
                })}

                {questions[currentIndex].type === 'true_false' && (
                  <div className="grid grid-cols-2 gap-4">
                    {['True', 'False'].map((opt) => {
                      const isSelected = userAnswers[questions[currentIndex].id] === opt;
                      const isCorrect = opt.toLowerCase() === questions[currentIndex].correct_answer.toLowerCase();
                      const showAsCorrect = isAnswered && isCorrect;
                      
                      return (
                        <button
                          key={opt}
                          onClick={() => handleAnswer(opt)}
                          disabled={isAnswered}
                          className={cn(
                            "p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2",
                            isAnswered
                              ? showAsCorrect
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                                : isSelected
                                  ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300"
                                  : "border-transparent bg-black/5 dark:bg-white/5 opacity-50"
                              : isSelected
                                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                                : "border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                          )}
                        >
                          {opt}
                          {isAnswered && (isCorrect ? <CheckCircle2 size={18} /> : isSelected ? <XCircle size={18} /> : null)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {questions[currentIndex].type === 'fill_blank' && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={userAnswers[questions[currentIndex].id] || ''}
                      onChange={(e) => handleAnswer(e.target.value)}
                      disabled={isAnswered}
                      placeholder="Type your answer here..."
                      className={cn(
                        "w-full border-none rounded-2xl p-4 focus:ring-2 transition-all",
                        isAnswered
                          ? userAnswers[questions[currentIndex].id]?.toLowerCase() === questions[currentIndex].correct_answer.toLowerCase()
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500"
                            : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500"
                          : "bg-black/5 dark:bg-white/5 focus:ring-indigo-500"
                      )}
                    />
                    {isAnswered && userAnswers[questions[currentIndex].id]?.toLowerCase() !== questions[currentIndex].correct_answer.toLowerCase() && (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium px-2">
                        Correct answer: {questions[currentIndex].correct_answer}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {isAnswered && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-6 p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest">
                        <BrainCircuit size={14} />
                        Explanation
                      </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                              setVisualTopic(questions[currentIndex].explanation);
                              setShowVisualizer(true);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                          >
                            <ImageIcon size={10} />
                            Visualize
                          </button>
                          <button 
                            onClick={() => saveQuestion(questions[currentIndex])}
                            disabled={savedQuestionIds.has(questions[currentIndex].id)}
                            className={cn(
                              "text-[10px] font-bold flex items-center gap-1",
                              savedQuestionIds.has(questions[currentIndex].id) ? "text-emerald-600" : "text-gray-500 hover:text-indigo-600"
                            )}
                          >
                            {savedQuestionIds.has(questions[currentIndex].id) ? (
                              <>
                                <BookmarkCheck size={10} />
                                Saved
                              </>
                            ) : (
                              <>
                                <Bookmark size={10} />
                                Save for Review
                              </>
                            )}
                          </button>
                        </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {questions[currentIndex].explanation}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={isAnswered ? nextQuestion : submitAnswer}
                disabled={!userAnswers[questions[currentIndex].id]}
                className={cn(
                  "mt-10 w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                  isAnswered 
                    ? "bg-black dark:bg-white text-white dark:text-black hover:opacity-90"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                )}
              >
                {isAnswered 
                  ? currentIndex === questions.length - 1 ? 'See Results' : 'Next Question'
                  : 'Submit Answer'
                }
                <ArrowRight size={20} />
              </button>
            </div>
          </motion.div>
        )}

        {currentStep === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-[#111111] p-10 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm text-center">
              <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <BrainCircuit size={48} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-3xl font-bold mb-2">Assessment Complete!</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8">You scored {score} out of {questions.length}</p>
              
              <div className="text-6xl font-black text-indigo-600 dark:text-indigo-400 mb-10">
                {Math.round((score / questions.length) * 100)}%
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    const weakQuestions = questions.filter(q => userAnswers[q.id]?.toLowerCase() !== q.correct_answer.toLowerCase());
                    setVisualTopic(`Weak areas in: ${weakQuestions.map(q => q.question).join(', ')}`);
                    setShowVisualizer(true);
                  }}
                  className="py-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all"
                >
                  <ImageIcon size={20} />
                  Visualize Weak Areas
                </button>
                <button
                  onClick={() => {
                    const weakQuestions = questions.filter(q => userAnswers[q.id]?.toLowerCase() !== q.correct_answer.toLowerCase());
                    setBattleQuery(`The user missed these questions: ${weakQuestions.map(q => q.question).join('; ')}. Identify the core concepts they are confused about and start a battle.`);
                    setShowConceptBattle(true);
                  }}
                  className="py-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-100 transition-all"
                >
                  <Swords size={20} />
                  Concept Battle (Weak Areas)
                </button>
                <button
                  onClick={() => setCurrentStep('setup')}
                  className="py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black/10 transition-all"
                >
                  <RefreshCcw size={20} />
                  Try Another
                </button>
                <button
                  onClick={saveResults}
                  disabled={isSaving}
                  className="py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Results'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 px-2">Review Answers</h4>
              {questions.map((q, i) => {
                const isCorrect = userAnswers[q.id]?.toLowerCase() === q.correct_answer.toLowerCase();
                return (
                  <div key={q.id} className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-black/5 dark:border-white/5 flex gap-4">
                    <div className="shrink-0 mt-1">
                      {isCorrect ? <CheckCircle2 className="text-emerald-500" /> : <XCircle className="text-rose-500" />}
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-medium">{q.question}</p>
                        <button 
                          onClick={() => saveQuestion(q)}
                          disabled={savedQuestionIds.has(q.id)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            savedQuestionIds.has(q.id) ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-400 hover:text-indigo-600"
                          )}
                        >
                          {savedQuestionIds.has(q.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <p><span className="text-gray-400">Your answer:</span> <span className={isCorrect ? "text-emerald-600" : "text-rose-600"}>{userAnswers[q.id]}</span></p>
                        {!isCorrect && <p><span className="text-gray-400">Correct:</span> <span className="text-emerald-600">{q.correct_answer}</span></p>}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 p-3 rounded-xl italic">
                        {q.explanation}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
          {showVisualizer && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#F8F9FA] dark:bg-[#0A0A0A] w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#111111]">
                  <h3 className="font-bold text-lg">Visual Learning Aid</h3>
                  <button onClick={() => setShowVisualizer(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                  <VisualGenerator projectId={projectId} initialTopic={visualTopic} />
                </div>
              </motion.div>
            </div>
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
                    projectId={projectId}
                    query={battleQuery} 
                    onClose={() => setShowConceptBattle(false)} 
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
}
