# System Architecture

## Tech Stack

Frontend
- React (Vite)
- Zustand (state management)
- TailwindCSS

Backend
- Fastify
- Drizzle ORM
- PostgreSQL

AI Stack
- pgvector
- Gemini embeddings
- RAG pipeline

Infrastructure
- Redis
- BullMQ
- Docker

---

## Backend Architecture

Pattern:

Controller → Service → Repository → Database

Example:

user.route.ts
      ↓
user.service.ts
      ↓
user.repository.ts
      ↓
database

---

## AI Stack

Embeddings
- HuggingFace Inference API
- Sentence transformer models
- Stored in pgvector

LLM
- Google Gemini (free tier)
- Streaming responses

Optional AI Framework
- LangChain for RAG pipeline orchestration

Vector Database
- PostgreSQL with pgvector

## Streaming AI Responses

Chat responses are streamed to the client using Server Sent Events (SSE).

Flow:

User query
   ↓
Query embedding
   ↓
pgvector similarity search
   ↓
Retrieve relevant chunks
   ↓
Gemini LLM streaming response
   ↓
Fastify SSE stream
   ↓
React UI rendering tokens

## Module Architecture

src/modules/

Each module contains:

- route
- service
- repository
- schema
- queue

Example:

modules/user

user.route.ts
user.service.ts
user.repository.ts
user.schema.ts
user.queue.ts

---

## Background Jobs

Heavy AI tasks run in queues.

Examples:

- document parsing
- embedding generation
- quiz generation

BullMQ + Redis handles job processing.

---

## RAG Architecture

Document Upload
      ↓
Text Extraction
      ↓
Chunking
      ↓
Embedding Generation
      ↓
Store in pgvector
      ↓
Semantic Search
      ↓
LLM Answer Generation