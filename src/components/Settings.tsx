import React, { useState, useEffect } from 'react';
import { User, Bell, Shield, Database, Globe, Moon, Sun, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, db, doc, getDoc, setDoc } from '../firebase';
import { apiFetch } from '../lib/api';

export default function Settings() {
  const currentUser = auth.currentUser || {
    uid: '00000000-0000-0000-0000-000000000000',
    displayName: 'Mock Student (Demo Mode)',
    email: 'student@academic-ai.com'
  };

  // Active form state
  const [region, setRegion] = useState('default');
  const [preferredModel, setPreferredModel] = useState('gemini');
  const [customPrompt, setCustomPrompt] = useState('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Health check state
  const [healthStatus, setHealthStatus] = useState({
    active: false,
    gemini: false,
    deepseek: false,
    env: 'development',
    ts: ''
  });

  // Load profile from Firestore & fetch server health on mount
  useEffect(() => {
    // 1. Fetch user profile from Firestore at profiles/{uid}
    const loadProfile = async () => {
      try {
        const profileRef = doc(db, 'profiles', currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setRegion(data.region || 'default');
          setPreferredModel(data.preferred_model || 'gemini');
          setCustomPrompt(data.custom_agent_prompt || '');
        }
      } catch (err: any) {
        console.error('[Settings] Failed to load Firestore profile:', err.message);
      }
    };

    // 2. Ping GET /api/health
    const checkHealth = async () => {
      try {
        const res = await apiFetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setHealthStatus({
            active: data.status === 'ok',
            gemini: data.gemini,
            deepseek: data.deepseek,
            env: data.env,
            ts: data.ts
          });
        }
      } catch (err) {
        console.error('[Settings] Health ping failed:', err);
      }
    };

    loadProfile();
    checkHealth();
  }, [currentUser]);

  // Handle save changes action
  const handleSaveChanges = async () => {
    if (!currentUser) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const profileRef = doc(db, 'profiles', currentUser.uid);

      // Update profile fields
      await setDoc(profileRef, {
        region,
        preferred_model: preferredModel,
        custom_agent_prompt: customPrompt,
        last_active_at: new Date().toISOString()
      }, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Reset success after 3 seconds
    } catch (err: any) {
      console.error('[Settings] Failed to save profile details:', err.message);
      setSaveError(err.message || 'Failed to update settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400">Manage your account, preferences, and integrations.</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left sidebar nav mockup */}
        <div className="md:col-span-1 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-medium text-left">
            <User size={18} />
            Profile & Models
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-left">
            <Bell size={18} />
            Notifications
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-left">
            <Shield size={18} />
            Security
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2 text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-left">
            <Database size={18} />
            Data & Privacy
          </button>
        </div>

        {/* Right workspace form */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm space-y-6">
            <h3 className="text-lg font-bold border-b border-black/5 dark:border-white/5 pb-4">Personal Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Full Name</label>
                <input 
                  type="text" 
                  value={currentUser?.displayName || 'Anonymous Student'}
                  disabled
                  className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-3 opacity-60 cursor-not-allowed text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Email Address</label>
                <input 
                  type="email" 
                  value={currentUser?.email || 'unauthenticated@academic-ai.com'}
                  disabled
                  className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-3 opacity-60 cursor-not-allowed text-gray-500"
                />
              </div>
            </div>

            {/* Cultural Region Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Study Country Context</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 transition-all"
              >
                <option value="default">Global / Default</option>
                <option value="nigeria">Nigeria (JAMB, WAEC, Naira context)</option>
                <option value="ghana">Ghana (WASSCE, Cedi context)</option>
                <option value="kenya">Kenya (KCSE, Sukuma Wiki, Shilling context)</option>
                <option value="south africa">South Africa (NSC Matric, Rand context)</option>
                <option value="india">India (CBSE, ICSE, Rupee context)</option>
              </select>
            </div>

            {/* Preferred LLM Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Preferred AI Model Preference</label>
              <select
                value={preferredModel}
                onChange={(e) => setPreferredModel(e.target.value)}
                className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 transition-all"
              >
                <option value="gemini">Gemini Flash 2.0 (High Speed)</option>
                <option value="deepseek">DeepSeek Chat V3 (Deep Reasoning)</option>
                <option value="claude">Claude Sonnet 3.5 (Highly Academic)</option>
                <option value="openai">OpenAI GPT-4o (Precise Problem Solver)</option>
              </select>
            </div>

            {/* Custom Agent Prompt Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Custom Agent Persona/Instructions</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="E.g., Speak to me as a peer-reviewer or format code in clean Python..."
                className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-none transition-all"
              />
            </div>

            {/* Save Buttons & Feedback indicators */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>

              {saveSuccess && (
                <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                  <CheckCircle2 size={16} />
                  Settings updated successfully!
                </div>
              )}

              {saveError && (
                <div className="flex items-center gap-2 text-rose-500 text-sm font-semibold">
                  <AlertCircle size={16} />
                  {saveError}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm space-y-6">
            <h3 className="text-lg font-bold border-b border-black/5 dark:border-white/5 pb-4">Integrations & Server Status</h3>
            
            {/* Real API Health Check Indicators */}
            <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                  <Globe size={20} />
                </div>
                <div>
                  <p className="font-bold">Gemini AI Endpoint</p>
                  <p className="text-xs text-gray-500">Academic Intelligence Engine</p>
                </div>
              </div>
              <span className={cn(
                "px-3 py-1 text-xs font-bold rounded-full",
                healthStatus.gemini
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
              )}>
                {healthStatus.gemini ? 'Active' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-500 rounded-lg flex items-center justify-center text-white">
                  <Database size={20} />
                </div>
                <div>
                  <p className="font-bold">Express API Server Health</p>
                  <p className="text-xs text-gray-500">Live Backend Services Indicator</p>
                </div>
              </div>
              <span className={cn(
                "px-3 py-1 text-xs font-bold rounded-full",
                healthStatus.active
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
              )}>
                {healthStatus.active ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
