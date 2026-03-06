# Coding Rules

Language

TypeScript strict mode.

---

Architecture

Controller → Service → Repository pattern.

Controllers must be thin.

Business logic belongs in services.

Database logic belongs in repositories.

---

Database

Use Drizzle ORM.

All queries must be typed.

---

Validation

Use Zod schemas.

Validation occurs in routes.

---

Error Handling

Use Fastify error handling.

Never expose internal errors.

---

Queues

Heavy AI tasks must use BullMQ.

Do not run embedding generation in request lifecycle.

---

Vector Search

Use pgvector.

Similarity metric:

cosine distance.

## AI Models

Embeddings must use HuggingFace models.

Recommended:

sentence-transformers/all-MiniLM-L6-v2

Do not use OpenAI embeddings.

---

LLM responses must use Google Gemini.

Model:

gemini-1.5-flash

Responses must support streaming.

---

RAG Pipeline

All chat responses must follow RAG architecture:

1. Embed query
2. Perform pgvector similarity search
3. Retrieve top 5 chunks
4. Send chunks as context to Gemini
5. Stream the response to the client