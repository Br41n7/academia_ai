import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { 
  Trophy,
  Flame,
  Award,
  Medal,
  Crown,
  UserCheck
} from 'lucide-react';

interface LeaderboardUser {
  id: string;
  full_name: string;
  avatar_url?: string;
  points: number;
  study_streak: number;
  badges?: string[];
  rank: number;
}

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadLeaderboard() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);

        const data = await apiFetch('/api/profiles/leaderboard');
        setUsers(data || []);
      } catch (err) {
        console.error('Leaderboard error:', err);
        // Direct query fallback
        const { data } = await supabase
          .from('leaderboard')
          .select('*')
          .limit(50);
        setUsers(data as LeaderboardUser[] || []);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic Leaderboard</h1>
          <p className="text-gray-500 text-sm">Top scholars based on study streak and quiz performances</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-800 font-semibold text-sm">
          <Trophy size={18} />
          Top 100 Scholars
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-zinc-800">
          {users.map((u) => {
            const isMe = u.id === currentUserId;
            return (
              <div
                key={u.id}
                className={`flex items-center justify-between p-4 transition-colors ${
                  isMe ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 text-center font-bold text-lg">
                    {u.rank === 1 ? (
                      <Crown className="inline text-amber-500" size={22} />
                    ) : u.rank === 2 ? (
                      <Medal className="inline text-slate-400" size={20} />
                    ) : u.rank === 3 ? (
                      <Medal className="inline text-amber-700" size={20} />
                    ) : (
                      <span className="text-gray-400">#{u.rank}</span>
                    )}
                  </div>

                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold">
                      {(u.full_name || 'Student').charAt(0)}
                    </div>
                  )}

                  <div>
                    <p className="font-semibold text-sm flex items-center gap-2">
                      {u.full_name || 'Anonymous Student'}
                      {isMe && <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">You</span>}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <Flame size={12} /> {u.study_streak} day streak
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-indigo-600 dark:text-indigo-400 text-base">
                    {u.points} pts
                  </p>
                </div>
              </div>
            );
          })}

          {users.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              No leaderboard entries yet. Start studying to earn points!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
