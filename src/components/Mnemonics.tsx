import React, { useState } from 'react';
import { generateContent } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import { Sparkles, Brain, ArrowRight } from 'lucide-react';

interface MnemonicsProps {
  projectId: string;
}

interface Flashcard {
  id?: string;
  concept: string;
  mnemonic: string;
  explanation: string;
}

export default function Mnemonics({ projectId }: MnemonicsProps) {
  const [concept, setConcept] = useState('');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concept.trim() || loading) return;

    setLoading(true);
    try {
      const raw = await generateContent({
        task: 'mnemonic',
        prompt: `Create a memorable mnemonic and visual story concept for: "${concept}". Format output as JSON with fields "mnemonic" and "explanation".`,
        responseFormat: 'json',
        validationType: 'mnemonic'
      });

      const parsed = JSON.parse(raw);
      const newCard: Flashcard = {
        concept,
        mnemonic: parsed.mnemonic || '',
        explanation: parsed.explanation || ''
      };

      setFlashcards([newCard, ...flashcards]);
      setConcept('');

      // Save to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('flashcards').insert({
          project_id: projectId,
          user_id: user.id,
          concept: newCard.concept,
          mnemonic: newCard.mnemonic,
          explanation: newCard.explanation
        });
      }
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mnemonic & Memory Helper</h1>
        <p className="text-gray-500 text-sm">Generate visual mnemonics for hard-to-remember concepts</p>
      </div>

      <form onSubmit={handleGenerate} className="flex gap-2">
        <input
          type="text"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="Concept or terms to memorize..."
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Brain size={18} />
          {loading ? 'Creating...' : 'Create Mnemonic'}
        </button>
      </form>

      <div className="space-y-4">
        {flashcards.map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-3">
            <h3 className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{card.concept}</h3>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-900 dark:text-indigo-200 font-semibold text-base">
              🔑 {card.mnemonic}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">{card.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
