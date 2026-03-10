-- Custom SQL migration: Add full-text search support
-- Generated tsvector column for keyword search

-- Drop existing search_vector column if it exists (non-generated)
ALTER TABLE knowledge_chunks
DROP COLUMN IF EXISTS search_vector;

-- Add generated tsvector column that auto-populates from content
ALTER TABLE knowledge_chunks
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('english', content)
) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS knowledge_chunks_search_vector_idx
ON knowledge_chunks
USING GIN (search_vector);

-- Analyze the table to update statistics
ANALYZE knowledge_chunks;
