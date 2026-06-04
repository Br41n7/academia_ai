import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  LogIn,
  LogOut,
  User as UserIcon,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  handleFirestoreError, 
  OperationType,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  updateDoc,
  orderBy
} from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { StudyReminder } from '../types';

interface StudyRemindersProps {
  projectId: string;
}

export default function StudyReminders({ projectId }: StudyRemindersProps) {
  const [user, setUser] = useState<User | null>(null);
  const [reminders, setReminders] = useState<StudyReminder[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError('Popup blocked. Please allow popups.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setAuthError('Request already in progress.');
      } else {
        setAuthError('Sign-in failed.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setReminders([]);
      return;
    }

    const q = query(
      collection(db, 'reminders'),
      where('user_id', '==', user.uid),
      where('project_id', '==', projectId),
      orderBy('scheduled_time', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: StudyReminder[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as StudyReminder);
      });
      setReminders(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'reminders');
    });

    return () => unsubscribe();
  }, [user, projectId]);

  const updateReminderStatus = useCallback(async (id: string, status: 'sent' | 'cancelled') => {
    try {
      const ref = doc(db, 'reminders', id);
      await updateDoc(ref, { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reminders/${id}`);
    }
  }, []);

  const sendNotification = useCallback((reminder: StudyReminder) => {
    if (notificationPermission === 'granted') {
      new Notification('Study Reminder', {
        body: `Time to study: ${reminder.topic}`,
        icon: '/favicon.ico'
      });
      
      updateReminderStatus(reminder.id, 'sent');
    }
  }, [notificationPermission, updateReminderStatus]);

  // Check for due reminders every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      reminders.forEach(reminder => {
        if (reminder.status === 'pending') {
          const scheduled = new Date(reminder.scheduled_time);
          if (scheduled <= now) {
            sendNotification(reminder);
          }
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [reminders, sendNotification]);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTopic || !newDate || !newTime) return;

    const scheduledTime = new Date(`${newDate}T${newTime}`).toISOString();
    const id = crypto.randomUUID();
    
    const reminder: StudyReminder = {
      id,
      user_id: user.uid,
      project_id: projectId,
      topic: newTopic,
      scheduled_time: scheduledTime,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'reminders', id), reminder);
      setIsAdding(false);
      setNewTopic('');
      setNewDate('');
      setNewTime('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reminders');
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reminders', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reminders/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6 max-w-md mx-auto text-center">
        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600">
          <LogIn size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Sign in to set reminders</h2>
          <p className="text-gray-500">Keep track of your study sessions and get notified when it's time to review.</p>
        </div>
        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
        >
          {isSigningIn ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          )}
          {isSigningIn ? 'Connecting...' : 'Sign in with Google'}
        </button>
        {authError && <p className="text-sm text-rose-500 font-medium">{authError}</p>}
      </div>
    );
  }

  return (
    <div className="h-full space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600">
            <Bell size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Study Reminders</h2>
            <p className="text-sm text-gray-500">Schedule your review sessions and stay on track.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {notificationPermission !== 'granted' && (
            <button
              onClick={requestPermission}
              className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all flex items-center gap-2"
            >
              <AlertCircle size={14} />
              Enable Notifications
            </button>
          )}
          <button
            onClick={() => setIsAdding(true)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            Add Reminder
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {reminders.map((reminder) => (
            <motion.div
              key={reminder.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm space-y-4 relative group"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest">
                    <Calendar size={12} />
                    {new Date(reminder.scheduled_time).toLocaleDateString()}
                  </div>
                  <h3 className="font-bold text-lg">{reminder.topic}</h3>
                </div>
                <button
                  onClick={() => handleDeleteReminder(reminder.id)}
                  className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock size={14} />
                  {new Date(reminder.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                  reminder.status === 'pending' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" :
                  reminder.status === 'sent' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" :
                  "bg-gray-50 dark:bg-gray-900/20 text-gray-600"
                )}>
                  {reminder.status}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {reminders.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center text-gray-400 mx-auto">
              <Calendar size={32} />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-gray-500">No reminders set</p>
              <p className="text-sm text-gray-400">Click "Add Reminder" to schedule your first study session.</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111111] w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">New Study Reminder</h3>
                  <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleAddReminder} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Topic to Study</label>
                    <input
                      required
                      type="text"
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      placeholder="e.g. Quantum Mechanics Intro"
                      className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Date</label>
                      <input
                        required
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Time</label>
                      <input
                        required
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="w-full bg-black/5 dark:bg-white/5 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 mt-4"
                  >
                    Schedule Reminder
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
