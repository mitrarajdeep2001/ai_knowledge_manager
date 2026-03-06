# AI Knowledge Manager – Agent Instructions

Before implementing features, read these project documents:

docs/
- architecture.md
- module-architecture.md
- rag-pipeline.md
- vector-schema.md
- database.md
- llm-strategy.md
- chunking-strategy.md
- api-contract.md

.ai/
- rules.md
- prompt-templates.md

These documents define the system architecture and coding standards.

Important rules:
- Follow Controller → Service → Repository pattern
- Use Fastify + Drizzle ORM
- Store embeddings in pgvector
- Chat responses must stream using SSE
- Heavy AI tasks run through BullMQ queues