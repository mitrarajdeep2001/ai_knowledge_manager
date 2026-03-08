const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 50;

export const chunkText = (
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP,
): string[] => {
  if (!text.trim()) {
    return [];
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const safeChunkSize = Math.max(1, chunkSize);
  const safeOverlap = Math.max(0, Math.min(overlap, safeChunkSize - 1));
  const step = safeChunkSize - safeOverlap;

  const chunks: string[] = [];
  for (let start = 0; start < tokens.length; start += step) {
    const chunk = tokens.slice(start, start + safeChunkSize).join(" ").trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (start + safeChunkSize >= tokens.length) {
      break;
    }
  }

  return chunks;
};
