import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { executeAIGeneration } from '../services/aiFactory.js';
import { validateOutput } from '../services/validation.js';
const router = Router();
/**
 * POST /api/research/extract-entities
 * Extracts the top 15 academic/research entities from a document text.
 */
router.post('/extract-entities', authenticateToken, async (req, res) => {
    try {
        const { docContent } = req.body;
        if (!docContent) {
            return res.status(400).json({ error: 'Document content (docContent) is required.' });
        }
        const systemInstruction = `You are a meticulous research parsing engine. Analyze the document text and extract the top 15 most significant academic or scientific entities (concepts, formulas, historical figures, organizations, theories, etc.).
For each entity, output its name, a high-level category (e.g. Theory, Equation, Person), and a concise one-sentence explanation of its relevance in the text.
You MUST format your response as valid JSON matching this schema:
{
  "entities": [
    { "name": "string", "category": "string", "relevance": "string" }
  ]
}`;
        const prompt = `DOCUMENT CONTENT:\n${docContent}`;
        console.log('[Research API] Generating entity extraction via Gemini...');
        const rawResult = await executeAIGeneration('gemini', prompt, systemInstruction, 'application/json', req.userApiKeys);
        // Validate using Zod research_validator
        const validation = validateOutput(rawResult, 'research_validator');
        if (!validation.success) {
            console.warn('[Research API] Initial schema validation failed. Retrying with stricter instructions...');
            // Retry once
            const strictInstruction = `${systemInstruction}\n\nSTRICT: Return ONLY valid JSON matching the schema. No markdown wrapping. No preamble.`;
            const retryResult = await executeAIGeneration('gemini', prompt, strictInstruction, 'application/json', req.userApiKeys);
            const retryValidation = validateOutput(retryResult, 'research_validator');
            if (!retryValidation.success) {
                return res.status(500).json({
                    error: 'Failed to extract entities in a valid JSON structure.',
                    raw: retryResult
                });
            }
            return res.json({ result: retryValidation.data });
        }
        return res.json({ result: validation.data });
    }
    catch (err) {
        console.error('[Research API - extract-entities] Error:', err.message);
        return res.status(500).json({ error: err.message || 'Entity extraction failed.' });
    }
});
/**
 * POST /api/research/query-corpus
 * Answers a research query solely using context from the document corpus.
 */
router.post('/query-corpus', authenticateToken, async (req, res) => {
    try {
        const { query, corpusText } = req.body;
        if (!query || !corpusText) {
            return res.status(400).json({ error: 'Both query and corpusText are required.' });
        }
        const systemInstruction = `You are an advanced academic research assistant. Answer the user's research query based strictly on the provided document corpus content.
Do not hallucinate or use external knowledge not contained in the corpus. If the answer is not in the text, clearly state that.
For your answer, extract relevant verbatim or close source excerpts/quotes to validate your claims.
You MUST format your response as valid JSON matching this schema:
{
  "answer": "string",
  "sources": [
    { "title": "string", "excerpt": "string" }
  ]
}`;
        const prompt = `RESEARCH QUERY: ${query}\n\nDOCUMENT CORPUS:\n${corpusText}`;
        console.log('[Research API] Querying corpus via Gemini...');
        const rawResult = await executeAIGeneration('gemini', prompt, systemInstruction, 'application/json', req.userApiKeys);
        const validation = validateOutput(rawResult, 'research_validator');
        if (!validation.success) {
            console.warn('[Research API] Initial query-corpus schema validation failed. Retrying with stricter instructions...');
            const strictInstruction = `${systemInstruction}\n\nSTRICT: Return ONLY valid JSON matching the schema. No markdown wrapping. No preamble.`;
            const retryResult = await executeAIGeneration('gemini', prompt, strictInstruction, 'application/json', req.userApiKeys);
            const retryValidation = validateOutput(retryResult, 'research_validator');
            if (!retryValidation.success) {
                return res.status(500).json({
                    error: 'Failed to query the document corpus in a valid JSON structure.',
                    raw: retryResult
                });
            }
            return res.json({ result: retryValidation.data });
        }
        return res.json({ result: validation.data });
    }
    catch (err) {
        console.error('[Research API - query-corpus] Error:', err.message);
        return res.status(500).json({ error: err.message || 'Corpus querying failed.' });
    }
});
/**
 * POST /api/research/doc-chat
 * Performs a multi-turn conversation focused on a single document's content.
 */
router.post('/doc-chat', authenticateToken, async (req, res) => {
    try {
        const { message, history, docContent } = req.body;
        if (!message || !docContent) {
            return res.status(400).json({ error: 'Both message and docContent are required.' });
        }
        const conversationHistory = Array.isArray(history) ? history : [];
        const systemInstruction = `You are an expert tutor engaged in a multi-turn chat about a specific academic document.
Your objective is to help the student understand this document deeply by answering questions, clarifying terms, and raising socratic prompts when appropriate.
Keep your answers highly accurate, grounded on the document content, and directly related to their queries.`;
        // Construct dialogue context
        let prompt = `DOCUMENT CONTENT:\n${docContent}\n\n`;
        prompt += 'CONVERSATION RECORD:\n';
        for (const turn of conversationHistory) {
            const roleName = turn.role === 'user' ? 'Student' : 'Tutor';
            prompt += `${roleName}: ${turn.content || turn.text || ''}\n`;
        }
        prompt += `Student: ${message}\nTutor:`;
        console.log('[Research API] Executing doc-chat turn via Gemini...');
        const responseText = await executeAIGeneration('gemini', prompt, systemInstruction, 'text', req.userApiKeys);
        return res.json({ result: responseText });
    }
    catch (err) {
        console.error('[Research API - doc-chat] Error:', err.message);
        return res.status(500).json({ error: err.message || 'Doc chat conversation failed.' });
    }
});
export default router;
