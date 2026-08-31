import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { creditCheck } from '../middleware/creditCheck.js';
import { executeAI } from '../services/aiFactory.js';
import { buildCulturalPrompt } from '../services/cultural.js';
import { validateOutput, checkRelevance } from '../services/validation.js';
import { supabaseForUser } from '../services/supabaseAdmin.js';
const router = Router();
const PERSONA_INSTRUCTIONS = {
    friendly: 'Explain like a curious 12-year-old. Simple, warm, encouraging.',
    strict: 'Rigorous, formal, precise academic language. Depth over brevity.',
    socratic: 'Guide through questions only. Never give the direct answer.',
    exam: 'Mark-scheme language. Exam technique. Maximise marks.',
    research: 'Peer-reviewer mode. Challenge assumptions. Reference literature.'
};
router.post('/generate', authenticateToken, rateLimit(20, 60000), creditCheck, async (req, res) => {
    const { task, prompt, systemInstruction = '', responseFormat, persona, region, originalPrompt, validationType, image } = req.body;
    if (!task || !prompt) {
        res.status(400).json({ error: 'Missing required parameters: task and prompt.' });
        return;
    }
    try {
        const userSupabase = supabaseForUser(req.accessToken);
        const { data: profile } = await userSupabase
            .from('profiles')
            .select('persona, region, custom_agent_prompt')
            .eq('id', req.user.id)
            .single();
        const selectedPersona = persona || profile?.persona || 'friendly';
        const selectedRegion = region || profile?.region || 'Nigeria';
        let personaText = PERSONA_INSTRUCTIONS[selectedPersona] || PERSONA_INSTRUCTIONS.friendly;
        if (selectedPersona === 'custom' && profile?.custom_agent_prompt) {
            personaText = profile.custom_agent_prompt;
        }
        const culturalBlock = buildCulturalPrompt(selectedRegion);
        const fullSystemInstruction = `${personaText}\n\n${culturalBlock}\n\n${systemInstruction}`;
        let resultText = await executeAI({
            task,
            prompt,
            systemInstruction: fullSystemInstruction,
            responseFormat,
            image,
            userKeys: req.userApiKeys
        });
        // Clean fence markers if JSON requested
        let cleanText = resultText.trim();
        if (responseFormat === 'json') {
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            }
            else if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
        }
        // Validate if schema validation requested
        if (validationType || responseFormat === 'json') {
            const vResult = validateOutput(cleanText, validationType || task);
            const isRelevant = originalPrompt ? checkRelevance(originalPrompt, cleanText) : true;
            if (!vResult.success || !isRelevant) {
                console.warn(`[AI Route] Validation/relevance failed on first attempt. Retrying with strict prompt...`);
                // Retry ONCE with stricter prefix
                const strictPrompt = `STRICT: Return ONLY valid JSON matching schema without any markdown formatting, preambles, or explanations.\n\n${prompt}`;
                resultText = await executeAI({
                    task,
                    prompt: strictPrompt,
                    systemInstruction: fullSystemInstruction,
                    responseFormat: 'json',
                    image,
                    userKeys: req.userApiKeys
                });
                cleanText = resultText.trim();
                if (cleanText.startsWith('```json')) {
                    cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                }
                else if (cleanText.startsWith('```')) {
                    cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
                }
                const vResultSecond = validateOutput(cleanText, validationType || task);
                if (!vResultSecond.success) {
                    res.status(500).json({ error: `AI output validation failed: ${vResultSecond.error}` });
                    return;
                }
            }
        }
        res.json({ result: cleanText });
    }
    catch (err) {
        console.error('[AI Route Error]', err.message);
        res.status(500).json({ error: err.message || 'AI generation failed.' });
    }
});
export default router;
