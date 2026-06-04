import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Target, 
  Clock, 
  Zap, 
  Calendar,
  ChevronRight,
  AlertCircle,
  FileText,
  MessageSquare,
  Sparkles,
  HelpCircle,
  StickyNote
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { db, collection, query, where, getDocs, handleFirestoreError, OperationType, getCountFromServer, limit, orderBy, onSnapshot } from '../firebase';
import { StudyReminder } from '../types';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const data = [
  { name: 'Mon', score: 65 },
  { name: 'Tue', score: 72 },
  { name: 'Wed', score: 68 },
  { name: 'Thu', score: 85 },
  { name: 'Fri', score: 78 },
  { name: 'Sat', score: 92 },
  { name: 'Sun', score: 88 },
];

interface DashboardProps {
  projectId: string;
}

interface Stats {
  documents: number;
  flashcards: number;
  quizzes: number;
  notes: number;
  chats: number;
}

export default function Dashboard({ projectId }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [upcomingReminders, setUpcomingReminders] = useState<StudyReminder[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(
          collection(db, 'reminders'),
          where('user_id', '==', user.uid),
          where('project_id', '==', projectId),
          where('status', '==', 'pending'),
          orderBy('scheduled_time', 'asc'),
          limit(3)
        );

        return onSnapshot(q, (snapshot) => {
          const list: StudyReminder[] = [];
          snapshot.forEach((doc) => {
            list.push(doc.data() as StudyReminder);
          });
          setUpcomingReminders(list);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'reminders');
        });
      } else {
        setUpcomingReminders([]);
      }
    });

    return () => unsubscribe();
  }, [projectId]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        const [docs, flashcards, quizzes, notes, questions] = await Promise.all([
          getCountFromServer(query(collection(db, 'documents'), where('project_id', '==', projectId), where('user_id', '==', uid))),
          getCountFromServer(query(collection(db, 'mnemonics'), where('project_id', '==', projectId), where('user_id', '==', uid))),
          getCountFromServer(query(collection(db, 'quiz_attempts'), where('project_id', '==', projectId), where('user_id', '==', uid))),
          getCountFromServer(query(collection(db, 'notes'), where('project_id', '==', projectId), where('user_id', '==', uid))),
          getCountFromServer(query(collection(db, 'questions'), where('project_id', '==', projectId), where('user_id', '==', uid)))
        ]);

        setStats({
          documents: docs.data().count,
          flashcards: flashcards.data().count,
          quizzes: quizzes.data().count,
          notes: notes.data().count,
          chats: questions.data().count
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'stats');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [projectId]);

  const statCards = [
    { label: 'Documents', value: stats?.documents || 0, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Flashcards', value: stats?.flashcards || 0, icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Quizzes', value: stats?.quizzes || 0, icon: HelpCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'AI Chats', value: stats?.chats || 0, icon: MessageSquare, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Project Overview</h2>
        <p className="text-gray-500 dark:text-gray-400">Track your progress and workspace activity.</p>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#111111] p-4 md:p-6 rounded-2xl md:rounded-3xl border border-black/5 dark:border-white/5 shadow-sm">
            <div className={`w-10 h-10 md:w-12 md:h-12 ${stat.bg} dark:bg-white/5 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4`}>
              <stat.icon className={stat.color} size={20} />
            </div>
            <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
            <p className="text-lg md:text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111111] p-4 md:p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h3 className="text-lg font-bold">Activity Progress</h3>
            <select className="bg-black/5 dark:bg-white/5 border-none rounded-lg text-sm px-3 py-1 w-fit">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[250px] md:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#888' }} 
                  interval="preserveStartEnd"
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#888' }} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Learning Health */}
        <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Workspace Insights</h3>
          <div className="space-y-6">
            <div className="flex gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20">
              <Zap className="text-indigo-600 shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">AI Readiness</p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                  {stats?.documents ? "Your project knowledge base is active." : "Upload documents to enable RAG-powered AI features."}
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
              <TrendingUp className="text-emerald-600 shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Study Momentum</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">You've created {stats?.notes || 0} notes in this workspace.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-black/5 dark:border-white/5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Upcoming Reminders</h4>
              <div className="space-y-3">
                {upcomingReminders.length > 0 ? (
                  upcomingReminders.map((reminder) => (
                    <div key={reminder.id} className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-xl">
                      <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                        <Calendar size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{reminder.topic}</p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(reminder.scheduled_time).toLocaleDateString()} at {new Date(reminder.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">No upcoming study sessions.</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-black/5 dark:border-white/5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Project Health</h4>
              <div className="space-y-4">
                {[
                  { name: 'Knowledge Coverage', value: stats?.documents ? 85 : 0 },
                  { name: 'Assessment Readiness', value: stats?.quizzes ? 60 : 0 },
                  { name: 'Memory Retention', value: stats?.flashcards ? 75 : 0 },
                ].map((metric, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{metric.name}</span>
                      <span className="text-gray-500">{metric.value}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          metric.value > 80 ? 'bg-emerald-500' : metric.value > 40 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${metric.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
