-- Academic Copilot Database Schema
-- Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  academic_level TEXT DEFAULT 'undergraduate',
  study_streak INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  badges JSONB DEFAULT '[]',
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table (linked to projects)
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT DEFAULT 'text', -- 'text', 'pdf', 'url'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document Chunks for RAG
CREATE TABLE document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- Gemini embedding dimension is 768
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions/Chat History (linked to projects)
CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  original_query TEXT NOT NULL,
  response TEXT,
  citations JSONB, -- Array of source references
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz Attempts table (linked to projects)
CREATE TABLE quiz_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  score FLOAT NOT NULL,
  total_questions INTEGER NOT NULL,
  difficulty_level TEXT,
  attempt_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mnemonic History table (linked to projects)
CREATE TABLE mnemonic_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  concept TEXT NOT NULL,
  mnemonic TEXT NOT NULL,
  style TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes table (User created notes within a project)
CREATE TABLE project_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own documents" ON documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON documents FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chunks" ON document_chunks FOR SELECT USING (auth.uid() = (SELECT user_id FROM projects WHERE id = project_id));

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own questions" ON questions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own questions" ON questions FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quiz attempts" ON quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz attempts" ON quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE mnemonic_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own mnemonics" ON mnemonic_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mnemonics" ON mnemonic_history FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own project notes" ON project_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own project notes" ON project_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own project notes" ON project_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own project notes" ON project_notes FOR DELETE USING (auth.uid() = user_id);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT,
  p_project_id UUID
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE document_chunks.project_id = p_project_id
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
