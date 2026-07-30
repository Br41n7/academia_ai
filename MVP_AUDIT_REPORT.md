# Academic AI MVP Audit and Recommendations Report

## 1. Executive Summary
This document provides an expert software engineering audit of the **Academic AI** (Academic Copilot / Study Companion) codebase. The project is an feature-rich, intelligent workspace designed to turn user study materials (PDFs, TXT files, Google Docs, YouTube Transcripts) into full structured courses, flashcards, mind maps, knowledge graphs, study planners, practice quizzes, and simulated examinations ("Exam Mode") utilizing **Gemini AI**, **Firebase** (Firestore + Auth + Functions), and a legacy/alternative **Supabase (PostgreSQL + pgvector)** setup.

The objective of this audit is to:
1. Analyse the current architecture and code status.
2. Identify critical functional discrepancies, security risks, and architectural friction points.
3. Formulate the best, leanest path to a successful **Minimum Viable Product (MVP)** launch.

---

## 2. Architecture & Tech Stack Analysis

### A. Frontend (Vite + React + TailwindCSS + Motion)
- **Status:** The UI is beautifully polished, modern, and engaging. It features dashboard tracking, custom progress, simulated CBT/Exam controls, rich modals, markdown displays, and sidebars.
- **Key Files:**
  - `src/App.tsx` handles authentication states, dark/light mode toggles, and main project route navigation.
  - `src/components/ProjectLayout.tsx` handles sidebar layouts and active tab management.
  - Interactive tools: `Notebook.tsx` (RAG chat, summarization, YouTube transcript, Google Doc fetch), `CourseBuilder.tsx` (course module player), `ExamMode.tsx` (timed exams, confidence tracking, interactive calculator), `VisualGenerator.tsx` (infographic/flowchart visualizers).
- **Collaboration Sync:** `src/hooks/useCollaboration.ts` is imported, facilitating live sync on mindmaps/knowledge graphs.

### B. Backend (Express.js + Vite Dev Middleware)
- **Status:** Integrated express server (`server.ts`) acts as both the Vite assets server and an API gateway for heavy-lifting tasks.
- **Critical Endpoints:**
  - `POST /api/documents/upload`: Extracts text from PDFs (via `pdf-parse`) and TXT files, then directly inserts raw text documents into Firebase via `firebase-admin`.
  - `POST /api/documents/import-url`: Fetches text content from Google Docs URLs or generic web pages.
  - `POST /api/youtube/transcript`: Extracts subtitles from YouTube videos using `youtube-transcript`.

### C. Database & Auth Dual-State
The project has dual-infrastructure traces:
- **Firebase (Active):**
  - Used actively in the frontend (`src/firebase.ts`) and backend (`server.ts`).
  - Implements Google Auth (`GoogleAuthProvider`).
  - Holds active Firestore database connections with an extensive ruleset (`firestore.rules`).
- **Supabase (Inactive Schema):**
  - A schema exists in `supabase_schema.sql` specifying pgvector embeddings.
  - A client exists in `src/lib/supabase.ts`, but it is unconfigured/unused.
  - *Audit Finding:* The codebase relies heavily on client-side Firebase queries and is not using Supabase vector search. This results in standard Firestore text queries instead of dense vector search embeddings for RAG.

### D. AI Engine (Gemini AI SDK v1.29.0)
- **Status:** Integrated via `@google/genai` in `src/services/geminiService.ts`.
- **Model:** Relying on `gemini-3-flash-preview` and `gemini-3-flash`.
- **Grounding:** Successfully implements Google Search grounding tools (`googleSearch: {}`) to prevent hallucinations and fetch live web references.

---

## 3. Detailed Audit Findings & Technical Risks

### 1. The RAG Realignment Issue (Firebase vs. Supabase Vector Search)
- **Finding:** The backend and frontend are built entirely on top of **Firebase (Firestore)**. However, RAG context gathering in `src/services/geminiService.ts` (inside `getProjectContext`) pulls *all* raw texts from `documents` and `notes` matching the `project_id`, concatenating them into a giant raw prompt context.
- **Risk:** If a user uploads multiple large PDFs, the prompt context size will easily exceed LLM token limits or incur excessive cost/latency.
- **Recommendation:** Keep Firebase as the primary operational database, but either:
  1. Transition RAG chunks and vector similarity search to Supabase (utilizing `supabase_schema.sql` and `pgvector`).
  2. Or, use Firebase Extensions for Vector Search (with Vertex AI / Pgvector) or do client-side/server-side chunk selection.

