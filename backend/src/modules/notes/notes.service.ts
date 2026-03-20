import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { normalizeText } from "../../utils/normalizeText";
import { chunkText } from "../../utils/chunkText";
import { hashChunk } from "../../utils/hashChunk";
import { resolveEmbeddingBatchSize } from "../../utils/embeddingBatchSize";
import { embeddingsService } from "../../shared/ai/embeddings/embeddings.service";
import { enqueueNoteEmbeddingJob } from "./notes.queue";
import { notesRepository, type NoteWithTags } from "./notes.repository";
import {
  CreateNoteInput,
  ListNotesQueryInput,
  UpdateNoteInput,
} from "./notes.schema";

const BATCH_SIZE = resolveEmbeddingBatchSize("notes-service");

const ensureValidBatchSize = (batchSize: number): void => {
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid EMBEDDING_BATCH_SIZE resolved in notes-service: ${batchSize}`);
  }
};

const normalizeTags = (tags: string[] | undefined): string[] => {
  if (!tags) {
    return [];
  }

  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
};

const toNoteDto = (note: NoteWithTags) => ({
  id: note.id,
  userId: note.userId,
  title: note.title,
  content: note.content,
  tags: note.tags,
  embeddingStatus: note.embeddingStatus,
  embeddingProgress: note.embeddingProgress,
  processedChunks: note.processedChunks,
  totalChunks: note.totalChunks,
  embeddingErrorMessage: note.embeddingErrorMessage,
  createdAt: note.createdAt.toISOString(),
  updatedAt: note.updatedAt.toISOString(),
});

const calculateProgress = (
  status: "queued" | "processing" | "ready" | "failed",
  processedChunks: number,
  totalChunks: number,
  fallbackProgress: number,
): number => {
  if (totalChunks > 0) {
    return Math.max(0, Math.min(100, Math.round((processedChunks / totalChunks) * 100)));
  }

  if (status === "ready") {
    return 100;
  }

  if (status === "failed") {
    return 0;
  }

  return Math.max(0, Math.min(100, fallbackProgress));
};

export class NotesService {
  private async enqueueEmbedding(noteId: string, userId: string) {
    try {
      await enqueueNoteEmbeddingJob({ noteId, userId });
    } catch (error) {
      logger.error("Failed to enqueue note embedding job", {
        noteId,
        userId,
        module: "notes-service",
        err: error,
      });
    }
  }

  async create(userId: string, input: CreateNoteInput) {
    const note = await notesRepository.create(
      {
        userId,
        title: input.title,
        content: input.content,
      },
      normalizeTags(input.tags),
    );

    logger.info("Note created", {
      noteId: note.id,
      userId,
      module: "notes-service",
    });

    await this.enqueueEmbedding(note.id, userId);

    return toNoteDto(note);
  }

  async list(userId: string, query: ListNotesQueryInput) {
    const filters = {
      page: query.page,
      limit: query.limit,
      search: query.search?.trim() || undefined,
      tags: normalizeTags(query.tags),
    };

    const { data, total } = await notesRepository.listByUser(userId, filters);
    const totalPages = total === 0 ? 0 : Math.ceil(total / filters.limit);

    return {
      data: data.map((note) => toNoteDto(note)),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
    };
  }

  async getById(userId: string, id: string) {
    const note = await notesRepository.findByIdForUser(id, userId);
    if (!note) {
      throw new AppError("Note not found", 404);
    }

    return toNoteDto(note);
  }

  async getStatus(userId: string, id: string) {
    const note = await notesRepository.findStatusByIdForUser(id, userId);
    if (!note) {
      throw new AppError("Note not found", 404);
    }

    const status = note.embeddingStatus as "queued" | "processing" | "ready" | "failed";

    return {
      status,
      processedChunks: note.processedChunks,
      totalChunks: note.totalChunks,
      progress: calculateProgress(
        status,
        note.processedChunks,
        note.totalChunks,
        note.embeddingProgress,
      ),
      errorMessage: note.embeddingErrorMessage,
    };
  }

  async processNoteEmbeddingJob(noteId: string, userId: string): Promise<void> {
    logger.info("Note embedding processing started", {
      module: "notes-service",
      noteId,
      userId,
    });

    await notesRepository.updateEmbeddingState(noteId, userId, {
      status: "processing",
      progress: 0,
      processedChunks: 0,
      totalChunks: 0,
      errorMessage: null,
      embeddedAt: null,
    });

    try {
      ensureValidBatchSize(BATCH_SIZE);

      const note = await notesRepository.findRawByIdForUser(noteId, userId);
      if (!note) {
        throw new AppError("Note not found", 404);
      }

      await notesRepository.updateEmbeddingState(noteId, userId, {
        status: "processing",
        progress: 20,
        processedChunks: 0,
        totalChunks: 0,
        errorMessage: null,
      });

      const normalizedContent = normalizeText(note.content);
      const chunks = chunkText(normalizedContent);
      const chunkRecords = chunks.map((content) => ({
        content,
        contentHash: hashChunk(content),
      }));

      const totalChunks = chunkRecords.length;
      const allHashes = chunkRecords.map((chunk) => chunk.contentHash);

      await notesRepository.updateEmbeddingState(noteId, userId, {
        status: "processing",
        progress: 40,
        processedChunks: 0,
        totalChunks,
        errorMessage: null,
      });

      const existingHashes = await notesRepository.getExistingChunkHashes(noteId);
      const existingHashSet = new Set(existingHashes);
      const chunksToEmbed = chunkRecords.filter(
        (chunk) => !existingHashSet.has(chunk.contentHash),
      );

      await notesRepository.deleteChunksNotInHashes(noteId, allHashes);

      let processedChunks = await notesRepository.countEmbeddedChunks(noteId);
      await notesRepository.updateEmbeddingState(noteId, userId, {
        status: "processing",
        progress: 60,
        processedChunks,
        totalChunks,
        errorMessage: null,
      });

      for (let start = 0; start < chunksToEmbed.length; start += BATCH_SIZE) {
        const batch = chunksToEmbed.slice(start, start + BATCH_SIZE);
        const vectors = await embeddingsService.generateEmbeddings(
          batch.map((item) => item.content),
        );

        for (let index = 0; index < batch.length; index += 1) {
          const chunk = batch[index];
          const embedding = vectors[index];

          await notesRepository.saveEmbeddedChunk({
            userId: note.userId,
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

        processedChunks = await notesRepository.countEmbeddedChunks(noteId);
        const ratio = totalChunks === 0 ? 1 : processedChunks / totalChunks;
        const incrementalProgress = Math.max(60, Math.min(79, Math.round(60 + ratio * 19)));

        await notesRepository.updateEmbeddingState(noteId, userId, {
          status: "processing",
          progress: incrementalProgress,
          processedChunks,
          totalChunks,
          errorMessage: null,
        });
      }

      processedChunks = await notesRepository.countEmbeddedChunks(noteId);
      await notesRepository.updateEmbeddingState(noteId, userId, {
        status: "processing",
        progress: 80,
        processedChunks,
        totalChunks,
        errorMessage: null,
      });

      await notesRepository.updateEmbeddingState(noteId, userId, {
        status: "ready",
        progress: 100,
        processedChunks,
        totalChunks,
        errorMessage: null,
        embeddedAt: new Date(),
      });

      logger.info("Note embedding processing completed", {
        module: "notes-service",
        noteId,
        userId,
        processedChunks,
        totalChunks,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      logger.error("Note embedding processing failed", {
        module: "notes-service",
        noteId,
        userId,
        err: error,
      });

      await notesRepository.updateEmbeddingState(noteId, userId, {
        status: "failed",
        progress: 0,
        errorMessage: message,
      });

      throw error;
    }
  }

  async update(userId: string, id: string, input: UpdateNoteInput) {
    const note = await notesRepository.updateByIdForUser(
      id,
      userId,
      {
        title: input.title,
        content: input.content,
      },
      input.tags !== undefined ? normalizeTags(input.tags) : undefined,
    );

    if (!note) {
      throw new AppError("Note not found", 404);
    }

    logger.info("Note updated", {
      noteId: note.id,
      userId,
      module: "notes-service",
    });

    await this.enqueueEmbedding(note.id, userId);

    return toNoteDto(note);
  }

  async delete(userId: string, id: string) {
    const note = await notesRepository.deleteByIdForUser(id, userId);
    if (!note) {
      throw new AppError("Note not found", 404);
    }

    logger.info("Note deleted", {
      noteId: id,
      userId,
      module: "notes-service",
    });

    return { success: true };
  }
}

export const notesService = new NotesService();

