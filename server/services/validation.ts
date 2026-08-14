import { z } from 'zod';

export const quizSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum(['multiple_choice', 'true_false', 'fill_blank']),
    question: z.string(),
    options: z.array(z.string()).nullable().optional(),
    correct_answer: z.string(),
    explanation: z.string()
  }))
});

export const mnemonicSchema = z.object({
  mnemonic: z.string(),
  explanation: z.string()
});

export const battleSchema = z.object({
  concepts: z.array(z.string()),
  comparison: z.array(z.object({
    feature: z.string(),
    concept1: z.string(),
    concept2: z.string()
  })),
  analogy: z.string(),
  scenario: z.string(),
  quiz_question: z.object({
    question: z.string(),
    options: z.array(z.string()),
    correct_answer: z.string(),
    explanation: z.string()
  }).nullable().optional()
});

export const storyboardSchema = z.object({
  title: z.string(),
  scenes: z.array(z.object({
    scene_number: z.number(),
    narrative: z.string(),
    visual_description: z.string(),
    key_takeaway: z.string()
  }))
});

export const snapSolveSchema = z.object({
  problem: z.string(),
  steps: z.array(z.string()),
  final_answer: z.string(),
  explanation: z.string()
});

export const shortcutSchema = z.object({
  concept: z.string(),
  rule: z.string(),
  example: z.string()
});

export const livingConceptSchema = z.object({
  concept_name: z.string(),
  real_world_analogy: z.string(),
  interactive_metaphor: z.string()
});

export const researchValidatorSchema = z.object({
  entities: z.array(z.object({
    name: z.string(),
    category: z.string(),
    relevance: z.string()
  })).optional(),
  answer: z.string().optional(),
  sources: z.array(z.object({
    title: z.string(),
    excerpt: z.string()
  })).optional()
});

export const SCHEMAS: Record<string, z.ZodSchema> = {
  quiz: quizSchema,
  mnemonic: mnemonicSchema,
  battle: battleSchema,
  storyboard: storyboardSchema,
  snap_solve: snapSolveSchema,
  shortcut: shortcutSchema,
  living_concept: livingConceptSchema,
  research_validator: researchValidatorSchema
};

export interface ParsedResult {
  success: boolean;
  data: any;
  error?: string;
}

export function validateOutput(raw: string, schemaName: string): ParsedResult {
  const schema = SCHEMAS[schemaName];
  if (!schema) {
    return { success: false, data: null, error: `Schema ${schemaName} not found.` };
  }

  try {
    // 1. Strip markdown code fences (```json ... ```)
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/g, '');
      cleaned = cleaned.replace(/\n?```$/g, '');
      cleaned = cleaned.trim();
    }

    // 2. Parse JSON
    const parsed = JSON.parse(cleaned);

    // 3. Run safe validation
    const parsedRes = schema.safeParse(parsed);
    if (!parsedRes.success) {
      return {
        success: false,
        data: parsed,
        error: parsedRes.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      };
    }

    return { success: true, data: parsedRes.data };
  } catch (err: any) {
    return { success: false, data: null, error: `JSON Parse error: ${err.message}` };
  }
}

export function checkRelevance(originalPrompt: string, response: string): boolean {
  if (!originalPrompt) return true;

  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'to', 'for', 'in', 'of', 'with', 'by',
    'or', 'about', 'your', 'my', 'me', 'i', 'you', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'but', 'if', 'then', 'else', 'from', 'this', 'that'
  ]);

  // Extract unique significant words from prompt
  const promptWords = originalPrompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  const uniquePromptWords = Array.from(new Set(promptWords));
  if (uniquePromptWords.length === 0) {
    return true; // If no significant words, consider it relevant
  }

  const responseLower = response.toLowerCase();
  let matchedCount = 0;

  for (const word of uniquePromptWords) {
    if (responseLower.includes(word)) {
      matchedCount++;
    }
  }

  const overlapRatio = matchedCount / uniquePromptWords.length;
  console.log(`[Relevance Check] Words matched: ${matchedCount}/${uniquePromptWords.length} (${(overlapRatio * 100).toFixed(1)}%)`);

  return overlapRatio >= 0.1; // minimum 10% keyword overlap
}
