import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  ChevronRight, 
  CheckCircle2, 
  PlayCircle, 
  Lock, 
  Trophy, 
  ArrowLeft, 
  Sparkles,
  BrainCircuit,
  Lightbulb,
  HelpCircle,
  Image as ImageIcon,
  Swords,
  ShieldAlert,
  BarChart3,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { db, collection, query, where, getDocs, setDoc, doc, auth, awardPoints, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { generateCourseAi } from '../services/geminiService';
import { Course, CourseProgress, CourseLesson } from '../types';
import ConceptBattle from './ConceptBattle';
import VisualGenerator from './VisualGenerator';

interface CourseBuilderProps {
  projectId: string;
  onNavigate?: (tab: string) => void;
}

export default function CourseBuilder({ projectId, onNavigate }: CourseBuilderProps) {
  const [user, setUser] = useState<any>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

  // Follow-up states
  const [showConceptBattle, setShowConceptBattle] = useState(false);
  const [battleConcepts, setBattleConcepts] = useState<[string, string] | undefined>(undefined);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [visualTopic, setVisualTopic] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (projectId && user) {
      fetchCourse();
    }
  }, [projectId, user]);

  const fetchCourse = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'courses'), 
        where('project_id', '==', projectId),
        where('user_id', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const courseData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Course;
        setCourse(courseData);
        fetchProgress(courseData.id);
      } else {
        setCourse(null);
        setProgress(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'courses');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProgress = async (courseId: string) => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'course_progress'),
        where('course_id', '==', courseId),
        where('user_id', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setProgress({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CourseProgress);
      } else {
        const initialProgress = {
          course_id: courseId,
          user_id: user.uid,
          completed_lessons: [],
          quiz_scores: {},
          last_accessed: new Date().toISOString()
        };
        setProgress(initialProgress as any);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'course_progress');
    }
  };

  const generateCourse = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await generateCourseAi(projectId);
      const courseId = data.id || crypto.randomUUID();
      const courseData = { 
        ...data, 
        id: courseId, 
        project_id: projectId, 
        user_id: user.uid,
        created_at: new Date().toISOString() 
      };
      
      await setDoc(doc(db, 'courses', courseId), courseData);
      setCourse(courseData);
      fetchProgress(courseId);
    } catch (error) {
      console.error('Failed to generate course:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const completeLesson = async (lessonId: string, score?: number) => {
    if (!course || !user || !progress) return;
    try {
      const updatedCompletedLessons = Array.from(new Set([...(progress.completed_lessons || []), lessonId]));
      const updatedQuizScores = { ...(progress.quiz_scores || {}), [lessonId]: score ?? 100 };
      
      const updatedProgress = {
        ...progress,
        completed_lessons: updatedCompletedLessons,
        quiz_scores: updatedQuizScores,
        last_accessed: new Date().toISOString()
      };

      const progressId = progress.id || `${user.uid}_${course.id}`;
      await setDoc(doc(db, 'course_progress', progressId), {
        ...updatedProgress,
        id: progressId,
        course_id: course.id,
        user_id: user.uid
      });
      
      setProgress(updatedProgress as any);
      
      // Award points for completing a lesson
      await awardPoints(user.uid, 50);
      if (score && score >= 70) {
        await awardPoints(user.uid, 20); // Bonus for good quiz score
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'course_progress');
    }
  };

  const handleQuizSubmit = () => {
    if (!activeLesson) return;
    let score = 0;
    activeLesson.practice_questions.forEach(q => {
      if (userAnswers[q.id] === q.correct_answer) score++;
    });
    const percentage = Math.round((score / activeLesson.practice_questions.length) * 100);
    setQuizScore(percentage);
    completeLesson(activeLesson.id, percentage);
  };

  if (isLoading && !course) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Building your custom course...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-8">
        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600">
          <BookOpen size={40} />
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">Transform Materials into a Course</h2>
          <p className="text-gray-500 leading-relaxed">
            Our AI will analyze your uploaded documents, notes, and transcripts to create a structured learning path with modules, lessons, and practice exercises.
          </p>
        </div>
        <button
          onClick={generateCourse}
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20"
        >
          <Sparkles size={20} />
          Generate Structured Course
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <AnimatePresence mode="wait">
        {!activeLesson ? (
          <motion.div
            key="course-overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Course Header */}
            <section className="bg-white dark:bg-[#111111] p-10 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm flex flex-col md:flex-row gap-8 items-center">
              <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shrink-0 shadow-xl shadow-indigo-500/20">
                <BookOpen size={40} />
              </div>
              <div className="flex-1 text-center md:text-left space-y-2">
                <h2 className="text-3xl font-bold">{course.title}</h2>
                <p className="text-gray-500 max-w-2xl">{course.description}</p>
                <div className="flex flex-wrap gap-4 pt-2 justify-center md:justify-start">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <PlayCircle size={16} className="text-indigo-600" />
                    {course.modules.reduce((acc, m) => acc + m.lessons.length, 0)} Lessons
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    {progress?.completed_lessons.length || 0} Completed
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigate?.('exam')}
                className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20"
              >
                <ShieldAlert size={18} />
                Exam Mode
              </button>
            </section>

            {/* Modules List */}
            <div className="grid grid-cols-1 gap-6">
              {course.modules.map((module, mIdx) => (
                <div key={module.id} className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 bg-black dark:bg-white text-white dark:text-black rounded-lg flex items-center justify-center font-bold text-sm">
                      {mIdx + 1}
                    </div>
                    <h3 className="text-xl font-bold">{module.title}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {module.lessons.map((lesson, lIdx) => {
                      const isCompleted = progress?.completed_lessons.includes(lesson.id);
                      const isLocked = mIdx > 0 && !course.modules[mIdx-1].lessons.every(l => progress?.completed_lessons.includes(l.id));
                      
                      return (
                        <button
                          key={lesson.id}
                          disabled={isLocked}
                          onClick={() => setActiveLesson(lesson)}
                          className={cn(
                            "p-6 rounded-3xl border text-left transition-all group relative overflow-hidden",
                            isCompleted 
                              ? "bg-emerald-50/50 dark:bg-emerald-900/5 border-emerald-100 dark:border-emerald-900/20" 
                              : isLocked
                                ? "bg-gray-50 dark:bg-white/5 border-transparent opacity-60 grayscale cursor-not-allowed"
                                : "bg-white dark:bg-[#111111] border-black/5 dark:border-white/5 hover:border-indigo-500/30"
                          )}
                        >
                          <div className="space-y-4 relative z-10">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lesson {lIdx + 1}</span>
                              {isCompleted ? (
                                <CheckCircle2 size={18} className="text-emerald-500" />
                              ) : isLocked ? (
                                <Lock size={18} className="text-gray-400" />
                              ) : (
                                <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                              )}
                            </div>
                            <h4 className="font-bold leading-tight">{lesson.title}</h4>
                            {progress?.quiz_scores[lesson.id] !== undefined && (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500" 
                                    style={{ width: `${progress.quiz_scores[lesson.id]}%` }} 
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-emerald-600">{progress.quiz_scores[lesson.id]}%</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="lesson-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full space-y-6"
          >
            {/* Lesson Header */}
            <div className="flex items-center justify-between bg-white dark:bg-[#111111] p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setActiveLesson(null);
                    setQuizMode(false);
                    setQuizScore(null);
                    setUserAnswers({});
                  }}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h3 className="font-bold text-lg">{activeLesson.title}</h3>
                  <p className="text-xs text-gray-400 font-medium">Module: {course.modules.find(m => m.lessons.some(l => l.id === activeLesson.id))?.title}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setVisualTopic(activeLesson.title);
                    setShowVisualizer(true);
                  }}
                  className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all"
                  title="Generate Visual Summary"
                >
                  <ImageIcon size={20} />
                </button>
                <button
                  onClick={() => {
                    setBattleConcepts([activeLesson.title, 'Related Concept']);
                    setShowConceptBattle(true);
                  }}
                  className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl hover:bg-amber-100 transition-all"
                  title="Concept Battle"
                >
                  <Swords size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 overflow-hidden">
              {/* Main Content Area */}
              <div className="lg:col-span-3 overflow-y-auto no-scrollbar space-y-8 pb-20">
                {!quizMode ? (
                  <div className="bg-white dark:bg-[#111111] p-10 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm space-y-10">
                    {/* Lesson Content */}
                    <div className="prose dark:prose-invert max-w-none">
                      <ReactMarkdown>{activeLesson.content}</ReactMarkdown>
                    </div>

                    {/* Key Elements */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-black/5 dark:border-white/5">
                      {activeLesson.formulas && activeLesson.formulas.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-bold flex items-center gap-2 text-indigo-600">
                            <BrainCircuit size={18} />
                            Key Formulas
                          </h4>
                          <div className="space-y-2">
                            {activeLesson.formulas.map((f, i) => (
                              <div key={i} className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl font-mono text-sm text-center">
                                {f}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {activeLesson.definitions && activeLesson.definitions.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-bold flex items-center gap-2 text-emerald-600">
                            <Lightbulb size={18} />
                            Key Definitions
                          </h4>
                          <div className="space-y-3">
                            {activeLesson.definitions.map((d, i) => (
                              <div key={i} className="space-y-1">
                                <p className="text-sm font-bold">{d.term}</p>
                                <p className="text-xs text-gray-500 leading-relaxed">{d.definition}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mnemonics */}
                    {activeLesson.mnemonics && activeLesson.mnemonics.length > 0 && (
                      <div className="p-8 bg-amber-50 dark:bg-amber-900/10 rounded-[2rem] border border-amber-100 dark:border-amber-900/20 space-y-4">
                        <h4 className="font-bold flex items-center gap-2 text-amber-600">
                          <Sparkles size={18} />
                          Memory Aids (Mnemonics)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {activeLesson.mnemonics.map((m, i) => (
                            <div key={i} className="space-y-1">
                              <p className="font-black text-amber-800 dark:text-amber-200">{m.mnemonic}</p>
                              <p className="text-xs text-amber-700 dark:text-amber-300 opacity-80">{m.explanation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setQuizMode(true)}
                      className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                    >
                      <HelpCircle size={20} />
                      Take Practice Quiz
                    </button>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#111111] p-10 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm space-y-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold">Practice Quiz</h3>
                      {quizScore !== null && (
                        <div className={cn(
                          "px-4 py-2 rounded-xl font-bold",
                          quizScore >= 70 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                        )}>
                          Score: {quizScore}%
                        </div>
                      )}
                    </div>

                    <div className="space-y-10">
                      {activeLesson.practice_questions.map((q, i) => (
                        <div key={q.id} className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="w-8 h-8 bg-black/5 dark:bg-white/5 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
                              {i + 1}
                            </div>
                            <p className="font-bold text-lg">{q.question}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-2 pl-12">
                            {q.options?.map(opt => (
                              <button
                                key={opt}
                                disabled={quizScore !== null}
                                onClick={() => setUserAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                className={cn(
                                  "w-full p-4 rounded-xl text-left border-2 transition-all",
                                  userAnswers[q.id] === opt
                                    ? quizScore !== null
                                      ? opt === q.correct_answer
                                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700"
                                        : "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700"
                                      : "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700"
                                    : quizScore !== null && opt === q.correct_answer
                                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700"
                                      : "border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10"
                                )}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                          {quizScore !== null && (
                            <div className="pl-12">
                              <p className="text-xs text-gray-500 italic bg-black/5 dark:bg-white/5 p-4 rounded-xl">
                                {q.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {quizScore === null ? (
                      <button
                        onClick={handleQuizSubmit}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
                      >
                        Submit Quiz
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveLesson(null);
                          setQuizMode(false);
                          setQuizScore(null);
                          setUserAnswers({});
                        }}
                        className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:opacity-90 transition-all"
                      >
                        Continue to Next Lesson
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar Info */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm space-y-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Learning Progress</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold">
                      <span>Course Completion</span>
                      <span className="text-indigo-600">{Math.round(((progress?.completed_lessons.length || 0) / course.modules.reduce((acc, m) => acc + m.lessons.length, 0)) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600" 
                        style={{ width: `${Math.round(((progress?.completed_lessons.length || 0) / course.modules.reduce((acc, m) => acc + m.lessons.length, 0)) * 100)}%` }} 
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-3">
                    <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                      <Clock size={16} className="text-indigo-600" />
                      Est. 15 mins left
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-gray-500">
                      <BarChart3 size={16} className="text-emerald-500" />
                      Avg Score: 84%
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/20">
                  <h4 className="font-bold text-indigo-600 mb-2 flex items-center gap-2">
                    <Sparkles size={16} />
                    AI Tutor Tip
                  </h4>
                  <p className="text-[10px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    Based on your previous quizzes, you're doing great with definitions but might need more practice with formulas. Try generating a Visual Formula Card!
                  </p>
                </div>
              </div>
            </div>
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
