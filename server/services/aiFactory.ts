import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

// Task routing — determines which provider is primary
const GROQ_TASKS = [
  'course_builder', 'study_guide', 'slide_deck',
  'flashcard', 'mnemonic', 'shortcut'
];

const GEMINI_TASKS = [
  'living_concept', 'snap_solve', 'quiz', 'exam',
  'concept_battle', 'research_validator', 'storyboard',
  'notebook', 'confusion', 'doc_chat', 'extract_entities', 'query_corpus'
];

export async function executeAI(options: {
  task: string;
  prompt: string;
  systemInstruction: string;
  responseFormat?: 'json' | 'text';
  image?: { base64: string; mimeType: string };
  userKeys?: { groqKey?: string };
}): Promise<string> {

  const { task, prompt, systemInstruction, responseFormat, image, userKeys } = options;

  // Vision tasks always go to Gemini (Groq/DeepSeek no vision support here)
  const needsVision = !!image;
  const primaryProvider = (needsVision || GEMINI_TASKS.includes(task))
    ? 'gemini'
    : 'groq';

  const errors: string[] = [];

  // Provider fallback order: Primary -> Secondary -> DeepSeek
  const providerOrder = primaryProvider === 'gemini'
    ? ['gemini', 'groq', 'deepseek']
    : ['groq', 'gemini', 'deepseek'];

  for (const provider of providerOrder) {
    try {
      if (provider === 'gemini') {
        const key = process.env.GEMINI_API_KEY;
        if (!key) { errors.push('Gemini: no key'); continue; }

        const ai = new GoogleGenAI({ apiKey: key });
        const contents: any[] = [];

        if (image) {
          contents.push({ inlineData: { data: image.base64, mimeType: image.mimeType } });
        }
        contents.push(prompt);

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents,
          config: {
            systemInstruction,
            responseMimeType: responseFormat === 'json' ? 'application/json' : undefined,
          }
        });

        const text = response.text;
        if (!text) throw new Error('Empty response from Gemini');
        return text;
      }

      if (provider === 'groq') {
        const key = userKeys?.groqKey || process.env.GROQ_API_KEY;
        if (!key) { errors.push('Groq: no key'); continue; }

        const groq = new Groq({ apiKey: key });
        const messages: any[] = [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ];

        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages,
          response_format: responseFormat === 'json'
            ? { type: 'json_object' }
            : undefined,
          max_tokens: 8000,
          temperature: 0.7,
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) throw new Error('Empty response from Groq');
        return text;
      }

      if (provider === 'deepseek') {
        const key = process.env.DEEPSEEK_API_KEY;
        if (!key) { errors.push('DeepSeek: no key'); continue; }

        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
            response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined,
            max_tokens: 4096,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('Empty response from DeepSeek');
        return text;
      }

    } catch (err: any) {
      errors.push(`${provider}: ${err.message}`);
      console.warn(`[AIFactory] ${provider} failed:`, err.message);
    }
  }

  throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
}
