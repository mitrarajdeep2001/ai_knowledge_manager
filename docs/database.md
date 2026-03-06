# Database Design

## Users

Stores application users.

Fields:

id
email
username
password_hash
created_at

---

## Notes

Stores user notes.

Fields:

id
user_id
title
content
created_at

---

## Documents

Stores uploaded documents.

Fields:

id
user_id
filename
file_path
created_at

---

## Document Chunks

Documents are chunked before embedding.

Fields:

id
document_id
content
embedding (vector)
metadata
created_at

---

## Note Embeddings

Stores vector embeddings of notes.

Fields:

id
note_id
content
embedding (vector)
created_at

---

## Embedding Dimension

The embedding dimension depends on the selected model.

Examples:

all-MiniLM-L6-v2 → 384
bge-small-en → 384

pgvector column example:

embedding vector(384)

---

## Quizzes

Generated quizzes from knowledge base.

Fields:

id
user_id
topic
difficulty
created_at

---

## Quiz Questions

Fields:

id
quiz_id
question
options
correct_answer