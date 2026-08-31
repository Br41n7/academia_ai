import React, { useState } from 'react';
import { generateContent } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { HelpCircle, CheckCircle2, XCircle, Sparkles, Trophy } from 'lucide-react';

interface QuizProps {
  projectId: string;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export default function Quiz({ projectId }: QuizProps) {
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loading) return;

    setLoading(true);
    setQuestions([]);
    setSelectedAnswers({});
    setSubmitted(false);

    try {
      const raw = await generateContent({
        task: 'quiz',
        prompt: `Generate a 5-question multiple choice quiz on topic: "${topic}". Each question should have 4 options and an explanation.`,
        responseFormat: 'json',
        validationType: 'quiz'
      });

      const parsed = JSON.parse(raw);
      setQuestions(parsed.questions || []);
    } catch (err: any) {
      alert(`Quiz generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuiz = async () => {
    let pts = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctAnswer) pts++;
    });
    setScore(pts);
    setSubmitted(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Save quiz attempt
        await supabase.from('quiz_attempts').insert({
          project_id: projectId,
          user_id: user.id,
          topic,
          score: pts,
          total: questions.length,
          answers: selectedAnswers
        });

        // Award points
        await apiFetch('/api/profiles/me/points', {
          method: 'POST',
          body: JSON.stringify({ points: pts * 10, reason: 'Completed quiz' })
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to save quiz attempt:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Quiz Generator</h1>
        <p className="text-gray-500 text-sm">Generate practice quizzes tailored to your topic</p>
      </div>

      <form onSubmit={handleGenerateQuiz} className="flex gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter topic (e.g. Photosynthesis, Quantum Mechanics)..."
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles size={18} />
          {loading ? 'Generating...' : 'Generate Quiz'}
        </button>
      </form>

      {questions.length > 0 && (
        <div className="space-y-6">
          {questions.map((q, qIdx) => (
            <div key={qIdx} className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-4">
              <p className="font-semibold text-base">{qIdx + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[qIdx] === opt;
                  const isCorrect = opt === q.correctAnswer;
                  let style = 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800/50';

                  if (submitted) {
                    if (isCorrect) style = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300';
                    else if (isSelected) style = 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300';
                  } else if (isSelected) {
                    style = 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30';
                  }

                  return (
                    <button
                      key={optIdx}
                      disabled={submitted}
                      onClick={() => setSelectedAnswers({ ...selectedAnswers, [qIdx]: opt })}
                      className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all flex items-center justify-between ${style}`}
                    >
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <div className="pt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 p-3 rounded-xl border border-gray-100 dark:border-zinc-700">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Explanation: </span>
                  {q.explanation}
                </div>
              )}
            </div>
          ))}

          {!submitted ? (
            <button
              onClick={handleSubmitQuiz}
              disabled={Object.keys(selectedAnswers).length < questions.length}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md disabled:opacity-50"
            >
              Submit Quiz
            </button>
          ) : (
            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-6 rounded-2xl text-center space-y-2">
              <Trophy className="mx-auto text-amber-500" size={32} />
              <h3 className="text-xl font-bold">Quiz Complete!</h3>
              <p className="text-sm font-medium">You scored {score} out of {questions.length} ({Math.round((score / questions.length) * 100)}%)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
