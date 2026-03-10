-- Hybrid Search: Add search_vector column and indexes
-- Migration: 0008_silent_nimbus

-- 1. Add search_vector tsvector column (generated)
ALTER TABLE knowledge_chunks 
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- 2. Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_search_vector 
ON knowledge_chunks USING GIN(search_vector);

-- 3. Create HNSW vector index for ANN search
-- Using HNSW for better query performance with 1024-dim embeddings
CREATE INDEX IF NOT EXISTS idx_chunks_embedding 
ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 4. Analyze table to update statistics
ANALYZE knowledge_chunks;
