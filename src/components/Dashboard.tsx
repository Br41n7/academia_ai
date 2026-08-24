import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Zap, 
  Calendar,
  FileText,
  MessageSquare,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { db, collection, query, where, handleFirestoreError, OperationType, getCountFromServer, limit, orderBy, onSnapshot } from '../firebase';
import { StudyReminder } from '../types';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const chartData = [
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
    { label: 'Documents', value: stats?.documents || 0, icon: FileText, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
    { label: 'Flashcards', value: stats?.flashcards || 0, icon: Sparkles, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
    { label: 'Quizzes', value: stats?.quizzes || 0, icon: HelpCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
    { label: 'AI Chats', value: stats?.chats || 0, icon: MessageSquare, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
  ];

  return (
    <div className="space-y-8 font-sans">
      <section className="space-y-1">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Project Overview</h2>
        <p className="text-slate-500 text-sm">Monitor activity, study metrics, and workspace performance.</p>
      </section>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#0d111a] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm relative overflow-hidden">
            <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className={stat.color} size={20} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0d111a] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Activity & Engagement</h3>
              <p className="text-xs text-slate-400">Weekly engagement trends across assessments.</p>
            </div>
            <select className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium px-3 py-1.5 focus:outline-none">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Learning Insights Panel */}
        <div className="bg-white dark:bg-[#0d111a] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Workspace Insights</h3>

          <div className="space-y-4">
            <div className="flex gap-3.5 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
              <Zap className="text-indigo-600 dark:text-indigo-400 shrink-0" size={18} />
              <div>
                <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">AI Readiness</p>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                  {stats?.documents ? "Knowledge base indexing complete. AI features active." : "Upload document sources to enable RAG AI search."}
                </p>
              </div>
            </div>

            <div className="flex gap-3.5 p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <TrendingUp className="text-emerald-600 dark:text-emerald-400 shrink-0" size={18} />
              <div>
                <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Study Momentum</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">Created {stats?.notes || 0} active study notes.</p>
              </div>
            </div>

            <div className="pt-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Upcoming Reminders</h4>
              <div className="space-y-2">
                {upcomingReminders.length > 0 ? (
                  upcomingReminders.map((reminder) => (
                    <div key={reminder.id} className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Calendar size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{reminder.topic}</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(reminder.scheduled_time).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic py-1">No pending study sessions scheduled.</p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Health Metrics</h4>
              <div className="space-y-3">
                {[
                  { name: 'Knowledge Coverage', value: stats?.documents ? 85 : 0 },
                  { name: 'Assessment Readiness', value: stats?.quizzes ? 60 : 0 },
                  { name: 'Memory Retention', value: stats?.flashcards ? 75 : 0 },
                ].map((metric, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600 dark:text-slate-300">{metric.name}</span>
                      <span className="text-slate-400">{metric.value}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
