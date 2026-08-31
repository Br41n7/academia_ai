import React, { useState } from 'react';
import { generateContent } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { GraduationCap, Sparkles, Trophy, CheckCircle } from 'lucide-react';

interface ExamModeProps {
  projectId: string;
  onNavigate?: (tab: string) => void;
}

export default function ExamMode({ projectId, onNavigate }: ExamModeProps) {
  const [examType, setExamType] = useState('WAEC');
  const [subject, setSubject] = useState('');
  const [examData, setExamData] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || loading) return;

    setLoading(true);
    setExamData(null);
    setAnalysis(null);

    try {
      const raw = await generateContent({
        task: 'exam',
        prompt: `Generate a past-question style exam paper for ${examType} syllabus in subject "${subject}". Format response as JSON with questions list and mark scheme.`,
        responseFormat: 'json',
        validationType: 'exam'
      });

      const parsed = JSON.parse(raw);
      setExamData(parsed);
    } catch (err: any) {
      alert(`Exam generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGradeExam = async () => {
    if (!examData) return;
    setLoading(true);

    try {
      const raw = await generateContent({
        task: 'exam',
        prompt: `Grade these student answers against the exam mark scheme:
          Exam: ${JSON.stringify(examData)}
          Student Answers: ${JSON.stringify(answers)}
          Return JSON with score, total, and analysis feedback.`,
        responseFormat: 'json'
      });

      const parsed = JSON.parse(raw);
      setAnalysis(parsed);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('exam_attempts').insert({
          project_id: projectId,
          user_id: user.id,
          exam_data: examData,
          answers,
          analysis: parsed,
          score: parsed.score || 0
        });

        await apiFetch('/api/profiles/me/points', {
          method: 'POST',
          body: JSON.stringify({ points: (parsed.score || 1) * 20, reason: 'Completed exam simulation' })
        }).catch(() => {});
      }
    } catch (err: any) {
      alert(`Grading failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exam Simulation Mode</h1>
        <p className="text-gray-500 text-sm">Simulate WAEC, JAMB, KCSE, or NSC standard past exams</p>
      </div>

      <form onSubmit={handleGenerateExam} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          value={examType}
          onChange={(e) => setExamType(e.target.value)}
          className="px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="WAEC">WAEC (WASSCE)</option>
          <option value="JAMB">JAMB / UTME</option>
          <option value="KCSE">KCSE (Kenya)</option>
          <option value="NSC">NSC / Matric (South Africa)</option>
          <option value="IGCSE">IGCSE / O-Level</option>
        </select>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (e.g. Physics, Economics)..."
          className="px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <GraduationCap size={18} />
          {loading ? 'Generating...' : 'Start Exam'}
        </button>
      </form>

      {examData && (
        <div className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-xl font-bold">{examType} {subject} Simulation</h2>

          <div className="space-y-6">
            {(examData.questions || []).map((q: any, qIdx: number) => (
              <div key={qIdx} className="border-b border-gray-100 dark:border-zinc-800 pb-4 space-y-3">
                <p className="font-semibold text-sm">{qIdx + 1}. {q.question || q.text}</p>
                <textarea
                  value={answers[qIdx] || ''}
                  onChange={(e) => setAnswers({ ...answers, [qIdx]: e.target.value })}
                  placeholder="Type your answer / solution steps here..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleGradeExam}
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md disabled:opacity-50"
          >
            {loading ? 'Grading Exam...' : 'Submit & Grade Exam'}
          </button>
        </div>
      )}

      {analysis && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-6 rounded-2xl space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="text-amber-500" size={24} />
            Exam Analysis & Feedback
          </h3>
          <p className="font-semibold text-lg">Score: {analysis.score} / {analysis.total || examData?.questions?.length}</p>
          <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{analysis.feedback || JSON.stringify(analysis)}</p>
        </div>
      )}
    </div>
  );
}
