# RAG Pipeline

## Step 1 — Data Ingestion

Sources:

- Notes
- Documents

Documents are uploaded via multer.

---

## Step 2 — Parsing

PDF / DOCX / TXT files are parsed into plain text.

---

## Step 3 — Chunking

Text is split into smaller chunks.

Example:

500 tokens per chunk

This improves retrieval accuracy.

---

## Step 4 — Embedding Generation

Embeddings are generated using HuggingFace models.

Example models:

- sentence-transformers/all-MiniLM-L6-v2
- BAAI/bge-small-en-v1.5

Embedding size:

384 or 768 depending on model.

Embeddings are stored in pgvector.

---

## Step 5 — Vector Storage

Embeddings stored in PostgreSQL pgvector.

Example:

vector(768)

---

## Step 6 — Retrieval

User query → embedding

Similarity search:

cosine distance

Retrieve top 5 results.

---

## Step 7 — LLM Generation

The retrieved context is passed to Gemini LLM.

Model:

Gemini 1.5 Flash (free tier)

Responses are streamed token-by-token to the client.

---

## Example

User question:

"What is React useEffect?"

System retrieves:

- relevant note chunk
- relevant document chunk

LLM generates response using context.