import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import {
  User,
  Key,
  Sparkles,
  Globe,
  Bot,
  CheckCircle2,
  AlertCircle,
  Save,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';

interface ProfileData {
  full_name: string;
  avatar_url: string;
  preferred_model: string;
  persona: string;
  region: string;
  custom_agent_prompt: string;
  todayUsage?: number;
}

interface HealthData {
  status: string;
  gemini: boolean;
  groq: boolean;
  deepseek: boolean;
}

export default function Settings() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    avatar_url: '',
    preferred_model: 'gemini',
    persona: 'friendly',
    region: 'Nigeria',
    custom_agent_prompt: '',
    todayUsage: 0
  });

  const [groqKey, setGroqKey] = useState<string>('');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Load existing Groq key from sessionStorage if stored
    try {
      const keys = JSON.parse(sessionStorage.getItem('academia_keys') || '{}');
      if (keys.groqKey) setGroqKey(keys.groqKey);
    } catch {}

    async function loadData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);

        // Fetch profile
        try {
          const profileRes = await apiFetch('/api/profiles/me');
          setProfile({
            full_name: profileRes.full_name || user?.user_metadata?.full_name || '',
            avatar_url: profileRes.avatar_url || user?.user_metadata?.avatar_url || '',
            preferred_model: profileRes.preferred_model || 'gemini',
            persona: profileRes.persona || 'friendly',
            region: profileRes.region || 'Nigeria',
            custom_agent_prompt: profileRes.custom_agent_prompt || '',
            todayUsage: profileRes.todayUsage || 0
          });
          setSupabaseConnected(true);
        } catch (err) {
          console.error('Failed to fetch profile:', err);
          setSupabaseConnected(false);
        }

        // Fetch health
        try {
          const healthRes = await apiFetch('/api/health');
          setHealth(healthRes);
        } catch {
          try {
            const res = await fetch('/api/health');
            const data = await res.json();
            setHealth(data);
          } catch {
            setHealth(null);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleGroqKeyChange = (val: string) => {
    setGroqKey(val);
    sessionStorage.setItem('academia_keys', JSON.stringify({ groqKey: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await apiFetch('/api/profiles/me', {
        method: 'PUT',
        body: JSON.stringify({
          preferred_model: profile.preferred_model,
          persona: profile.persona,
          region: profile.region,
          custom_agent_prompt: profile.custom_agent_prompt
        })
      });
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = profile.full_name || currentUser?.user_metadata?.full_name || currentUser?.email || 'Student';
  const email = currentUser?.email || 'N/A';
  const avatar = profile.avatar_url || currentUser?.user_metadata?.avatar_url;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account & AI Settings</h1>
        <p className="text-gray-500 text-sm">Manage your profile, preferences, and AI key integrations.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* User Info (Read Only) */}
      <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <User size={18} className="text-indigo-600" />
          Profile Information
        </h2>
        <div className="flex items-center gap-4">
          {avatar ? (
            <img src={avatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-lg">{displayName}</p>
            <p className="text-sm text-gray-500">{email}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Cultural & Persona Settings */}
        <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Globe size={18} className="text-indigo-600" />
            Cultural & Persona Customization
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Region / Country
              </label>
              <select
                value={profile.region}
                onChange={(e) => setProfile({ ...profile, region: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Nigeria">Nigeria</option>
                <option value="Ghana">Ghana</option>
                <option value="Kenya">Kenya</option>
                <option value="South Africa">South Africa</option>
                <option value="India">India</option>
                <option value="Other">Other / Universal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                AI Persona
              </label>
              <select
                value={profile.persona}
                onChange={(e) => setProfile({ ...profile, persona: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="friendly">Friendly Tutor</option>
                <option value="strict">Strict Professor</option>
                <option value="socratic">Socratic Method</option>
                <option value="exam">Exam Strategist</option>
                <option value="research">Research Partner</option>
                <option value="custom">Custom Agent Prompt</option>
              </select>
            </div>
          </div>

          {profile.persona === 'custom' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Custom Agent System Instructions
              </label>
              <textarea
                value={profile.custom_agent_prompt}
                onChange={(e) => setProfile({ ...profile, custom_agent_prompt: e.target.value })}
                rows={3}
                placeholder="Enter custom instructions for your AI agent..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Preferred Model Family
            </label>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="preferred_model"
                  value="gemini"
                  checked={profile.preferred_model === 'gemini'}
                  onChange={(e) => setProfile({ ...profile, preferred_model: e.target.value })}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                Gemini 2.0 Flash
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="preferred_model"
                  value="groq"
                  checked={profile.preferred_model === 'groq'}
                  onChange={(e) => setProfile({ ...profile, preferred_model: e.target.value })}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                Groq (Llama 3.3 70B)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="preferred_model"
                  value="deepseek"
                  checked={profile.preferred_model === 'deepseek'}
                  onChange={(e) => setProfile({ ...profile, preferred_model: e.target.value })}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                DeepSeek Chat
              </label>
            </div>
          </div>
        </div>

        {/* Custom API Keys */}
        <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Key size={18} className="text-indigo-600" />
            Bring Your Own API Key
          </h2>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Your Groq API Key (Session-Only)
            </label>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => handleGroqKeyChange(e.target.value)}
              placeholder="gsk_..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Your own Groq key gives unlimited AI calls. It is stored only in your browser session and never saved to our database.
            </p>
          </div>
        </div>

        {/* Real System Status */}
        <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Activity size={18} className="text-indigo-600" />
            System & Quota Status
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-xs text-gray-500">Supabase DB</p>
              <p className={`font-semibold text-sm ${supabaseConnected ? 'text-emerald-600' : 'text-rose-500'}`}>
                {supabaseConnected ? 'Connected' : 'Offline'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-xs text-gray-500">Gemini AI</p>
              <p className={`font-semibold text-sm ${health?.gemini ? 'text-emerald-600' : 'text-amber-500'}`}>
                {health?.gemini ? 'Active' : 'Missing Key'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-xs text-gray-500">Groq AI</p>
              <p className={`font-semibold text-sm ${health?.groq ? 'text-emerald-600' : 'text-amber-500'}`}>
                {health?.groq ? 'Active' : 'Missing Key'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-xs text-gray-500">DeepSeek AI</p>
              <p className={`font-semibold text-sm ${health?.deepseek ? 'text-emerald-600' : 'text-amber-500'}`}>
                {health?.deepseek ? 'Active' : 'Missing Key'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl">
              <p className="text-xs text-gray-500">Your Usage Today</p>
              <p className="font-semibold text-sm text-indigo-600">
                {groqKey ? 'Unlimited (BYOK)' : `${profile.todayUsage ?? 0} / 20`}
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md transition-all disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={18} />
          )}
          Save Changes
        </button>
      </form>
    </div>
  );
}
