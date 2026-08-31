import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, Plus, Trash2, Calendar, Clock } from 'lucide-react';

interface StudyRemindersProps {
  projectId: string;
}

interface Reminder {
  id: string;
  topic: string;
  scheduled_time: string;
  status: string;
}

export default function StudyReminders({ projectId }: StudyRemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [topic, setTopic] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(true);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('reminders')
        .select('*')
        .eq('project_id', projectId)
        .order('scheduled_time', { ascending: true });

      setReminders(data as Reminder[] || []);
    } catch (err) {
      console.error('Error loading reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, [projectId]);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !time) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('reminders')
        .insert({
          project_id: projectId,
          user_id: user.id,
          topic,
          scheduled_time: new Date(time).toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (data) setReminders([...reminders, data as Reminder]);
      setTopic('');
      setTime('');
    } catch (err) {
      console.error('Error adding reminder:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('reminders').delete().eq('id', id);
      setReminders(reminders.filter(r => r.id !== id));
    } catch (err) {
      console.error('Error deleting reminder:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Study Planner & Reminders</h1>
        <p className="text-gray-500 text-sm">Schedule revision sessions for key topics</p>
      </div>

      <form onSubmit={handleAddReminder} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic to revise..."
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
          required
        />
        <input
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
          required
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Add Reminder
        </button>
      </form>

      <div className="space-y-3">
        {reminders.map((r) => (
          <div key={r.id} className="p-4 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <Bell className="text-indigo-600 shrink-0" size={20} />
              <div>
                <p className="font-semibold text-sm">{r.topic}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Clock size={12} /> {new Date(r.scheduled_time).toLocaleString()}
                </p>
              </div>
            </div>
            <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-rose-500 p-1">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {reminders.length === 0 && !loading && (
          <p className="text-gray-500 text-sm text-center py-8">No reminders scheduled yet.</p>
        )}
      </div>
    </div>
  );
}
