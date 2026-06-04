import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Flame, Star, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  db, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  handleFirestoreError, 
  OperationType,
  auth,
  doc,
  getDoc
} from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface LeaderboardEntry {
  id: string;
  full_name: string;
  avatar_url: string;
  points: number;
  study_streak: number;
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<LeaderboardEntry | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'profiles'),
      orderBy('points', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: LeaderboardEntry[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as LeaderboardEntry);
      });
      setEntries(list);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'profiles');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profileRef = doc(db, 'profiles', user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setCurrentUserProfile({ id: profileSnap.id, ...profileSnap.data() } as LeaderboardEntry);
          
          // Simple rank estimation (in a real app, this would be a more complex query or a cloud function)
          // For now, we'll just check if they are in the top 10
        }
      } else {
        setCurrentUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium animate-pulse">Loading global rankings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-full text-sm font-bold uppercase tracking-widest">
          <Trophy size={16} />
          Global Leaderboard
        </div>
        <h2 className="text-5xl font-black tracking-tight">Academic Champions</h2>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">Compete with learners worldwide. Earn points by completing quizzes, taking notes, and maintaining your study streak.</p>
      </header>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-4 items-end pt-10">
        {/* 2nd Place */}
        {entries[1] && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-slate-300 overflow-hidden shadow-xl">
                <img src={entries[1].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entries[1].full_name}`} alt={entries[1].full_name} className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-slate-700 font-bold shadow-lg">2</div>
            </div>
            <div className="text-center">
              <p className="font-bold truncate max-w-[120px]">{entries[1].full_name}</p>
              <p className="text-sm text-indigo-600 font-black">{entries[1].points} pts</p>
            </div>
            <div className="w-full h-32 bg-slate-100 dark:bg-white/5 rounded-t-2xl border-x border-t border-slate-200 dark:border-white/10" />
          </motion.div>
        )}

        {/* 1st Place */}
        {entries[0] && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="relative">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-amber-400 animate-bounce">
                <Trophy size={32} />
              </div>
              <div className="w-28 h-28 rounded-full border-4 border-amber-400 overflow-hidden shadow-2xl ring-4 ring-amber-400/20">
                <img src={entries[0].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entries[0].full_name}`} alt={entries[0].full_name} className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center text-amber-900 font-bold shadow-lg">1</div>
            </div>
            <div className="text-center">
              <p className="text-xl font-black truncate max-w-[150px]">{entries[0].full_name}</p>
              <p className="text-lg text-indigo-600 font-black">{entries[0].points} pts</p>
            </div>
            <div className="w-full h-48 bg-amber-50 dark:bg-amber-400/5 rounded-t-3xl border-x border-t border-amber-200 dark:border-amber-400/20" />
          </motion.div>
        )}

        {/* 3rd Place */}
        {entries[2] && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-amber-700 overflow-hidden shadow-xl">
                <img src={entries[2].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entries[2].full_name}`} alt={entries[2].full_name} className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-700 rounded-full flex items-center justify-center text-amber-100 font-bold shadow-lg">3</div>
            </div>
            <div className="text-center">
              <p className="font-bold truncate max-w-[120px]">{entries[2].full_name}</p>
              <p className="text-sm text-indigo-600 font-black">{entries[2].points} pts</p>
            </div>
            <div className="w-full h-24 bg-amber-900/5 dark:bg-white/5 rounded-t-2xl border-x border-t border-amber-900/10 dark:border-white/10" />
          </motion.div>
        )}
      </div>

      {/* List View for 4-10 */}
      <div className="bg-white dark:bg-[#111111] rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
          <div className="flex items-center gap-12">
            <span className="w-8">Rank</span>
            <span>Student</span>
          </div>
          <div className="flex items-center gap-12">
            <span>Streak</span>
            <span className="w-20 text-right">Points</span>
          </div>
        </div>

        <div className="divide-y divide-black/5 dark:divide-white/5">
          {entries.slice(3).map((entry, idx) => (
            <motion.div 
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-all group"
            >
              <div className="flex items-center gap-12">
                <span className="w-8 font-black text-gray-300 group-hover:text-indigo-600 transition-colors">{idx + 4}</span>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-transparent group-hover:border-indigo-600 transition-all">
                    <img src={entry.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.full_name}`} alt={entry.full_name} className="w-full h-full object-cover" />
                  </div>
                  <span className="font-bold">{entry.full_name}</span>
                </div>
              </div>
              <div className="flex items-center gap-12">
                <div className="flex items-center gap-1.5 text-amber-500 font-bold">
                  <Flame size={16} />
                  {entry.study_streak}
                </div>
                <div className="w-20 text-right font-black text-indigo-600">
                  {entry.points}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-indigo-600 text-white rounded-[2rem] shadow-xl shadow-indigo-500/20 space-y-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Star size={24} />
          </div>
          <div>
            <p className="text-indigo-100 font-bold text-sm uppercase tracking-widest">Your Rank</p>
            <h4 className="text-3xl font-black">{currentUserRank ? `#${currentUserRank}` : '---'}</h4>
          </div>
        </div>
        <div className="p-8 bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 rounded-[2rem] shadow-sm space-y-4">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Points Earned</p>
            <h4 className="text-3xl font-black">{currentUserProfile?.points || 0}</h4>
          </div>
        </div>
        <div className="p-8 bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 rounded-[2rem] shadow-sm space-y-4">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-600">
            <Award size={24} />
          </div>
          <div>
            <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Badges Unlocked</p>
            <h4 className="text-3xl font-black">{(currentUserProfile as any)?.badges?.length || 0}</h4>
          </div>
        </div>
      </div>
    </div>
  );
}
