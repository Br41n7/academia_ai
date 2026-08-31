import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { YoutubeTranscript } from 'youtube-transcript';
import { supabaseForUser } from '../services/supabaseAdmin.js';
import { parsePdfBuffer, sanitizeText, chunkText } from '../services/pdf.js';
const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
});
router.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    const projectId = req.body.projectId;
    if (!file || !projectId) {
        res.status(400).json({ error: 'Missing file or projectId.' });
        return;
    }
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (extension !== 'pdf' && extension !== 'txt') {
        res.status(400).json({ error: 'Only PDF and TXT files are accepted.' });
        return;
    }
    try {
        let rawText = '';
        if (extension === 'pdf') {
            rawText = await parsePdfBuffer(file.buffer);
        }
        else {
            rawText = file.buffer.toString('utf-8');
        }
        const cleanText = sanitizeText(rawText);
        if (!cleanText) {
            res.status(422).json({
                error: 'No readable text found. Ensure your PDF is text-searchable, not a scanned image.'
            });
            return;
        }
        const chunks = chunkText(cleanText);
        const preview = cleanText.substring(0, 12000);
        const filePath = `${req.user.id}/${projectId}/${uuidv4()}-${file.originalname}`;
        const userSupabase = supabaseForUser(req.accessToken);
        // Upload file to Supabase Storage bucket 'documents'
        const { error: storageErr } = await userSupabase.storage
            .from('documents')
            .upload(filePath, file.buffer, { contentType: file.mimetype });
        if (storageErr) {
            console.error('[Storage Error]', storageErr.message);
        }
        // Insert record in documents table
        const { data: docRecord, error: dbErr } = await userSupabase
            .from('documents')
            .insert({
            project_id: projectId,
            user_id: req.user.id,
            name: file.originalname,
            content: preview,
            chunks,
            chunk_count: chunks.length,
            source_type: extension,
            file_path: filePath,
            file_size: file.size
        })
            .select()
            .single();
        if (dbErr) {
            res.status(500).json({ error: dbErr.message });
            return;
        }
        res.json({
            id: docRecord.id,
            name: docRecord.name,
            chunk_count: docRecord.chunk_count,
            content_preview: docRecord.content
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to process document.' });
    }
});
router.post('/import-url', async (req, res) => {
    const { url, projectId } = req.body;
    if (!url || !projectId) {
        res.status(400).json({ error: 'Missing url or projectId.' });
        return;
    }
    try {
        let rawText = '';
        let name = 'Imported Webpage';
        if (url.includes('docs.google.com/document/d/')) {
            const docId = url.split('/d/')[1].split('/')[0];
            const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
            const response = await fetch(exportUrl);
            rawText = await response.text();
            name = 'Imported Google Doc';
        }
        else {
            const response = await fetch(url);
            const html = await response.text();
            rawText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ');
            name = new URL(url).hostname;
        }
        const cleanText = sanitizeText(rawText);
        if (!cleanText) {
            res.status(422).json({ error: 'No readable text could be extracted from URL.' });
            return;
        }
        const chunks = chunkText(cleanText);
        const preview = cleanText.substring(0, 12000);
        const userSupabase = supabaseForUser(req.accessToken);
        const { data: docRecord, error: dbErr } = await userSupabase
            .from('documents')
            .insert({
            project_id: projectId,
            user_id: req.user.id,
            name,
            content: preview,
            chunks,
            chunk_count: chunks.length,
            source_type: 'url'
        })
            .select()
            .single();
        if (dbErr) {
            res.status(500).json({ error: dbErr.message });
            return;
        }
        res.json({
            id: docRecord.id,
            name: docRecord.name,
            chunk_count: docRecord.chunk_count,
            content_preview: docRecord.content
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to import URL.' });
    }
});
router.post('/youtube/transcript', async (req, res) => {
    const { url, projectId } = req.body;
    if (!url) {
        res.status(400).json({ error: 'Missing YouTube URL.' });
        return;
    }
    try {
        let videoId = '';
        if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        }
        else if (url.includes('youtube.com/watch')) {
            videoId = new URL(url).searchParams.get('v') || '';
        }
        else if (url.includes('youtube.com/shorts/')) {
            videoId = url.split('youtube.com/shorts/')[1].split('?')[0];
        }
        if (!videoId) {
            res.status(400).json({ error: 'Invalid YouTube URL.' });
            return;
        }
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        const fullText = transcriptItems.map(item => item.text).join(' ');
        const cleanText = sanitizeText(fullText);
        if (projectId) {
            const chunks = chunkText(cleanText);
            const userSupabase = supabaseForUser(req.accessToken);
            await userSupabase.from('documents').insert({
                project_id: projectId,
                user_id: req.user.id,
                name: `YouTube Transcript (${videoId})`,
                content: cleanText.substring(0, 12000),
                chunks,
                chunk_count: chunks.length,
                source_type: 'youtube'
            });
        }
        res.json({ text: cleanText, videoId });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch YouTube transcript.' });
    }
});
router.delete('/:id', async (req, res) => {
    const docId = req.params.id;
    const userSupabase = supabaseForUser(req.accessToken);
    try {
        const { data: doc } = await userSupabase
            .from('documents')
            .select('file_path')
            .eq('id', docId)
            .single();
        if (doc?.file_path) {
            await userSupabase.storage.from('documents').remove([doc.file_path]);
        }
        await userSupabase.from('documents').delete().eq('id', docId);
        res.status(204).send();
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
