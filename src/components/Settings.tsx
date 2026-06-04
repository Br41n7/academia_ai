import React from 'react';
import { User, Bell, Shield, Database, Globe, Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Settings() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400">Manage your account, preferences, and integrations.</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-medium text-left">
            <User size={18} />
            Profile
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

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm space-y-6">
            <h3 className="text-lg font-bold border-b border-black/5 dark:border-white/5 pb-4">Personal Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Full Name</label>
                <input 
                  type="text" 
                  defaultValue="Iyanuolalegan" 
                  className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Email Address</label>
                <input 
                  type="email" 
                  defaultValue="iyanuolalegan@gmail.com" 
                  disabled
                  className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-3 opacity-50 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Academic Level</label>
              <select className="w-full bg-black/5 dark:bg-white/5 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 transition-all">
                <option>Undergraduate</option>
                <option>Postgraduate</option>
                <option>High School</option>
                <option>Researcher</option>
              </select>
            </div>

            <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">
              Save Changes
            </button>
          </div>

          <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm space-y-6">
            <h3 className="text-lg font-bold border-b border-black/5 dark:border-white/5 pb-4">Integrations</h3>
            
            <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                  <Database size={20} />
                </div>
                <div>
                  <p className="font-bold">Supabase</p>
                  <p className="text-xs text-gray-500">Database & Authentication</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full">Connected</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                  <Globe size={20} />
                </div>
                <div>
                  <p className="font-bold">Gemini AI</p>
                  <p className="text-xs text-gray-500">Academic Intelligence Engine</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
