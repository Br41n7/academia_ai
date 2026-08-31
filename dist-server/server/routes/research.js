import { Router } from 'express';
import { executeAI } from '../services/aiFactory.js';
const router = Router();
router.post('/extract-entities', async (req, res) => {
    const { docContent } = req.body;
    if (!docContent) {
        res.status(400).json({ error: 'Missing docContent' });
        return;
    }
    try {
        const raw = await executeAI({
            task: 'extract_entities',
            prompt: `Extract top 15 key entities from the following text:\n\n${docContent.substring(0, 15000)}`,
            systemInstruction: 'Respond ONLY in JSON format with key "entities" containing an array of objects with fields: name, category, relevance.',
            responseFormat: 'json',
            userKeys: req.userApiKeys
        });
        res.json(JSON.parse(raw));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/query-corpus', async (req, res) => {
    const { query, corpus } = req.body;
    if (!query) {
        res.status(400).json({ error: 'Missing query' });
        return;
    }
    try {
        const raw = await executeAI({
            task: 'query_corpus',
            prompt: `Answer query "${query}" using ONLY the following document corpus excerpts:\n\n${JSON.stringify(corpus || []).substring(0, 20000)}`,
            systemInstruction: 'Respond ONLY in JSON with fields "answer" and "excerpts" containing array of objects with documentTitle, quote, explanation.',
            responseFormat: 'json',
            userKeys: req.userApiKeys
        });
        res.json(JSON.parse(raw));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/doc-chat', async (req, res) => {
    const { message, history, docContent, docTitle } = req.body;
    if (!message) {
        res.status(400).json({ error: 'Missing message' });
        return;
    }
    try {
        const text = await executeAI({
            task: 'doc_chat',
            prompt: `Document Title: ${docTitle || 'Study Material'}
Document Content Excerpt:
${(docContent || '').substring(0, 10000)}

User Question: ${message}`,
            systemInstruction: 'You are an intelligent study partner. Answer questions accurately based on the document provided.',
            userKeys: req.userApiKeys
        });
        res.json({ text });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
