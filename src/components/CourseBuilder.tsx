import React, { useState, useEffect } from 'react';
import { generateContent } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { BookOpen, Sparkles, CheckCircle2, Play, Award } from 'lucide-react';

interface CourseBuilderProps {
  projectId: string;
  onNavigate?: (tab: string) => void;
}

export default function CourseBuilder({ projectId, onNavigate }: CourseBuilderProps) {
  const [topic, setTopic] = useState('');
  const [course, setCourse] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBuildCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;

    setLoading(true);
    try {
      const raw = await generateContent({
        task: 'course_builder',
        prompt: `Build a comprehensive structured course on: "${topic}". Response must strictly follow the structured course JSON format with title, description, and modules containing detailed lessons.`,
        responseFormat: 'json'
      });

      const parsed = JSON.parse(raw);
      setCourse(parsed);

      // Save course to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('courses').insert({
          project_id: projectId,
          user_id: user.id,
          title: parsed.title || topic,
          description: parsed.description || '',
          modules: parsed.modules || []
        });
      }
    } catch (err: any) {
      alert(`Course building failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Course Architect</h1>
        <p className="text-gray-500 text-sm">Generate structured Coursera/Udemy style courses from any subject</p>
      </div>

      <form onSubmit={handleBuildCourse} className="flex gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What do you want to learn today?"
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles size={18} />
          {loading ? 'Building Course...' : 'Build Course'}
        </button>
      </form>

      {course && (
        <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-full">
              {course.skill_level || 'Beginner to Advanced'}
            </span>
            <h2 className="text-2xl font-bold mt-2">{course.title}</h2>
            <p className="text-gray-500 text-sm mt-1">{course.description}</p>
          </div>

          <div className="space-y-4">
            {course.modules?.map((mod: any, mIdx: number) => (
              <div key={mIdx} className="border border-gray-100 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-base text-gray-800 dark:text-gray-200">
                  Module {mod.module_number || mIdx + 1}: {mod.title}
                </h3>
                <p className="text-xs text-gray-500">{mod.description}</p>

                <div className="space-y-2 pt-2">
                  {mod.lessons?.map((les: any, lIdx: number) => (
                    <div key={lIdx} className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg text-sm space-y-1">
                      <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                        Lesson {les.lesson_number || lIdx + 1}: {les.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">{les.summary || les.content?.substring(0, 150)}...</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
