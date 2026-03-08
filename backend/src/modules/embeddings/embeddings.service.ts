import { embeddingsRepository } from "./embeddings.repository";
import { normalizeText } from "../../utils/normalizeText";
import { chunkText } from "../../utils/chunkText";
import { hashChunk } from "../../utils/hashChunk";
import { logger } from "../../utils/logger";
import { resolveEmbeddingBatchSize } from "../../utils/embeddingBatchSize";

const HF_E5_ENDPOINT =
  "https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large/pipeline/feature-extraction";

const MAX_RETRIES = 3;
const BATCH_SIZE = resolveEmbeddingBatchSize("embeddings-service");

type NoteEmbeddingJobData = {
  noteId: string;
  userId: string;
};

const ensureValidBatchSize = (batchSize: number, module: string): void => {
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid EMBEDDING_BATCH_SIZE resolved in ${module}: ${batchSize}`);
  }
};

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const isTransientStatus = (status: number): boolean => {
  return status === 429 || status >= 500;
};

const meanPool = (tokenVectors: number[][]): number[] | null => {
  const dims = tokenVectors[0]?.length ?? 0;
  if (dims === 0 || tokenVectors.length === 0) {
    return null;
  }

  return Array.from({ length: dims }, (_, idx) => {
    let sum = 0;
    for (const tokenVector of tokenVectors) {
      sum += tokenVector[idx] ?? 0;
    }
    return sum / tokenVectors.length;
  });
};

const parseEmbeddingResponse = (responseData: unknown, expected: number): number[][] => {
  if (!Array.isArray(responseData)) {
    throw new Error("Invalid embedding response: expected array payload");
  }

  if (
    expected === 1 &&
    responseData.length > 0 &&
    typeof responseData[0] === "number"
  ) {
    return [responseData as number[]];
  }

  const vectors: number[][] = [];

  for (const item of responseData) {
    if (!Array.isArray(item) || item.length === 0) {
      throw new Error("Invalid embedding response: empty item");
    }

    if (typeof item[0] === "number") {
      vectors.push(item as number[]);
      continue;
    }

    if (Array.isArray(item[0])) {
      const pooled = meanPool(item as number[][]);
      if (!pooled) {
        throw new Error("Invalid embedding response: pooling failed");
      }
      vectors.push(pooled);
      continue;
    }

    throw new Error("Invalid embedding response: unsupported item shape");
  }

  if (vectors.length !== expected) {
    throw new Error(
      `Invalid embedding response length: expected ${expected}, got ${vectors.length}`,
    );
  }

  return vectors;
};

export class EmbeddingsService {
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const apiKey = process.env.HF_API_KEY;
    if (!apiKey) {
      throw new Error("HF_API_KEY is not defined");
    }

    logger.info("Embedding batch started", {
      module: "embeddings-service",
      batchSize: texts.length,
      endpoint: HF_E5_ENDPOINT,
    });

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < MAX_RETRIES) {
      attempt += 1;
      try {
        const response = await fetch(HF_E5_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: texts }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const message = `Embedding API failed with status ${response.status}: ${errorBody}`;

          logger.error("Embedding batch failed", {
            module: "embeddings-service",
            attempt,
            status: response.status,
            errorBody,
          });

          if (attempt < MAX_RETRIES && isTransientStatus(response.status)) {
            await sleep(2 ** attempt * 500);
            continue;
          }

          throw new Error(message);
        }

        const payload = (await response.json()) as unknown;
        const vectors = parseEmbeddingResponse(payload, texts.length);

        logger.info("Embedding batch completed", {
          module: "embeddings-service",
          batchSize: texts.length,
          attempt,
        });

        return vectors;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        logger.error("Embedding batch attempt failed", {
          module: "embeddings-service",
          attempt,
          err,
        });

        if (attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 500);
          continue;
        }
      }
    }

    throw new Error(`Embedding batch failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  async processNoteEmbeddingJob(data: NoteEmbeddingJobData): Promise<void> {
    logger.info("Note embedding processing started", {
      noteId: data.noteId,
      userId: data.userId,
      module: "note-embedding",
    });

    await embeddingsRepository.updateNoteEmbeddingState(data.noteId, {
      status: "processing",
      progress: 10,
    });

    try {
      const note = await embeddingsRepository.findNoteByIdAndUser(data.noteId, data.userId);
      if (!note) {
        await embeddingsRepository.updateNoteEmbeddingState(data.noteId, {
          status: "failed",
          progress: 0,
        });
        logger.warn("Note embedding processing failed: note not found", {
          noteId: data.noteId,
          userId: data.userId,
          module: "note-embedding",
        });
        return;
      }

      ensureValidBatchSize(BATCH_SIZE, "note-embedding");

      const normalizedContent = normalizeText(note.content);
      const chunks = chunkText(normalizedContent);

      const chunkRecords = chunks.map((content) => ({
        content,
        contentHash: hashChunk(content),
      }));

      const newHashes = chunkRecords.map((chunk) => chunk.contentHash);
      const existingHashes = await embeddingsRepository.getExistingChunkHashes(note.id);
      const existingHashSet = new Set(existingHashes);

      const chunksToEmbed = chunkRecords.filter(
        (chunk) => !existingHashSet.has(chunk.contentHash),
      );

      await embeddingsRepository.deleteChunksNotInHashes(note.id, newHashes);

      const totalExpected = chunkRecords.length;
      let processedCount = existingHashes.length;

      for (let start = 0; start < chunksToEmbed.length; start += BATCH_SIZE) {
        const batch = chunksToEmbed.slice(start, start + BATCH_SIZE);
        const vectors = await this.generateEmbeddings(batch.map((item) => item.content));

        for (let i = 0; i < batch.length; i += 1) {
          const chunk = batch[i];
          const embedding = vectors[i];

          await embeddingsRepository.saveChunk({
            userId: note.userId,
            sourceType: "note",
            sourceId: note.id,
            content: chunk.content,
            contentHash: chunk.contentHash,
            embedding,
            metadata: {
              title: note.title,
              source: "note",
              noteId: note.id,
            },
          });
        }

        const persistedCount = await embeddingsRepository.countChunksBySource(note.id, "note");
        processedCount = persistedCount;

        await embeddingsRepository.updateNoteEmbeddingState(note.id, {
          status: "processing",
          progress:
            totalExpected === 0
              ? 100
              : Math.min(99, Math.round((processedCount / totalExpected) * 100)),
        });
      }

      const finalPersisted = await embeddingsRepository.countChunksBySource(note.id, "note");
      if (finalPersisted < totalExpected) {
        throw new Error(
          `Embedding persistence mismatch for note ${note.id}: expected ${totalExpected}, persisted ${finalPersisted}`,
        );
      }

      await embeddingsRepository.updateNoteEmbeddingState(note.id, {
        status: "ready",
        progress: 100,
        embeddedAt: new Date(),
      });

      logger.info("Note embedding processing completed", {
        noteId: note.id,
        userId: note.userId,
        chunksEmbedded: finalPersisted,
        module: "note-embedding",
      });
    } catch (error) {
      logger.error("Failed to process note embedding job", {
        noteId: data.noteId,
        userId: data.userId,
        module: "note-embedding",
        err: error,
      });
      await embeddingsRepository.updateNoteEmbeddingState(data.noteId, {
        status: "failed",
        progress: 0,
      });
      throw error;
    }
  }
}

export const embeddingsService = new EmbeddingsService();
