# Chunking Strategy

Documents are split before embedding.

Chunk size:

500 tokens

Overlap:

50 tokens

Example:

Chunk 1 → tokens 1–500  
Chunk 2 → tokens 450–950

Overlap improves retrieval accuracy.

Metadata stored per chunk:

- document_id
- source
- page number