### 2. Security Vulnerability: API Key Exposure in Frontend
- **Finding:** The Gemini API Key is initialized on the client side inside `src/services/geminiService.ts`:
  ```typescript
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  ```
- **Risk:** Because this is compiled into frontend client bundles, `process.env.GEMINI_API_KEY` (or build-time replacements) exposes the developer's Gemini API Key directly to the browser. Malicious users can steal the key and incur massive charges.
- **Recommendation:** Proximate all AI generation calls through the existing Express backend (`server.ts`) where the `GEMINI_API_KEY` can be securely held as an environment variable, away from the client browser.

### 3. Firestore Rules vs. Client-side Mutations
- **Finding:** Client-side components make numerous direct Firestore updates (e.g., `setDoc`, `updateDoc`, `deleteDoc`). While `firestore.rules` is strict, client-side queries for metrics (`getCountFromServer`) can be slow and expensive when scales go up.
- **Recommendation:** Move document creation, course generation, and exam assessments to the Express server API, keeping client-side Firestore actions restricted to real-time sync (e.g., reminders, notes, collaboration cursors).

---

## 4. MVP Scopes: "Must-Have" vs "Should-Have" vs "Could-Have"

To launch a highly performant and stable MVP, we recommend dividing the existing codebase into a prioritized roadmap:

```
┌────────────────────────────────────────────────────────┐
│                      MVP SCOPE                         │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [MUST-HAVE]                                           │
│  - Document upload (PDF/TXT) and text extraction       │
│  - AI Notebook: Summary, Explanation, and RAG Chat     │
│  - Practice Quiz & MCQ generators                      │
│  - Core Auth (Google Sign-In) & Project workspaces     │
│                                                        │
│  [SHOULD-HAVE]                                         │
│  - Exam Mode (Timed exams, Misconception analytics)   │
│  - Course Builder (Modules & Lessons breakdown)        │
│  - Visual Study Aids (Flowcharts, Infographics)        │
│  - Study Planner & Scheduled Reminders                 │
│                                                        │
│  [COULD-HAVE] (Post-MVP / Beta)                        │
│  - Live Collaboration Cursors & Real-time Shared Maps  │
│  - Plagiarism check Integration                        │
│  - Leaderboard & Gamified Points Systems               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Must-Have (Phase 1: Core Launch)
*These features form the essential learning loop: Upload -> Process -> Understand.*
1. **Robust Workspace Selector:** Multi-project management allowing students to separate different classes or subjects.
2. **Text & Document Upload Hub:** Extraction of clean TXT and PDF contents.
3. **Primary RAG Notebook Engine:** A conversational AI companion that answers queries solely grounded on the project's documents.
4. **Interactive Practice Quizzes:** Generation of quick, bite-sized assessments on specified topics.

### Should-Have (Phase 2: High Value Add-ons)
*Features that differentiate Academic AI from generic chat companions.*
1. **Course Builder:** Automatically compiling loose PDFs into structured weekly course modules.
2. **Exam Simulation & Weakness Analysis:** Timed practice tests that specifically target "Concept Traps" and identify weak areas.
3. **Visual Learning Generator:** Generation of formatted comparison sheets, formulas, and step-by-step process charts.

### Could-Have (Phase 3: Engagement & Social Features)
*Features that drive retention and secondary acquisition loops.*
1. **Leaderboard & Gamification:** A dynamic points ranking system showing classmates' streaks.
2. **Real-time Document Collaboration:** Live cursors and synchronized notes.

---

## 5. Strategic MVP Implementation Plan

### Step 1: Secure the AI Gateway
- Move all Gemini AI SDK calls from `src/services/geminiService.ts` into endpoints in `server.ts`.
- Create clean endpoints like `/api/ai/generate-quiz`, `/api/ai/notebook-action`, and `/api/ai/generate-course`.
- Keep the frontend strictly as a consumer of these endpoints. This guarantees security, simplifies CORS management, and provides a centralized place to monitor API costs.

### Step 2: Implement Chunking & Vector Grounding
- To prevent prompt overloading, introduce text chunking on PDF/TXT upload.
- Store chunks along with vector embeddings. For a lean MVP, this can be done easily by activating **Supabase (pgvector)** specifically for the vector RAG queries, while keeping operational user metadata, projects, and reminders inside **Firebase**.

### Step 3: Streamline the Exam Simulation
- Ensure that the `ExamMode` is robust against network disruptions. Storing active exam states (like flagged questions and countdown timers) on local storage will ensure students do not lose progress if they refresh the tab.

---

## 6. Conclusion
The **Academic AI** codebase is an incredibly promising study platform with advanced, innovative learning vectors (like Concept Battles and timed exam trap analyses). By securing the API keys, aligning the RAG embedding architecture, and deploying with a phased MVP mindset, the product will offer high reliability, low operating costs, and an outstanding learning experience for students.
