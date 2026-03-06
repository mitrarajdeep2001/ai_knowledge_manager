# LLM Strategy

## Embeddings

Provider:
HuggingFace Inference API

Recommended models:

- sentence-transformers/all-MiniLM-L6-v2
- BAAI/bge-small-en-v1.5

Embedding vectors stored in pgvector.

---

## Generation Model

Provider:
Google Gemini

Model:
gemini-1.5-flash

Used for:

- AI chat
- quiz generation
- summarization

---

## Anti Hallucination Strategy

The system follows strict RAG.

Rules:

1. LLM must only answer using retrieved context.
2. If context does not contain the answer, respond:

"I could not find this information in your knowledge base."

3. Limit retrieved chunks to top 5.

4. Provide source references when possible.