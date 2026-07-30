# Academic AI — Supabase MVP Integration Guide

This guide details the step-by-step procedures to swap **Firebase** out for **Supabase** (PostgreSQL + pgvector + GoTrue Auth) as the core database and authentication provider for the Academic AI MVP.

---

## 1. Supabase Initialization (`src/lib/supabase.ts`)
The client configuration is already established in your codebase. Update your `.env.local` or environment keys to instantiate the client:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

---

## 2. Supabase Auth Transition (`src/App.tsx`)

Swap the Firebase Google auth functions with Supabase OAuth redirects.

```typescript
// Replace Firebase imports in src/App.tsx with Supabase client
import { supabase } from './lib/supabase';

// Google OAuth Sign-In via Supabase
const handleSignIn = async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) console.error("Supabase Auth error:", error.message);
};

// Sign Out via Supabase
const handleSignOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

// Listen to auth state updates
useEffect(() => {
  if (!supabase) return;

  // Set initial user
  supabase.auth.getUser().then(({ data: { user } }) => {
    setUser(user);
    setIsAuthReady(true);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
    setIsAuthReady(true);
  });

  return () => subscription.unsubscribe();
}, []);
```

---

## 3. Database Mutations Migration (Firebase to Supabase)

Swap Firestore API mutations with clean Supabase client queries.

### A. Profiles Setup & Points Awarding
```typescript
// Firebase Method
await updateDoc(doc(db, 'profiles', userId), { points: increment(points) });

// Supabase Equivalent (using pgvector Profiles table)
const { data, error } = await supabase
  .from('profiles')
  .update({ points: currentPoints + points })
  .eq('id', userId);
```

### B. Project Listing & Creation (`ProjectSelector.tsx`)
```typescript
// List projects
const { data: projects, error } = await supabase
  .from('projects')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });

// Create project
const { error } = await supabase
  .from('projects')
  .insert({
    id: uuidv4(),
    name: newName,
    description: newDesc,
    user_id: user.id
  });
```

### C. Retrieving Documents & Notes (`Notebook.tsx`)
```typescript
// Fetch documents matching project
const { data: documents, error } = await supabase
  .from('documents')
  .select('*')
  .eq('project_id', projectId);
```

---

## 4. Advanced: Native RAG Vector Search (Supabase pgvector)

One of the greatest benefits of using Supabase for your MVP is native support for **Vector Similarity Search (RAG)** using **pgvector**. This is far more efficient than loading full texts.

### Step 1: Document Chunking & Embeddings
When a user uploads a PDF, chunk the text into paragraphs on the backend, generate dense embeddings using Gemini's text embedding model, and insert them into the `document_chunks` table:

```typescript
// Server-side Node code (server.ts)
const { data: chunkDoc, error } = await supabase
  .from('document_chunks')
  .insert({
    document_id: documentId,
    project_id: projectId,
    content: paragraphText,
    embedding: geminiEmbeddingVector // Array of 768 float numbers
  });
```

### Step 2: Query Vector Chunks via RPC Stored Procedure
Rather than loading every document into the LLM prompt, execute the `match_document_chunks` stored procedure (already defined in your `supabase_schema.sql`) to retrieve only the top 5 most relevant paragraphs matching the student's question:

```typescript
// Fetch only highly relevant context paragraphs
const { data: relevantChunks, error } = await supabase
  .rpc('match_document_chunks', {
    query_embedding: queryEmbedding, // Embedding vector of the student's prompt
    match_threshold: 0.6,
    match_count: 5,
    p_project_id: projectId
  });

const contextText = relevantChunks.map(chunk => chunk.content).join('\n\n');
```
This is the standard-setting way to implement RAG on Supabase for the Academic AI MVP!
