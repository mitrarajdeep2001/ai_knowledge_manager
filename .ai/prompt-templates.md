# Prompt Templates

## Create Module

Create a module using this architecture:

route
service
repository
schema
queue

Follow Controller → Service → Repository pattern.

---

## Create API Endpoint

Stack:

Fastify
Drizzle ORM
PostgreSQL

Requirements:

- Zod validation
- typed responses
- service layer logic

---

## Create Background Job

Use BullMQ.

Job types:

- document parsing
- embedding generation
- quiz generation