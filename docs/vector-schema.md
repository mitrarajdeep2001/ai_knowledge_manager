# Vector Database Schema (pgvector)

This document defines the vector storage architecture for the AI Knowledge Manager.

The system uses PostgreSQL with the pgvector extension for semantic search.

The design must support:

- fast retrieval
- scalable vector storage
- low hallucination RAG
- support for 100k+ knowledge chunks

---

# pgvector Setup

Enable pgvector extension.

SQL:

CREATE EXTENSION IF NOT EXISTS vector;

---

# Embedding Model

Provider:
HuggingFace

Recommended model:

sentence-transformers/all-MiniLM-L6-v2

Embedding dimension:

384

Vector column:

vector(384)

---

# Tables

The vector system is based on **chunk-level embeddings**.

Documents and notes are split into chunks before embedding.

---

# knowledge_chunks

Stores vector embeddings for notes and documents.

Fields:

id
user_id
source_type
source_id
content
embedding
metadata
created_at

---

## Column Details

### id

Primary key.

UUID.

---

### user_id

Owner of the chunk.

Used for multi-tenant filtering.

---

### source_type

Defines where the chunk originated.

Possible values:

note
document

---

### source_id

Reference to the original object.

Examples:

note_id
document_id

---

### content

The actual chunk text.

Example:

"React useEffect is a hook used for handling side effects."

---

### embedding

Vector embedding.

Type:

vector(384)

---

### metadata

JSONB field storing extra context.

Example:

{
  "title": "React Hooks Guide",
  "page": 3,
  "section": "useEffect"
}

---

### created_at

Timestamp of chunk creation.

---

# Example Schema

Example SQL:

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(384),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

---

# Vector Indexing

To ensure fast semantic search, pgvector requires indexing.

Recommended index:

IVFFLAT

---

## Index Example

CREATE INDEX knowledge_chunks_embedding_idx
ON knowledge_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

---

## Why IVFFLAT

Benefits:

- fast approximate nearest neighbor search
- scalable to millions of vectors
- good balance between speed and accuracy

---

# Similarity Metric

Use:

cosine similarity

Reason:

cosine works best for sentence embeddings.

Query example:

SELECT *
FROM knowledge_chunks
ORDER BY embedding <-> '[query_vector]'
LIMIT 5;

---

# Retrieval Strategy

Recommended parameters:

top_k = 5

Process:

1. embed user query
2. perform similarity search
3. retrieve top chunks
4. pass chunks to LLM

---

# Multi-Tenant Filtering

Always filter by user.

Example:

SELECT *
FROM knowledge_chunks
WHERE user_id = $userId
ORDER BY embedding <-> $queryVector
LIMIT 5;

---

# Chunking Strategy

Chunk size:

500 tokens

Overlap:

50 tokens

Example:

Chunk 1 → tokens 1–500  
Chunk 2 → tokens 450–950

This improves retrieval accuracy.

---

# Metadata Usage

Metadata improves RAG answers.

Example metadata:

{
  "title": "React Guide",
  "source": "note",
  "page": 2
}

LLM can cite sources in answers.

---

# Deleting Data

When a note or document is deleted:

Delete associated chunks.

Example:

DELETE FROM knowledge_chunks
WHERE source_id = $id;

---

# Future Scaling Strategy

For large datasets (1M+ vectors):

Increase IVFFLAT lists.

Example:

WITH (lists = 500)

---

# Alternative Index (Future)

pgvector also supports:

HNSW

Better recall but more memory usage.

Example:

USING hnsw

---

# Expected Performance

With correct indexing:

10k chunks → <10ms search

100k chunks → ~20ms search

1M chunks → ~50ms search

---

# RAG Prompt Construction

Retrieved chunks are injected into the LLM prompt.

Example:

CONTEXT:

Chunk 1  
Chunk 2  
Chunk 3  

QUESTION:

What is React useEffect?

ANSWER:

---

# Anti Hallucination Rules

The LLM must only answer using retrieved chunks.

If answer not present:

"I could not find this information in your knowledge base."

---

# Summary

Vector storage strategy:

Notes/Documents
     ↓
Chunking
     ↓
Embedding
     ↓
pgvector storage
     ↓
Similarity search
     ↓
Gemini LLM answer