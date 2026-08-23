import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { creditCheck } from '../middleware/creditCheck';
import { executeAIGeneration } from '../services/aiFactory';
import { buildCulturalPrompt } from '../services/cultural';
import { validateOutput, checkRelevance } from '../services/validation';
import admin from 'firebase-admin';

const router = Router();

const PERSONAS: Record<string, string> = {
  friendly: "Explain like a curious 12-year-old. Simple words, real examples, warm and encouraging tone.",
  strict: "Rigorous, formal, precise academic language. Focus on accuracy and depth.",
  socratic: "Never give the direct answer. Guide through thought-provoking questions only.",
  exam: "Focus on mark-scheme language, exam technique, and maximizing marks.",
  research: "Act as peer-reviewer. Challenge assumptions, suggest literature, give critical feedback."
};

// Helper to strip markdown code fences
function stripFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/g, '');
    cleaned = cleaned.replace(/\n?```$/g, '');
    cleaned = cleaned.trim();
  }
  return cleaned;
}

// Helper to safely get project context from Firestore
async function getProjectContextServer(projectId: string, userId: string): Promise<string> {
  try {
    const db = admin.firestore();
    const docsSnapshot = await db.collection('documents')
      .where('project_id', '==', projectId)
      .where('user_id', '==', userId)
      .get();

    const notesSnapshot = await db.collection('notes')
      .where('project_id', '==', projectId)
      .where('user_id', '==', userId)
      .get();

    let docs = docsSnapshot.docs.map(d => d.data().content).join('\n\n');
    let notes = notesSnapshot.docs.map(n => n.data().content).join('\n\n');

    const maxChars = 100000;
    if (docs.length > maxChars) docs = docs.substring(0, maxChars) + "\n\n[CONTEXT TRUNCATED]";
    if (notes.length > maxChars) notes = notes.substring(0, maxChars) + "\n\n[CONTEXT TRUNCATED]";

    return `CONTEXT FROM PROJECT DOCUMENTS:\n${docs}\n\nCONTEXT FROM PROJECT NOTES:\n${notes}`;
  } catch (error) {
    console.error('[AI Route Context Helper] Error fetching Firestore context:', error);
    return '';
  }
}

/**
 * POST /api/ai/generate
 * Main core generative AI endpoint with full middleware chain
 */
router.post('/generate', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const {
      prompt,
      systemInstruction = '',
      responseMimeType,
      modelPreference = 'gemini',
      persona = '',
      region = 'default',
      originalPrompt = '',
      validationType,
      image,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    // 1. Build system prompt = persona + cultural grounding + systemInstruction
    const personaInstruction = PERSONAS[persona.toLowerCase()] || persona || '';
    const culturalGrounding = buildCulturalPrompt(region);
    const systemPrompt = [personaInstruction, culturalGrounding, systemInstruction].filter(Boolean).join('\n\n');

    console.log(`[AI Route] Executing generation via ${modelPreference} (validation: ${validationType || 'none'})...`);

    // 2. Call executeAIGeneration()
    let responseText = await executeAIGeneration(
      modelPreference,
      prompt,
      systemPrompt,
      responseMimeType,
      req.userApiKeys,
      image
    );

    // 3. Strip fences
    let cleanedText = stripFences(responseText);

    let validationPassed = true;
    let parsedData: any = null;
    let validationError = '';

    // 4. If responseMimeType is application/json or validationType is provided
    if (responseMimeType === 'application/json' || validationType) {
      const schemaName = validationType || 'research_validator';
      const check = validateOutput(cleanedText, schemaName);
      if (!check.success) {
        validationPassed = false;
        validationError = check.error || 'JSON Schema Validation failed.';
      } else {
        parsedData = check.data;
      }
    }

    // 5. If originalPrompt is provided: run relevance check
    if (validationPassed && originalPrompt) {
      if (!checkRelevance(originalPrompt, cleanedText)) {
        validationPassed = false;
        validationError = 'Relevance check failed (insufficient word overlap).';
      }
    }

    // 6. If validation fails: retry ONCE with stricter instructions
    if (!validationPassed) {
      console.warn(`[AI Route] Validation/relevance check failed: ${validationError}. Retrying ONCE with strict prompt...`);

      const strictPrompt = `STRICT: Return ONLY valid JSON. No preamble, no markdown fences.\n\n${prompt}`;

      responseText = await executeAIGeneration(
        modelPreference,
        strictPrompt,
        systemPrompt,
        responseMimeType,
        req.userApiKeys,
        image
      );

      cleanedText = stripFences(responseText);

      // Re-run validation
      if (responseMimeType === 'application/json' || validationType) {
        const schemaName = validationType || 'research_validator';
        const check = validateOutput(cleanedText, schemaName);
        if (!check.success) {
          return res.status(500).json({
            error: 'AI response failed safety/validation on both attempts.',
            raw: responseText,
            validationError: check.error
          });
        }
        parsedData = check.data;
      }

      if (originalPrompt && !checkRelevance(originalPrompt, cleanedText)) {
        return res.status(500).json({
          error: 'AI response failed safety/relevance checks on both attempts.'
        });
      }
    }

    const finalResult = parsedData || cleanedText;
    return res.json({ result: finalResult });

  } catch (err: any) {
    console.error('[AI Route /generate] Error:', err.message);
    return res.status(500).json({ error: err.message || 'AI generation failed.' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILITY ENDPOINTS (Map specific frontend tools to unified generation)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/notebook-action', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const { action, projectId, userQuery, useGrounding, userId } = req.body;
    const context = await getProjectContextServer(projectId, userId || req.user?.uid || '');

    let prompt = '';
    switch (action) {
      case 'summarize':
        prompt = `Based on the following context, provide a comprehensive summary of the key concepts and information:\n\n${context}`;
        break;
      case 'explain':
        prompt = `Based on the following context, explain the most complex topics in simple terms:\n\n${context}`;
        break;
      case 'exam_questions':
        prompt = `Based on the following context, generate 5 potential exam questions with brief answers:\n\n${context}`;
        break;
      case 'chat':
        prompt = `Context:\n${context}\n\nUser Question: ${userQuery}\n\nAnswer the user's question based on the provided context.`;
        break;
      case 'mindmap':
        prompt = `Based on the following context, generate a structured mindmap in Markdown format (using nested lists and bold headings):\n\n${context}`;
        break;
      case 'knowledge_graph':
        prompt = `Based on the following context, identify the key entities and their relationships. Format as a Markdown knowledge graph description:\n\n${context}`;
        break;
      default:
        prompt = `Analyze the following context:\n\n${context}`;
    }

    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'You are a highly precise learning copilot.',
      'text',
      req.userApiKeys
    );

    return res.json({ result: responseText, text: responseText });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/notebook/action', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  // Map /notebook/action (used in AskAI) to /notebook-action
  req.body.projectId = req.body.project_id;
  req.body.userQuery = req.body.query;
  req.body.useGrounding = req.body.use_grounding;
  req.body.userId = req.body.user_id;

  try {
    const { action, projectId, userQuery, userId } = req.body;
    const context = await getProjectContextServer(projectId, userId || req.user?.uid || '');
    const prompt = `Context:\n${context}\n\nUser Question: ${userQuery}\n\nAnswer the user's question based on the provided context.`;

    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'You are a helpful study companion.',
      'text',
      req.userApiKeys
    );
    return res.json(responseText);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/tune-question', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const { question } = req.body;
    const prompt = `Formulate a clearer, more academically precise version of this study question: "${question}".
Return your answer strictly in JSON matching: { "improved_question": "string" }`;

    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'You are a helpful socratic study coach.',
      'application/json',
      req.userApiKeys
    );
    const cleaned = stripFences(responseText);
    return res.json(JSON.parse(cleaned));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/generate-quiz', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, difficulty, projectId } = req.body;
    const context = await getProjectContextServer(projectId, req.user?.uid || '');

    const prompt = `Based on the following project context and the specific topic "${topic}", generate a quiz with 5 questions.
Difficulty: ${difficulty}
IMPORTANT: Provide explanations for correct and incorrect options. Return response in valid JSON matching 'quiz' schema format.`;

    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      `You are a strict examiner. Format: {"questions": [{"id": "q1", "type": "multiple_choice", "question": "...", "options": ["a", "b"], "correct_answer": "a", "explanation": "..."}]}`,
      'application/json',
      req.userApiKeys
    );

    const check = validateOutput(responseText, 'quiz');
    return res.json(check.data || JSON.parse(stripFences(responseText)));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/generate-mnemonic', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const { concept, style, projectId } = req.body;
    const context = await getProjectContextServer(projectId, req.user?.uid || '');

    const prompt = `Generate a mnemonic for "${concept}" in style "${style}" based on context:\n${context}`;
    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'Return format: {"mnemonic": "...", "explanation": "..."}',
      'application/json',
      req.userApiKeys
    );
    return res.json(JSON.parse(stripFences(responseText)));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/check-plagiarism', authenticateToken, rateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    const prompt = `Analyze this text for potential plagiarism: "${text}"`;
    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'Return format: {"similarity_score": 0, "analysis_summary": "...", "sources": []}',
      'application/json',
      req.userApiKeys
    );
    return res.json(JSON.parse(stripFences(responseText)));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/generate-visual', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, format, projectId } = req.body;
    const context = await getProjectContextServer(projectId, req.user?.uid || '');

    const prompt = `Generate a visual study aid schema for "${topic}" in format "${format}" using context:\n${context}`;
    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'Return JSON schema representing the requested visual format.',
      'application/json',
      req.userApiKeys
    );
    return res.json(JSON.parse(stripFences(responseText)));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/generate-exam', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, config } = req.body;
    const context = await getProjectContextServer(projectId, req.user?.uid || '');

    const prompt = `Generate a comprehensive exam based on this context:\n${context}\nConfig: ${JSON.stringify(config)}`;
    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'Return JSON matching standard exam schema containing lists of questions.',
      'application/json',
      req.userApiKeys
    );
    return res.json(JSON.parse(stripFences(responseText)));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/analyze-exam', authenticateToken, rateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const { exam, answers } = req.body;
    const prompt = `Analyze performance. Exam: ${JSON.stringify(exam)}, Answers: ${JSON.stringify(answers)}`;
    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'Return JSON matching performance analysis schema.',
      'application/json',
      req.userApiKeys
    );
    return res.json(JSON.parse(stripFences(responseText)));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/generate-course-ai', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.body;
    const context = await getProjectContextServer(projectId, req.user?.uid || '');

    const prompt = `Create structured course based on content:\n${context}`;
    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'Return JSON with structured syllabus containing modules and lessons.',
      'application/json',
      req.userApiKeys
    );
    return res.json({ id: admin.firestore().collection('courses').doc().id, ...JSON.parse(stripFences(responseText)) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/generate-study-guide', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.body;
    const context = await getProjectContextServer(projectId, req.user?.uid || '');

    const prompt = `Generate comprehensive study guide Markdown for context:\n${context}`;
    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'You are a brilliant study guide writer.',
      'text',
      req.userApiKeys
    );
    return res.json({ text: responseText, result: responseText });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/generate-slide-deck', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.body;
    const context = await getProjectContextServer(projectId, req.user?.uid || '');

    const prompt = `Generate a slide deck based on context:\n${context}`;
    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'Return slide deck as a JSON array of slide objects.',
      'application/json',
      req.userApiKeys
    );
    return res.json(JSON.parse(stripFences(responseText)));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/analyze-confusion', authenticateToken, rateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const { query, projectId } = req.body;
    const context = await getProjectContextServer(projectId, req.user?.uid || '');

    const prompt = `The user is confused about: "${query}". Based on context, provide simplified explanations:\n${context}`;
    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'Include simple analogies and step-by-step breakdowns.',
      'text',
      req.userApiKeys
    );
    return res.json({ text: responseText, result: responseText });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/concept-battle', authenticateToken, rateLimit, creditCheck, async (req: AuthRequest, res: Response) => {
  try {
    const { query, projectId, concepts } = req.body;
    const context = await getProjectContextServer(projectId, req.user?.uid || '');

    const prompt = concepts
      ? `Compare specific concepts: "${concepts[0]}" and "${concepts[1]}". Context:\n${context}`
      : `Start concept battle based on query: "${query}". Context:\n${context}`;

    const responseText = await executeAIGeneration(
      'gemini',
      prompt,
      'Return concept battle comparison JSON structure.',
      'application/json',
      req.userApiKeys
    );
    return res.json(JSON.parse(stripFences(responseText)));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
