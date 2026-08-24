import React, { useState, useEffect } from 'react';
import { User, Bell, Shield, Database, Globe, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, db, doc, getDoc, setDoc } from '../firebase';
import { apiFetch } from '../lib/api';

export default function Settings() {
  const currentUser = auth.currentUser;

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
    if (!currentUser) return;

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
    <div className="space-y-8 font-sans max-w-5xl">
      <section className="space-y-1">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Settings & Integrations</h2>
        <p className="text-slate-500 text-sm">Configure user preferences, model defaults, and inspect live service health.</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Left Navigation Tabs */}
        <div className="md:col-span-1 space-y-1.5">
          <button className="w-full flex items-center gap-3 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm text-left border border-indigo-100 dark:border-indigo-900/40 shadow-sm">
            <User size={18} />
            Profile & AI Defaults
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl font-medium text-sm text-left transition-all">
            <Bell size={18} />
            Notifications
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl font-medium text-sm text-left transition-all">
            <Shield size={18} />
            Security
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl font-medium text-sm text-left transition-all">
            <Database size={18} />
            Data & Privacy
          </button>
        </div>

        {/* Right Content */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-white dark:bg-[#0d111a] p-6 md:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Personal Information</h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-md">Verified</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                <input 
                  type="text" 
                  value={currentUser?.displayName || 'Dr. Scholar'}
                  disabled
                  className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm text-slate-500 cursor-not-allowed outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                <input 
                  type="email" 
                  value={currentUser?.email || 'researcher@example.com'}
                  disabled
                  className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm text-slate-500 cursor-not-allowed outline-none"
                />
              </div>
            </div>

            {/* Region Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Study Country / Region Context</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              >
                <option value="default">Global / Default Academic</option>
                <option value="nigeria">Nigeria (JAMB, WAEC, Naira context)</option>
                <option value="ghana">Ghana (WASSCE, Cedi context)</option>
                <option value="kenya">Kenya (KCSE, Shilling context)</option>
                <option value="south africa">South Africa (NSC Matric, Rand context)</option>
                <option value="india">India (CBSE, ICSE, Rupee context)</option>
              </select>
            </div>

            {/* Model Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Preferred AI Engine</label>
              <select
                value={preferredModel}
                onChange={(e) => setPreferredModel(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              >
                <option value="gemini">Gemini Flash 2.0 (Fast Reasoning)</option>
                <option value="deepseek">DeepSeek Chat V3 (Deep Analytical Reasoning)</option>
                <option value="claude">Claude Sonnet 3.5 (Academic Writing Specialist)</option>
                <option value="openai">OpenAI GPT-4o (Precise Problem Solver)</option>
              </select>
            </div>

            {/* Custom Prompt */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Custom Agent Instructions</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="E.g., Respond as an academic peer-reviewer with concise explanations..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 min-h-[90px] resize-none transition-all outline-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </button>

              {saveSuccess && (
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                  <CheckCircle2 size={16} />
                  Settings saved!
                </div>
              )}

              {saveError && (
                <div className="flex items-center gap-2 text-rose-500 text-xs font-bold">
                  <AlertCircle size={16} />
                  {saveError}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0d111a] p-6 md:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/60 pb-4">Server & Integration Status</h3>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0">
                  <Globe size={18} />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-900 dark:text-slate-100">Gemini Generative Engine</p>
                  <p className="text-[10px] text-slate-400">Primary AI Inference Proxy</p>
                </div>
              </div>
              <span className={cn(
                "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md",
                healthStatus.gemini
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
              )}>
                {healthStatus.gemini ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-700 rounded-lg flex items-center justify-center text-white shrink-0">
                  <Database size={18} />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-900 dark:text-slate-100">Express Backend Service</p>
                  <p className="text-[10px] text-slate-400">Live API Endpoint Handler</p>
                </div>
              </div>
              <span className={cn(
                "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md",
                healthStatus.active
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
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
