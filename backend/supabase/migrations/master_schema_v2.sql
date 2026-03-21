-- ==========================================
-- MEDIAI MASTER SUPABASE SCHEMA (V2)
-- Execute this in the Supabase SQL Editor
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'patient', -- 'patient' or 'doctor'
  language_pref TEXT DEFAULT 'en', -- 'en' or 'hi'
  consent_given_at TIMESTAMPTZ,
  data_delete_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MEDICAL KNOWLEDGE (RAG BRAIN)
CREATE TABLE IF NOT EXISTS medical_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL, -- 'openfda', 'who', etc.
  category TEXT NOT NULL, -- 'medicine', 'disease'
  name TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL, -- JSON or detailed description
  embedding vector(384), -- Dimension 384 for all-MiniLM-L6-v2
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for high-performance semantic search
CREATE INDEX IF NOT EXISTS medical_knowledge_embedding_idx 
ON medical_knowledge USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. AI TRAINING DATA & HITL FEEDBACK
CREATE TABLE IF NOT EXISTS ai_training_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_text TEXT,
  corrected_text TEXT,
  source_type TEXT, -- 'prescription', 'medicine_label'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI FEEDBACK & LEARNING LOOP
CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scan_id UUID, -- Optional link to prescriptions.id
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Store OCR confidence, model version, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRESCRIPTIONS & SCANS
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  ocr_text TEXT,
  summary TEXT,
  medicines JSONB DEFAULT '[]',
  scan_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MEDICAL REMINDERS
CREATE TABLE IF NOT EXISTS medical_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  dosage TEXT,
  times TEXT[], -- e.g. ['08:00', '20:00']
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. VECTOR SEARCH FUNCTION (RPC)
CREATE OR REPLACE FUNCTION match_medical_knowledge (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  content TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mk.id,
    mk.name,
    mk.content,
    1 - (mk.embedding <=> query_embedding) AS similarity
  FROM medical_knowledge mk
  WHERE (category_filter IS NULL OR mk.category = category_filter)
    AND (1 - (mk.embedding <=> query_embedding) > match_threshold)
  ORDER BY mk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 8. ROW LEVEL SECURITY (RLS) - Basic Setup
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_knowledge ENABLE ROW LEVEL SECURITY; -- Public read for RAG

-- Polices (Example: Users can only see their own prescriptions)
CREATE POLICY "Users can view their own prescriptions" 
ON prescriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own reminders" 
ON medical_reminders FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public read for medical knowledge" 
ON medical_knowledge FOR SELECT USING (true);
