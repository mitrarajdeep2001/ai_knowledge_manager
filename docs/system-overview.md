# AI Knowledge Manager — System Overview

## Purpose

AI Knowledge Manager is a personal knowledge base application powered by RAG (Retrieval Augmented Generation).

Users can:

- write notes
- upload documents
- search knowledge semantically
- chat with their knowledge base
- generate quizzes from stored knowledge

The system converts notes and documents into vector embeddings stored in PostgreSQL (pgvector).

AI retrieves relevant knowledge to answer questions.

---

## Core Features

### Notes
Users can create markdown notes.

Each note is embedded into vector space for semantic retrieval.

### Documents

Users upload:

- PDF
- DOCX
- TXT
- Markdown

Documents are parsed and chunked before embedding.

### AI Chat

Users can ask questions about their knowledge base.

The system retrieves relevant chunks using vector similarity.

### Quizzes

AI generates quizzes from stored notes or documents.

### Semantic Search

Users search knowledge using natural language queries.

Vector similarity retrieves the most relevant content.

---

## High Level Flow

User Input
    ↓
Embedding Generation
    ↓
Store in pgvector
    ↓
Semantic Retrieval
    ↓
LLM Response Generation