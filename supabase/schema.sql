-- ── Enable UUID extension ────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles ─────────────────────────────────────────────
-- Auto-created on first sign-in via trigger
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  preferred_model TEXT DEFAULT 'gemini',
  persona TEXT DEFAULT 'friendly',
  region TEXT DEFAULT 'Nigeria',
  custom_agent_prompt TEXT,
  points INTEGER DEFAULT 0,
  study_streak INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT '{}',
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Projects (workspaces) ─────────────────────────────────
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Documents ─────────────────────────────────────────────
CREATE TABLE documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  content TEXT,                    -- first 12000 chars for quick context
  chunks TEXT[],                   -- full chunked content for retrieval
  chunk_count INTEGER DEFAULT 0,
  source_type TEXT DEFAULT 'pdf',  -- pdf | txt | url | gdoc | youtube
  file_path TEXT,                  -- Supabase Storage path
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notes ─────────────────────────────────────────────────
CREATE TABLE notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Quiz Attempts ─────────────────────────────────────────
CREATE TABLE quiz_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT,
  score INTEGER,
  total INTEGER,
  answers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Exam Attempts ─────────────────────────────────────────
CREATE TABLE exam_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exam_data JSONB,
  answers JSONB,
  analysis JSONB,
  score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Flashcards / Mnemonics ────────────────────────────────
CREATE TABLE flashcards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  concept TEXT NOT NULL,
  style TEXT DEFAULT 'story',
  mnemonic TEXT,
  explanation TEXT,
  review_count INTEGER DEFAULT 0,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Courses ───────────────────────────────────────────────
CREATE TABLE courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  modules JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Course Progress ───────────────────────────────────────
CREATE TABLE course_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  completed_lessons TEXT[] DEFAULT '{}',
  quiz_scores JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);

-- ── Study Reminders ───────────────────────────────────────
CREATE TABLE reminders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Collaboration ─────────────────────────────────────────
-- User A grants User B access to a project
CREATE TABLE project_collaborators (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  collaborator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission TEXT DEFAULT 'read',  -- read | write
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, collaborator_id)
);

-- ── AI Usage Quota ────────────────────────────────────────
CREATE TABLE ai_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER DEFAULT 1,
  UNIQUE(user_id, usage_date)
);

-- ── Leaderboard (view over profiles) ─────────────────────
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  p.points,
  p.study_streak,
  p.badges,
  RANK() OVER (ORDER BY p.points DESC) AS rank
FROM profiles p
ORDER BY p.points DESC
LIMIT 100;

-- ── ROW LEVEL SECURITY POLICIES ──────────────────────────

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- ── Profiles: users see and edit only their own ───────────
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Leaderboard needs profiles visible to all authenticated users
CREATE POLICY "profiles_select_leaderboard"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── Projects: owner sees all, collaborators see shared ────
CREATE POLICY "projects_owner"
  ON projects FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "projects_collaborator_select"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = projects.id
      AND pc.collaborator_id = auth.uid()
    )
  );

-- ── Documents: owner full access, collaborators read ──────
CREATE POLICY "documents_owner"
  ON documents FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "documents_collaborator_read"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = documents.project_id
      AND pc.collaborator_id = auth.uid()
      AND pc.permission IN ('read', 'write')
    )
  );

CREATE POLICY "documents_collaborator_write"
  ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = documents.project_id
      AND pc.collaborator_id = auth.uid()
      AND pc.permission = 'write'
    )
  );

-- ── Notes: same pattern as documents ──────────────────────
CREATE POLICY "notes_owner"
  ON notes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "notes_collaborator_read"
  ON notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = notes.project_id
      AND pc.collaborator_id = auth.uid()
    )
  );

-- ── Everything else: owner only ───────────────────────────
CREATE POLICY "quiz_attempts_owner"
  ON quiz_attempts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "exam_attempts_owner"
  ON exam_attempts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "flashcards_owner"
  ON flashcards FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "courses_owner"
  ON courses FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "course_progress_owner"
  ON course_progress FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "reminders_owner"
  ON reminders FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "ai_usage_owner"
  ON ai_usage FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "collaborators_owner"
  ON project_collaborators FOR ALL USING (auth.uid() = owner_id);

-- ── Supabase Storage bucket and policies ──────────────────
-- Run in Supabase dashboard → Storage → New bucket
-- Bucket name: documents
-- Public: false

CREATE POLICY "storage_owner_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Auto-create profile on sign-up ────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
