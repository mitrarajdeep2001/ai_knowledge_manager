# Module Architecture

This document defines the module structure for the AI Knowledge Manager backend.

The backend follows a modular architecture where each feature lives in its own module.

Each module contains:

- route
- service
- repository
- schema
- queue (optional)

Pattern:

Route → Service → Repository → Database

---

# Module List

Core modules:

auth
user
notes
documents
embeddings
search
chat
quiz

---

# 1. Auth Module

Handles authentication.

Responsibilities:

- register
- login
- token generation
- session validation

Files:

modules/auth/

auth.route.ts
auth.service.ts
auth.repository.ts
auth.schema.ts

---

# 2. User Module

Manages user profiles.

Responsibilities:

- get user profile
- update settings

Files:

modules/user/

user.route.ts
user.service.ts
user.repository.ts
user.schema.ts
user.queue.ts

---

# 3. Notes Module

Handles user notes.

Responsibilities:

- create notes
- update notes
- delete notes
- trigger embedding generation

Files:

modules/notes/

notes.route.ts
notes.service.ts
notes.repository.ts
notes.schema.ts
notes.queue.ts

---

# 4. Documents Module

Handles document uploads.

Responsibilities:

- upload documents
- parse document text
- trigger embedding jobs

Files:

modules/documents/

documents.route.ts
documents.service.ts
documents.repository.ts
documents.schema.ts
documents.queue.ts

---

# 5. Embeddings Module

Handles vector generation.

Responsibilities:

- chunk text
- generate embeddings
- store vectors in pgvector

Files:

modules/embeddings/

embeddings.service.ts
embeddings.repository.ts
embeddings.queue.ts

This module usually runs in background jobs.

---

# 6. Search Module

Handles semantic retrieval.

Responsibilities:

- embed query
- vector similarity search
- return top chunks

Files:

modules/search/

search.route.ts
search.service.ts
search.repository.ts
search.schema.ts

---

# 7. Chat Module

Handles AI chat interactions.

Responsibilities:

- retrieve relevant chunks
- build prompt
- stream Gemini response

Files:

modules/chat/

chat.route.ts
chat.service.ts
chat.repository.ts
chat.schema.ts

Streaming must use Server Sent Events (SSE).

---

# 8. Quiz Module

Generates quizzes from stored knowledge.

Responsibilities:

- generate quiz topics
- generate questions
- store quiz results

Files:

modules/quiz/

quiz.route.ts
quiz.service.ts
quiz.repository.ts
quiz.schema.ts
quiz.queue.ts

Quiz generation may run as background jobs.

---

# Job Processing

Heavy AI tasks must run in queues.

Examples:

- document parsing
- embedding generation
- quiz generation

BullMQ handles job scheduling.

Queue workers run in:

jobs/worker.ts

---

# Background Processing Flow

Example: document upload

Upload document
      ↓
documents.queue.ts
      ↓
worker
      ↓
parse text
      ↓
chunk text
      ↓
embedding generation
      ↓
store in pgvector

---

# RAG Query Flow

User question
      ↓
chat.service.ts
      ↓
search.service.ts
      ↓
vector similarity search
      ↓
retrieve chunks
      ↓
LLM prompt construction
      ↓
Gemini streaming response

---

# Dependency Flow

Modules interact through services.

Example:

chat.service
      ↓
search.service
      ↓
embeddings.repository

Avoid cross-module repository access.

Always call through services.

---

# Example Request Flow

Create Note

notes.route
      ↓
notes.service
      ↓
notes.repository
      ↓
database

After note creation:

notes.queue
      ↓
embedding job
      ↓
embeddings.service