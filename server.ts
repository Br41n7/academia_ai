import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import multer from "multer";
import { YoutubeTranscript } from 'youtube-transcript';
import { fileURLToPath } from "url";
import { createRequire } from "module";
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };
import { createClient } from '@supabase/supabase-js';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const db = admin.firestore();

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;
const isSupabaseConfigured = !!supabase;

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Safe initialization of GoogleGenAI securely on the server side (with demo/fallback key protection)
const hasGeminiKey = !!process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'DUMMY_KEY_FOR_LOCAL_RUN' });

// Multer setup for PDF uploads
const upload = multer({ storage: multer.memoryStorage() });

// Helper to retrieve project context (RAG) securely on the server-side with token limits/truncation check
async function getProjectContextServer(projectId: string, userId: string) {
  try {
    let docs = "";
    let notes = "";

    if (isSupabaseConfigured && supabase) {
      const { data: dData } = await supabase
        .from('documents')
        .select('content')
        .eq('project_id', projectId)
        .eq('user_id', userId);
      const { data: nData } = await supabase
        .from('notes')
        .select('content')
        .eq('project_id', projectId)
        .eq('user_id', userId);

      docs = dData ? dData.map((d: any) => d.content).join('\n\n') : '';
      notes = nData ? nData.map((n: any) => n.content).join('\n\n') : '';
    } else {
      const docsSnapshot = await db.collection('documents')
        .where('project_id', '==', projectId)
        .where('user_id', '==', userId)
        .get();

      const notesSnapshot = await db.collection('notes')
        .where('project_id', '==', projectId)
        .where('user_id', '==', userId)
        .get();

      docs = docsSnapshot.docs.map(d => d.data().content).join('\n\n');
      notes = notesSnapshot.docs.map(n => n.data().content).join('\n\n');
    }

    const maxChars = 200000;
    if (docs.length > maxChars) {
      docs = docs.substring(0, maxChars) + "\n\n[CONTEXT TRUNCATED DUE TO SIZE LIMITS]";
    }
    if (notes.length > maxChars) {
      notes = notes.substring(0, maxChars) + "\n\n[CONTEXT TRUNCATED DUE TO SIZE LIMITS]";
    }

    return `CONTEXT FROM PROJECT DOCUMENTS:\n${docs}\n\nCONTEXT FROM PROJECT NOTES:\n${notes}`;
  } catch (error) {
    console.error("Error fetching project context on server:", error);
    return '';
  }
}

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Secure AI Endpoints (Moved from Frontend)

