import { Router, Response } from 'express';
import multer from 'multer';
import { AuthRequest, authenticateToken } from '../middleware/auth.js';
import { sanitizeText, chunkText, parsePdfBuffer } from '../services/pdf.js';
import { YoutubeTranscript } from 'youtube-transcript';

const router = Router();

// Configure multer for memory storage, 15MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

/**
 * POST /api/documents/upload
 * Process TXT and PDF uploads
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const title = file.originalname;
    const extension = title.substring(title.lastIndexOf('.')).toLowerCase();

    let rawText = '';
    let sourceType = '';

    if (extension === '.pdf') {
      try {
        rawText = await parsePdfBuffer(file.buffer);
        sourceType = 'pdf';
      } catch (pdfErr: any) {
        console.error('[PDF Parsing Error]:', pdfErr.message);
        return res.status(422).json({ error: 'Failed to extract text from PDF. It may be scanned or corrupted.' });
      }
    } else if (extension === '.txt') {
      rawText = file.buffer.toString('utf-8');
      sourceType = 'txt';
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF or TXT file.' });
    }

    // Sanitize extracted text
    const sanitized = sanitizeText(rawText);
    if (!sanitized) {
      return res.status(422).json({ error: 'No readable text could be extracted from this document.' });
    }

    // Chunk text
    const chunks = chunkText(sanitized);

    // Get first 12,000 chars of content for display/metadata preview
    const previewContent = sanitized.substring(0, 12000);

    return res.json({
      title,
      content: previewContent,
      chunks,
      source_type: sourceType
    });
  } catch (err: any) {
    console.error('[Upload API] Error:', err.message);
    return res.status(500).json({ error: err.message || 'An error occurred during file processing.' });
  }
});

/**
 * POST /api/documents/import-url
 * Imports contents of a Google Doc or Web Page
 */
router.post('/import-url', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required.' });
    }

    let rawText = '';
    let title = 'Imported Web Page';
    let sourceType = 'url';

    if (url.includes('docs.google.com/document/d/')) {
      // Google Doc URL
      const docIdMatch = url.match(/\/d\/(.*?)(\/|$)/);
      const docId = docIdMatch ? docIdMatch[1] : null;

      if (!docId) {
        return res.status(400).json({ error: 'Invalid Google Docs URL format.' });
      }

      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      console.log(`[Import URL] Fetching Google Doc export: ${exportUrl}`);

      const response = await fetch(exportUrl);
      if (!response.ok) {
        return res.status(403).json({
          error: 'Failed to access Google Doc. Please verify that link sharing is turned ON and set to "Anyone with the link can view".'
        });
      }

      rawText = await response.text();
      title = `Google Doc: ${docId}`;
      sourceType = 'google_doc';
    } else {
      // General Web Page
      console.log(`[Import URL] Fetching webpage: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch webpage. Status: ${response.status}` });
      }

      const html = await response.text();
      // Simple HTML stripping
      rawText = html
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')   // Remove styles
        .replace(/<[^>]*>?/gm, ' ')                         // Remove other tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      try {
        title = `Web Page: ${new URL(url).hostname}`;
      } catch {
        title = 'Web Page';
      }
    }

    // Sanitize and chunk
    const sanitized = sanitizeText(rawText);
    if (!sanitized) {
      return res.status(422).json({ error: 'Failed to extract meaningful text content from the URL.' });
    }

    const chunks = chunkText(sanitized);
    const previewContent = sanitized.substring(0, 12000);

    return res.json({
      title,
      content: previewContent,
      chunks,
      source_type: sourceType
    });
  } catch (err: any) {
    console.error('[Import URL API] Error:', err.message);
    return res.status(500).json({ error: err.message || 'An error occurred during URL import.' });
  }
});

/**
 * POST /api/youtube/transcript
 * Extract subtitles from a YouTube video
 */
router.post('/youtube/transcript', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required.' });
    }

    // Extract video ID
    // Supports: youtu.be/abc, youtube.com/watch?v=abc, youtube.com/shorts/abc, youtube.com/embed/abc
    const videoIdMatch = url.match(/(?:v=|\/v\/|embed\/|youtu\.be\/|\/shorts\/)([^#&?]*).*/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId || videoId.length !== 11) {
      return res.status(400).json({ error: 'Invalid YouTube URL or Video ID format.' });
    }

    console.log(`[YouTube Transcript] Fetching for videoId: ${videoId}`);
    try {
      const transcriptSegments = await YoutubeTranscript.fetchTranscript(videoId);
      const joinedText = transcriptSegments.map(seg => seg.text).join(' ');
      const sanitized = sanitizeText(joinedText);

      return res.json({
        text: sanitized,
        videoId
      });
    } catch (transcriptErr: any) {
      console.error('[YouTube Transcript Engine Error]:', transcriptErr.message);

      let friendlyMessage = 'Subtitles/transcript could not be retrieved for this video.';
      if (transcriptErr.message?.includes('disabled')) {
        friendlyMessage = 'Transcripts are disabled for this YouTube video.';
      } else if (transcriptErr.message?.includes('not found') || transcriptErr.message?.includes('Could not find')) {
        friendlyMessage = 'Could not find a transcript for this video. It may lack auto-generated captions.';
      }

      return res.status(422).json({ error: friendlyMessage });
    }
  } catch (err: any) {
    console.error('[YouTube API] Error:', err.message);
    return res.status(500).json({ error: err.message || 'An error occurred during transcript retrieval.' });
  }
});

export default router;
