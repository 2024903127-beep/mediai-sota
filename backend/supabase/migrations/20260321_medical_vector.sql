-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Medical Knowledge Store
CREATE TABLE IF NOT EXISTS medical_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL, -- 'openfda', 'rxnorm', 'who', etc.
  category TEXT NOT NULL, -- 'medicine', 'disease', 'nutrition'
  name TEXT NOT NULL,
  content TEXT NOT NULL, -- JSON or full text blob
  embedding vector(384), -- Dimension 384 for all-MiniLM-L6-v2
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast vector similarity search
CREATE INDEX ON medical_knowledge USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function for vector search
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