app.post("/api/ai/notebook-action", async (req, res) => {
  try {
    const { action, projectId, userQuery, useGrounding, userId } = req.body;
    if (!projectId || !userId) throw new Error("Project ID and User ID are required");

    if (!hasGeminiKey) {
      return res.json({
        text: `### [Demo Mode] GEMINI_API_KEY is not configured.\nHere is a mock response for action **${action}**:\nThis is a sample text explaining complex topics, summarizing, or answering "${userQuery || ''}" based on your files. Please configure the \`GEMINI_API_KEY\` in your \`.env.local\` file to enable real intelligence!`,
        sources: [{ title: 'Academic AI Setup Instructions', uri: 'https://ai.studio/apps' }]
      });
    }

    const context = await getProjectContextServer(projectId, userId);
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
        prompt = `Context:\n${context}\n\nUser Question: ${userQuery}\n\nAnswer the user's question based on the provided context. If the answer is not in the context, use your general knowledge but mention it's not in the project documents.`;
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

    const config: any = {};
    if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config
    });

    res.json({
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Source',
        uri: chunk.web?.uri || ''
      })) || []
    });
  } catch (error: any) {
    console.error("AI action error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/generate-quiz", async (req, res) => {
  try {
    const { topic, difficulty, projectId, userId } = req.body;
    if (!projectId || !userId) throw new Error("Project ID and User ID are required");

    if (!hasGeminiKey) {
      return res.json({
        questions: [
          {
            id: "mock-1",
            type: "multiple_choice",
            question: `Demo Question about: ${topic} (${difficulty})`,
            options: ["Option A (Correct)", "Option B", "Option C", "Option D"],
            correct_answer: "Option A (Correct)",
            explanation: "Set the GEMINI_API_KEY environment variable to receive real AI assessments!"
          }
        ]
      });
    }

    const context = await getProjectContextServer(projectId, userId);
    const prompt = `Based on the following project context and the specific topic "${topic}", generate a quiz with 5 questions.
    Difficulty: ${difficulty}

    IMPORTANT: For each question, provide a detailed explanation that not only states why the correct answer is right but also briefly addresses why common misconceptions (the other options) are incorrect. The explanation should be educational and comprehensive.

    Return the response in JSON format matching this schema:
    {
      "questions": [
        {
          "id": "string",
          "type": "multiple_choice" | "true_false" | "fill_blank",
          "question": "string",
          "options": ["string"] (only for multiple_choice),
          "correct_answer": "string",
          "explanation": "string"
        }
      ]
    }

    CONTEXT:\n${context}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["multiple_choice", "true_false", "fill_blank"] },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correct_answer: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["id", "type", "question", "correct_answer", "explanation"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Generate quiz error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/generate-mnemonic", async (req, res) => {
  try {
    const { concept, style, projectId, userId } = req.body;
    if (!projectId || !userId) throw new Error("Project ID and User ID are required");

    if (!hasGeminiKey) {
      return res.json({
        mnemonic: "P-A-S-S-I-O-N",
        explanation: `Demo Mnemonic for ${concept} in style ${style}. Define GEMINI_API_KEY to activate actual generation.`
      });
    }

    const context = await getProjectContextServer(projectId, userId);
    const prompt = `Generate a mnemonic for the concept: "${concept}" using the style: "${style}".
    Use the provided project context for additional information if relevant.

    Return the response in JSON format matching this schema:
    {
      "mnemonic": "string",
      "explanation": "string"
    }

    CONTEXT:\n${context}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mnemonic: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["mnemonic", "explanation"]
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Mnemonic error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/check-plagiarism", async (req, res) => {
  try {
    const { text } = req.body;
    if (!hasGeminiKey) {
      return res.json({
        similarity_score: 5,
        analysis_summary: "Demo Plagiarism Checker activated. Configure GEMINI_API_KEY for a real analysis.",
        sources: []
      });
    }

    const prompt = `Analyze the following text for potential plagiarism or lack of originality. Provide a similarity score and a brief analysis.

    TEXT TO ANALYZE:
    ${text}

    Return the response in JSON format matching this schema:
    {
      "similarity_score": number (0-100),
      "analysis_summary": "string",
      "sources": [
        {
          "title": "string",
          "url": "string",
          "match_percentage": number,
          "matching_snippet": "string"
        }
      ]
    }

    Use Google Search to find potential matches.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            similarity_score: { type: Type.NUMBER },
            analysis_summary: { type: Type.STRING },
            sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING },
                  match_percentage: { type: Type.NUMBER },
                  matching_snippet: { type: Type.STRING }
                },
                required: ["title", "url", "match_percentage", "matching_snippet"]
              }
            }
          },
          required: ["similarity_score", "analysis_summary", "sources"]
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Plagiarism check error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/generate-visual", async (req, res) => {
  try {
    const { topic, format, projectId, userId } = req.body;
    if (!projectId || !userId) throw new Error("Project ID and User ID are required");

    if (!hasGeminiKey) {
      return res.json({
        type: 'infographic',
        title: `Visual Study Guide: ${topic}`,
        sections: [
          { title: "Core Premise", content: "Set the GEMINI_API_KEY in .env.local to generate beautiful actual flowcharts, formula cards, and concept comparison sheets.", icon: "Sparkles", color: "#4F46E5" }
        ]
      });
    }

    const context = await getProjectContextServer(projectId, userId);
    const prompt = `Generate a visual learning aid for the topic: "${topic}" in the format: "${format}".
    Based on the project context, create a structured response in JSON format.

    FORMAT SPECIFICATIONS:
    - infographic: { type: 'infographic', title: string, sections: [{ title: string, content: string, icon: string (Lucide icon name), color: string (hex) }] }
    - flowchart: { type: 'flowchart', title: string, steps: [{ id: string, label: string, description: string }] }
    - comparison: { type: 'comparison', title: string, headers: [string], rows: [{ label: string, values: [string] }] }
    - formula_card: { type: 'formula_card', title: string, cards: [{ title: string, formula: string, explanation: string, example: string }] }
    - scientific_process: { type: 'scientific_process', title: string, phases: [{ name: string, description: string, key_takeaway: string }] }
    - mindmap: { type: 'mindmap', root: { label: string, children: [{ label: string, children: [] }] } }

    CONTEXT:\n${context}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Generate visual error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/generate-exam", async (req, res) => {
  try {
    const { projectId, config, userId } = req.body;
    if (!projectId || !userId) throw new Error("Project ID and User ID are required");

    if (!hasGeminiKey) {
      return res.json({
        id: "mock-exam-1",
        title: "Mock Simulated Exam",
        questions: [
          {
            id: "q-1",
            type: "concept_trap",
            question: "Sample Misconception Trap: Are API keys safe on standard frontends?",
            options: ["Yes, modern builds hide them completely.", "No, compiled client code reveals assets and keys easily."],
            correct_answer: "No, compiled client code reveals assets and keys easily.",
            explanation: "Frontend JS assets are fully public and readable by client browsers.",
            concept: "Frontend Security Architecture",
            trap_details: "Developers often mistakenly assume process.env replacements keep keys safe in final client bundles."
          }
        ]
      });
    }

    const context = await getProjectContextServer(projectId, userId);
    const prompt = `Generate a comprehensive exam based on the following project context.
    Config: ${JSON.stringify(config)}

    Return the response in JSON format matching this schema:
    {
      "id": "string",
      "title": "string",
      "questions": [
        {
          "id": "string",
          "type": "multiple_choice" | "true_false" | "short_answer" | "theory" | "concept_trap",
          "question": "string",
          "options": ["string"] (for multiple_choice/concept_trap),
          "correct_answer": "string",
          "explanation": "string",
          "concept": "string"
        }
      ]
    }

    CONTEXT:\n${context}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Generate exam error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/analyze-exam", async (req, res) => {
  try {
    const { exam, answers } = req.body;
    if (!hasGeminiKey) {
      return res.json({
        overall_performance: "Demo Analysis: Setup GEMINI_API_KEY in .env.local to get customized detailed topic coverage.",
        topic_mastery: [
          { topic: "Architecture", score: 85, status: "mastered" }
        ],
        weak_concepts: ["Client Key Protection"],
        strong_concepts: ["Backend Routing"],
        recommendations: ["Expose keys through backend proxies"],
        next_steps: ["Ensure all AI tasks route securely through Express controllers."],
        concept_battles: [{ concepts: ["Client-Side AI", "Server-Side AI"], reason: "Distinguish backend proxy gateways from public browser APIs." }]
      });
    }

    const prompt = `Analyze the results of an exam.
    Exam: ${JSON.stringify(exam)}
    Answers: ${JSON.stringify(answers)}

    Return the response in JSON format matching this schema:
    {
      "overall_performance": string,
      "topic_mastery": [
        { "topic": string, "score": number, "status": "mastered" | "improving" | "weak" }
      ],
      "weak_concepts": [string],
      "strong_concepts": [string],
      "recommendations": [string],
      "next_steps": [string],
      "concept_battles": [{ "concepts": [string, string], "reason": string }]
    }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Analyze exam error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/generate-course-ai", async (req, res) => {
  try {
    const { projectId, userId } = req.body;
    if (!projectId || !userId) throw new Error("Project ID and User ID are required");

    if (!hasGeminiKey) {
      return res.json({
        id: "demo-course-id",
        title: "Introduction to Study Material",
        description: "A dummy structured course module for local testing. Enable GEMINI_API_KEY to generate standard curricula.",
        modules: [
          {
            id: "m-1",
            title: "Module 1: Foundations",
            lessons: [
              {
                id: "l-1",
                title: "Lesson 1: Platform Basics",
                content: "Welcome! To generate a real customized module-by-module structured learning pathway, please specify a valid GEMINI_API_KEY.",
                practice_questions: [
                  {
                    id: "pq-1",
                    type: "multiple_choice",
                    question: "What is the primary role of Academic AI?",
                    options: ["Study Companion", "Gaming Platform"],
                    correct_answer: "Study Companion",
                    explanation: "It transforms uploaded notes into modules and structured exams."
                  }
                ]
              }
            ]
          }
        ]
      });
    }

    const context = await getProjectContextServer(projectId, userId);
    const prompt = `Create a structured course based on this content:
    ${context}

    The course should have:
    - id: string
    - title: string
    - description: string
    - modules: Array of modules

    Each module has:
    - id: string
    - title: string
    - lessons: Array of lessons

    Each lesson has:
    - id: string
    - title: string
    - content: string (detailed markdown)
    - formulas: string[] (optional)
    - definitions: Array<{ term: string, definition: string }> (optional)
    - mnemonics: Array<{ mnemonic: string, explanation: string }> (optional)
    - practice_questions: Array of questions (id, question, options, correct_answer, explanation)

    Return the response in JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    res.json({ id: crypto.randomUUID(), ...JSON.parse(response.text) });
  } catch (error: any) {
    console.error("Generate course AI error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/generate-study-guide", async (req, res) => {
  try {
    const { projectId, userId } = req.body;
    if (!projectId || !userId) throw new Error("Project ID and User ID are required");

    if (!hasGeminiKey) {
      return res.json({ text: "### Study Guide (Demo Mode)\n\n* Please configure your \`GEMINI_API_KEY\` in your \`.env.local\` file to generate professional, full-length, grounded study guides." });
    }

    const context = await getProjectContextServer(projectId, userId);
    const prompt = `Based on the following project context, generate a comprehensive study guide.
    The study guide should include:
    - A high-level overview
    - Key concepts and definitions
    - Important formulas or dates (if applicable)
    - A structured outline of the material
    - 3-5 critical thinking questions to deepen understanding

    Format the response as Markdown.

    CONTEXT:\n${context}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Generate study guide error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/generate-slide-deck", async (req, res) => {
  try {
    const { projectId, userId } = req.body;
    if (!projectId || !userId) throw new Error("Project ID and User ID are required");

    if (!hasGeminiKey) {
      return res.json([
        {
          title: "Introduction",
          content: ["GEMINI_API_KEY is missing.", "Setup keys in .env.local."],
          speaker_notes: "Demonstration slide deck mode",
          layout: "title"
        }
      ]);
    }

    const context = await getProjectContextServer(projectId, userId);
    const prompt = `Based on the following project context, generate a structured slide deck for a presentation.
    The response should be a JSON array of slides.
    Each slide should have:
    - title: string
    - content: string[] (bullet points)
    - speaker_notes: string
    - layout: 'title' | 'content' | 'split' | 'quote'

    CONTEXT:\n${context}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.ARRAY, items: { type: Type.STRING } },
              speaker_notes: { type: Type.STRING },
              layout: { type: Type.STRING, enum: ['title', 'content', 'split', 'quote'] }
            },
            required: ["title", "content", "speaker_notes", "layout"]
          }
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Generate slide deck error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/analyze-confusion", async (req, res) => {
  try {
    const { query: userQuery, projectId, userId } = req.body;
    if (!projectId || !userId) throw new Error("Project ID and User ID are required");

    if (!hasGeminiKey) {
      return res.json({ text: `### Confusion Helper (Demo Mode)\n\n* Clear simplified explanation about: **${userQuery}**\n\nConfigure your \`GEMINI_API_KEY\` to get tailored breakdowns and simple analogies!` });
    }

    const context = await getProjectContextServer(projectId, userId);
    const prompt = `The user is confused about: "${userQuery}".
    Based on the project context, provide a clear, simplified explanation that directly addresses the confusion.
    Include:
    - A simple analogy
    - A step-by-step breakdown
    - A "Wait, I still don't get it" section with an even simpler explanation

    CONTEXT:\n${context}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Analyze confusion error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/concept-battle", async (req, res) => {
  try {
    const { query: userQuery, projectId, userId, concepts } = req.body;
    if (!projectId || !userId) throw new Error("Project ID and User ID are required");

    if (!hasGeminiKey) {
      return res.json({
        concepts: concepts || ["Concept X", "Concept Y"],
        comparison: [
          { feature: "Database", concept1: "NoSQL", concept2: "SQL" }
        ],
        analogy: "Setup GEMINI_API_KEY to trigger professional battles comparing easily confused academic topics.",
        scenario: "Interactive Battle Mode is in offline/demo status.",
        quiz_question: null
      });
    }

    const context = await getProjectContextServer(projectId, userId);
    const prompt = concepts
      ? `Start a "Concept Battle" between these two specific concepts: "${concepts[0]}" and "${concepts[1]}".
         Use the project context to provide a deep comparison.`
      : `Start a "Concept Battle" based on the following query: "${userQuery}".
         Identify two related but distinct concepts from the project context and compare them in a "battle" format.`;

    const fullPrompt = `${prompt}

    Return the response in JSON format matching this schema:
    {
      "concepts": [string, string],
      "comparison": [
        { "feature": string, "concept1": string, "concept2": string }
      ],
      "analogy": string,
      "scenario": string,
      "quiz_question": {
        "question": string,
        "options": [string],
        "correct_answer": string,
        "explanation": string
      }
    }

    CONTEXT:\n${context}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Concept battle error:", error);
    res.status(500).json({ error: error.message });
  }
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

    const docId = crypto.randomUUID();
    const document = {
      id: docId,
      title,
      content: text,
      source_type: extension.substring(1),
      user_id,
      project_id,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('documents')
        .insert({
          id: docId,
          project_id,
          user_id,
          title,
          content: text,
          source_type: extension.substring(1)
        });
      if (error) throw error;
    } else {
      // Fallback to Firestore
      const docRef = db.collection('documents').doc(docId);
      await docRef.set({
        ...document,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

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
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch URL");
      text = await response.text();
      text = text.replace(/<[^>]*>?/gm, '');
      title = `Web Page: ${new URL(url).hostname}`;
    }

    const docId = crypto.randomUUID();
    const document = {
      id: docId,
      title,
      content: text,
      source_type: 'url',
      user_id,
      project_id,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('documents')
        .insert({
          id: docId,
          project_id,
          user_id,
          title,
          content: text,
          source_type: 'url'
        });
      if (error) throw error;
    } else {
      // Save Document to Firestore
      const docRef = db.collection('documents').doc(docId);
      await docRef.set({
        ...document,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

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
