import { apiFetch } from '../lib/api';

export async function generateContent(options: {
  task: string;
  prompt: string;
  systemInstruction?: string;
  responseFormat?: 'json' | 'text';
  persona?: string;
  region?: string;
  originalPrompt?: string;
  validationType?: string;
  image?: { base64: string; mimeType: string };
}): Promise<string> {
  const data = await apiFetch('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify(options)
  });
  return data.result;
}

export async function conceptBattle(query?: string, projectId?: string, concepts?: [string, string]): Promise<any> {
  const prompt = query
    ? `Create a concept battle comparison for query: "${query}"`
    : `Create a concept battle comparing "${concepts?.[0] || 'Concept A'}" vs "${concepts?.[1] || 'Concept B'}"`;

  const raw = await generateContent({
    task: 'concept_battle',
    prompt,
    responseFormat: 'json'
  });

  try {
    return JSON.parse(raw);
  } catch {
    return {
      concepts: concepts || ['Concept A', 'Concept B'],
      comparison: [
        { feature: 'Core Principle', concept1: 'Primary approach', concept2: 'Secondary approach' }
      ],
      analogy: 'Imagine two different drivers on the same road.',
      scenario: 'In real life, each concept is used in specific conditions.',
      quiz_question: {
        question: 'Which concept is better suited for speed?',
        options: [concepts?.[0] || 'Concept A', concepts?.[1] || 'Concept B'],
        correct_answer: concepts?.[0] || 'Concept A',
        explanation: 'Concept A prioritizes processing speed.'
      }
    };
  }
}

export async function analyzeConfusion(confusionText: string): Promise<any> {
  const raw = await generateContent({
    task: 'confusion',
    prompt: `Analyze and resolve student confusion: "${confusionText}"`,
    responseFormat: 'json'
  });
  try {
    return JSON.parse(raw);
  } catch {
    return { explanation: raw };
  }
}

export async function generateSlideDeck(topic: string): Promise<any> {
  const raw = await generateContent({
    task: 'slide_deck',
    prompt: `Generate a presentation slide deck for topic: "${topic}"`,
    responseFormat: 'json'
  });
  try {
    return JSON.parse(raw);
  } catch {
    return { slides: [] };
  }
}

export async function generateStudyGuide(topic: string): Promise<any> {
  const raw = await generateContent({
    task: 'study_guide',
    prompt: `Generate a comprehensive study guide for topic: "${topic}"`,
    responseFormat: 'json'
  });
  try {
    return JSON.parse(raw);
  } catch {
    return { summary: raw };
  }
}

export async function generateVisual(prompt: string): Promise<any> {
  const raw = await generateContent({
    task: 'living_concept',
    prompt: `Generate visual concept illustration details for: "${prompt}"`,
    responseFormat: 'json'
  });
  try {
    return JSON.parse(raw);
  } catch {
    return { visual: raw };
  }
}
