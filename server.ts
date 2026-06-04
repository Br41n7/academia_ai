import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import multer from "multer";
import { YoutubeTranscript } from 'youtube-transcript';
import { fileURLToPath } from "url";
import { createRequire } from "module";
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const db = admin.firestore();
if (firebaseConfig.firestoreDatabaseId) {
  // If using a named database, you might need to specify it differently in admin SDK
  // but for default it's fine.
}

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Multer setup for PDF uploads
const upload = multer({ storage: multer.memoryStorage() });

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 1. Upload PDF/Text and Extract Text
app.post("/api/documents/upload", upload.single('file'), async (req, res) => {
  try {
    const { user_id, project_id } = req.body;
    const file = req.file;

    if (!file) throw new Error("No file uploaded");

    let text = "";
    const title = file.originalname;
    const extension = path.extname(title).toLowerCase();

    if (extension === '.pdf') {
      const data = await pdf(file.buffer);
      text = data.text;
    } else if (extension === '.txt') {
      text = file.buffer.toString('utf-8');
    } else {
      throw new Error("Unsupported file type. Please upload a PDF or TXT file.");
    }

    // Save Document to Firestore
    const docRef = db.collection('documents').doc();
    const document = {
      id: docRef.id,
      title,
      content: text,
      source_type: extension.substring(1),
      user_id,
      project_id,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };
    await docRef.set(document);

    res.json(document);
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Import Google Doc via URL
app.post("/api/documents/import-url", async (req, res) => {
  try {
    const { url, user_id, project_id } = req.body;
    if (!url) throw new Error("URL is required");

    let text = "";
    let title = "Imported Document";

    if (url.includes('docs.google.com/document/d/')) {
      const docId = url.match(/\/d\/(.*?)(\/|$)/)?.[1];
      if (!docId) throw new Error("Invalid Google Docs URL");
      
      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      const response = await fetch(exportUrl);
      if (!response.ok) throw new Error("Failed to fetch Google Doc. Make sure it's public or shared with 'Anyone with the link'.");
      text = await response.text();
      title = `Google Doc: ${docId}`;
    } else {
      // Fallback for other URLs - could use a library like 'readability' or just fetch text
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch URL");
      text = await response.text();
      // Basic HTML stripping if it's HTML
      text = text.replace(/<[^>]*>?/gm, '');
      title = `Web Page: ${new URL(url).hostname}`;
    }

    // Save Document to Firestore
    const docRef = db.collection('documents').doc();
    const document = {
      id: docRef.id,
      title,
      content: text,
      source_type: 'url',
      user_id,
      project_id,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };
    await docRef.set(document);

    res.json(document);
  } catch (error: any) {
    console.error("URL Import error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. YouTube Transcript
app.post("/api/youtube/transcript", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) throw new Error("YouTube URL is required");

    // Extract video ID
    const videoIdMatch = url.match(/(?:v=|\/v\/|embed\/|youtu\.be\/|\/shorts\/)([^#&?]*).*/);
    const videoId = videoIdMatch ? videoIdMatch[1] : url;

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const text = transcript.map(t => t.text).join(" ");
    
    res.json({ text });
  } catch (error: any) {
    console.error("YouTube error:", error);
    let message = error.message;
    if (message.includes('Transcript is disabled')) {
      message = "Transcripts are disabled for this video.";
    } else if (message.includes('Could not find transcript')) {
      message = "Could not find a transcript for this video.";
    }
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
