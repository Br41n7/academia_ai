# Academic AI — Intelligent Study Workspace

Academic AI is a polished, feature-rich, intelligent learning workspace designed to convert raw study materials (PDFs, TXT files, Google Docs, YouTube Transcripts) into a structured educational path. Leveraging **Gemini AI**, **Firebase (Firestore & Auth)**, and **React + Vite**, it provides students and researchers with standard-setting AI study companions.

---

## 🛠 Project Architecture

The application is structured as a full-stack, single-repository JavaScript/TypeScript project:

```
├── .env.example             # Template for API keys & environment config
├── server.ts                # Express backend (handles file uploads, fetches transcripts, integrates Vite)
├── firestore.rules          # Strict security rules for Firestore databases
├── supabase_schema.sql      # Schema for alternative/optional pgvector deployment
├── src/
│   ├── main.tsx             # Application mount point
│   ├── App.tsx              # Root app component (Auth state & routing)
│   ├── firebase.ts          # Core Firebase Client & Auth provider setup
│   ├── types.ts             # Global TypeScript interface definitions
│   ├── components/          # Functional and UI modules
│   │   ├── ProjectSelector.tsx # Project workspace selector and creator
│   │   ├── ProjectLayout.tsx   # Left-side persistent navigation and dark mode toggle
│   │   ├── Dashboard.tsx       # Insights, stats, progress charts, and reminders
│   │   ├── Notebook.tsx        # Source uploads, RAG chatbot, summarizers, and plagiarism checkers
│   │   ├── CourseBuilder.tsx   # Structured, module-by-module syllabus generator
│   │   ├── ExamMode.tsx        # Simulated timed exams, concept traps, and weakness reviews
│   │   └── ...
```

---

## 🚀 Key Workspace Features

### 1. Project-Based Workspaces (`ProjectSelector.tsx`)
Allows students to maintain isolated, context-aware workspaces for each class, topic, or subject. Switching between workspaces automatically updates the active AI context.

### 2. Live Insights Dashboard (`Dashboard.tsx`)
A visual control center that tracking:
- Total documents and notes uploaded.
- Weekly study hours and progress using charts (`recharts`).
- High-priority learning insights and upcoming scheduled study sessions.

### 3. Smart Document Notebook (`Notebook.tsx`)
The central RAG hub where users can import materials via:
- **Direct PDF/TXT File Uploads:** Processed through backend parsing.
- **YouTube Video Links:** Automatically extracts transcripts and subtitles.
- **Google Docs URLs:** Imports published document contents.
- **Custom Notes Creator:** Allows students to draft and attach custom reference notes.
- **Grounding Actions:** Generate AI summaries, quick notes, and verify content originalities via real-time **Plagiarism Checkers**.

### 4. Interactive Course Builder (`CourseBuilder.tsx`)
Transforms raw documents into an complete structured curriculum:
- Divides content into sequential modules.
- Generates descriptive lessons, key definitions, formulas, and mnemonics.
- Tracks course completion metrics.

### 5. Advanced Exam Simulator (`ExamMode.tsx`)
Simulates formal exam conditions with:
- **CBT (Computer Based Test) Mock Mode:** Timed sessions.
- **Concept Traps:** Specially crafted LLM questions designed to check for common student misconceptions.
- **Confidence Tracking:** Self-assessed metrics to detect guess-based answers.
- **Interactive Calculator:** Floating tools to assist in formula calculations.
- **Detailed Analytics Reports:** Highlighting weak concept categories and providing tailored visual guides.

### 6. Gamified Progress (`Leaderboard.tsx`)
Provides study-streak trackers and dynamic points system.

---

## ⚠️ Important Code Practice Inconsistencies & Recommendations

During our expert engineering audit, several code inconsistencies and security anti-patterns were identified. Developers should address these to guarantee scale-readiness:

### 1. Dual-State Database Setup (Firebase vs Supabase)
* **Inconsistency:** The project defines Supabase configuration files (`src/lib/supabase.ts`, `supabase_schema.sql`) for handling embeddings and vector search via `pgvector`, but the active codebase implements RAG context gathering entirely on top of **client-side Firebase queries** by concatenating full text documents.
* **Impact:** High token usage, latency, and operational costs if multiple large files are uploaded.
* **Resolution:** Configure the Supabase backend client to store and query text chunks using `match_document_chunks` similarity queries, or deploy Firebase Vertex AI vector search extensions.

### 2. Gemini AI SDK Client Initialization Security Risk
* **Inconsistency:** In `src/services/geminiService.ts`, the Gemini AI SDK is initialized directly on the frontend (client-side):
  ```typescript
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  ```
* **Impact:** This exposes the developer's raw `GEMINI_API_KEY` in compiled web browser asset bundles, making it susceptible to extraction.
* **Resolution:** Move all Gemini AI generation methods behind secure backend routes in `server.ts` (using the environment variables securely on the Express server).

---

## ⚡️ Setup & Installation

### Prerequisites
- **Node.js** (v18.x or newer)

### 1. Clone the repository and install dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the project root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Development Server
```bash
npm run dev
```
The development app will be hosted at `http://localhost:3000`.

### 4. Lint & Compilation Checks
Verify that there are no active TypeScript or syntax errors:
```bash
npm run lint
```
