import { unlink } from "node:fs/promises";
import { extname } from "node:path";
import { AppError } from "../../utils/AppError";
import { documentsRepository, type DocumentWithTags } from "./documents.repository";
import { type DocumentUploadBodyInput, type ListDocumentsQueryInput } from "./documents.schema";
import { enqueueDocumentProcessingJob, type DocumentProcessingJobData } from "./documents.queue";
import { extractText } from "../../utils/extractText";
import { normalizeText } from "../../utils/normalizeText";
import { chunkText } from "../../utils/chunkText";
import { hashChunk } from "../../utils/hashChunk";
import { embeddingsService } from "../embeddings/embeddings.service";
import { embeddingsRepository } from "../embeddings/embeddings.repository";
import { logger } from "../../utils/logger";
import { resolveEmbeddingBatchSize } from "../../utils/embeddingBatchSize";

type DocumentStatus = "uploaded" | "processing" | "completed" | "failed";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md"]);
const BATCH_SIZE = resolveEmbeddingBatchSize("document-processing");

const ensureValidBatchSize = (batchSize: number): void => {
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid EMBEDDING_BATCH_SIZE resolved in document-processing: ${batchSize}`);
  }
};

const normalizeTags = (tags: string[] | undefined): string[] => {
  if (!tags) {
    return [];
  }

  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
};

const calculateProgress = (
  status: DocumentStatus,
  processedChunks: number,
  totalChunks: number,
): number => {
  if (status === "completed") {
    return 100;
  }

  if (status === "failed" || status === "uploaded") {
    return 0;
  }

  if (totalChunks <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((processedChunks / totalChunks) * 100)));
};

const toDocumentDto = (document: DocumentWithTags) => ({
  id: document.id,
  userId: document.userId,
  filename: document.filename,
  filePath: document.filePath,
  mimeType: document.mimeType,
  status: document.status as DocumentStatus,
  processedChunks: document.processedChunks,
  totalChunks: document.totalChunks,
  tags: document.tags,
  createdAt: document.createdAt.toISOString(),
});

export class DocumentsService {
  private async enqueueProcessing(documentId: string, userId: string): Promise<void> {
    await documentsRepository.updateProcessingProgress(documentId, {
      status: "processing",
      processedChunks: 0,
      totalChunks: 0,
    });

    try {
      logger.info("Document upload started", {
        documentId,
        userId,
        module: "document-processing",
      });
      await enqueueDocumentProcessingJob({ documentId, userId });
    } catch (error) {
      logger.error("Failed to enqueue document processing job", {
        documentId,
        userId,
        module: "document-processing",
        err: error,
      });
      await documentsRepository.updateProcessingProgress(documentId, {
        status: "failed",
        processedChunks: 0,
        totalChunks: 0,
      });
    }
  }

  async upload(userId: string, file: Express.Multer.File | undefined, body: DocumentUploadBodyInput) {
    if (!file) {
      throw new AppError("File is required", 400);
    }

    const fileExtension = extname(file.originalname).toLowerCase();
    const isAllowedType =
      ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(fileExtension);

    if (!isAllowedType) {
      throw new AppError("Unsupported file type", 400);
    }

    const tags = normalizeTags(body.tags);

    const document = await documentsRepository.create(
      {
        userId,
        filename: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        status: "uploaded",
        processedChunks: 0,
        totalChunks: 0,
      },
      tags,
    );

    await this.enqueueProcessing(document.id, userId);

    return {
      ...toDocumentDto(document),
      status: "processing" as const,
    };
  }

  async list(userId: string, query: ListDocumentsQueryInput) {
    const filters = {
      page: query.page,
      limit: query.limit,
      search: query.search?.trim() || undefined,
    };

    const { data, total } = await documentsRepository.listByUser(userId, filters);
    const totalPages = total === 0 ? 0 : Math.ceil(total / filters.limit);

    return {
      data: data.map((document) => toDocumentDto(document)),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
    };
  }

  async getStatus(userId: string, documentId: string) {
    let state = await documentsRepository.findStatusByIdForUser(documentId, userId);
    if (!state) {
      throw new AppError("Document not found", 404);
    }

    let status = state.status as DocumentStatus;
    let processedChunks = state.processedChunks;
    const totalChunks = state.totalChunks;

    if (status === "uploaded") {
      await this.enqueueProcessing(documentId, userId);
      state = await documentsRepository.findStatusByIdForUser(documentId, userId);
      if (state) {
        status = state.status as DocumentStatus;
        processedChunks = state.processedChunks;
      }
    }

    const storedChunks = await embeddingsRepository.countChunksBySource(documentId, "document");
    processedChunks = Math.max(processedChunks, storedChunks);

    if (status === "processing" && totalChunks > 0 && processedChunks >= totalChunks) {
      status = "completed";
      await documentsRepository.updateProcessingProgress(documentId, {
        status,
        processedChunks: totalChunks,
        totalChunks,
      });
      processedChunks = totalChunks;
    } else if (processedChunks !== state.processedChunks) {
      await documentsRepository.updateProcessingProgress(documentId, {
        status,
        processedChunks,
        totalChunks,
      });
    }

    return {
      status,
      processedChunks,
      totalChunks,
      progress: calculateProgress(status, processedChunks, totalChunks),
    };
  }

  async processDocumentJob(data: DocumentProcessingJobData): Promise<void> {
    const document = await documentsRepository.findRawById(data.documentId);
    if (!document || document.userId !== data.userId) {
      logger.warn("Document processing skipped: document not found or user mismatch", {
        documentId: data.documentId,
        userId: data.userId,
        module: "document-processing",
      });
      return;
    }

    logger.info("Document processing started", {
      documentId: document.id,
      userId: document.userId,
      module: "document-processing",
    });

    await documentsRepository.updateProcessingProgress(document.id, {
      status: "processing",
      processedChunks: 0,
      totalChunks: 0,
    });

    try {
      ensureValidBatchSize(BATCH_SIZE);

      const rawText = await extractText(document.filePath, document.mimeType);
      logger.info("Text extraction completed", {
        documentId: document.id,
        userId: document.userId,
        module: "document-processing",
      });

      const normalizedText = normalizeText(rawText);
      const chunks = chunkText(normalizedText, 500, 50);

      logger.info("Chunking completed", {
        documentId: document.id,
        userId: document.userId,
        module: "document-processing",
        chunkCount: chunks.length,
      });

      const chunkRecords = chunks.map((content) => ({
        content,
        contentHash: hashChunk(content),
      }));

      const allHashes = chunkRecords.map((chunk) => chunk.contentHash);
      const existingHashes = await embeddingsRepository.getExistingChunkHashes(document.id);
      const existingHashSet = new Set(existingHashes);

      logger.info("Document chunk hash analysis", {
        documentId: document.id,
        userId: document.userId,
        module: "document-processing",
        existingHashesCount: existingHashes.length,
        totalChunkRecords: chunkRecords.length,
      });

      const totalChunks = chunkRecords.length;
      await documentsRepository.updateProcessingProgress(document.id, {
        status: "processing",
        processedChunks: 0,
        totalChunks,
      });

      await embeddingsRepository.deleteChunksNotInHashes(document.id, allHashes);

      const chunksToEmbed = chunkRecords.filter(
        (chunk) => !existingHashSet.has(chunk.contentHash),
      );
      const expectedPersistedCount = chunkRecords.length;

      logger.info("Document embedding plan prepared", {
        documentId: document.id,
        userId: document.userId,
        module: "document-processing",
        chunksToEmbedCount: chunksToEmbed.length,
        expectedPersistedCount,
      });

      let persistedCount = await embeddingsRepository.countChunksBySource(document.id, "document");
      await documentsRepository.updateProcessingProgress(document.id, {
        status: "processing",
        processedChunks: persistedCount,
        totalChunks,
      });

      for (let start = 0; start < chunksToEmbed.length; start += BATCH_SIZE) {
        const batch = chunksToEmbed.slice(start, start + BATCH_SIZE);

        logger.info("Embedding batch started", {
          documentId: document.id,
          userId: document.userId,
          module: "document-processing",
          batchStartIndex: start,
          batchSize: batch.length,
        });

        const vectors = await embeddingsService.generateEmbeddings(
          batch.map((item) => item.content),
        );

        for (let i = 0; i < batch.length; i += 1) {
          const chunk = batch[i];
          const embedding = vectors[i];

          await embeddingsRepository.saveChunk({
            userId: document.userId,
            sourceType: "document",
            sourceId: document.id,
            content: chunk.content,
            contentHash: chunk.contentHash,
            embedding,
            metadata: {
              documentId: document.id,
              filename: document.filename,
              source: "document",
            },
          });
        }

        persistedCount = await embeddingsRepository.countChunksBySource(document.id, "document");

        logger.info("Embedding batch completed", {
          documentId: document.id,
          userId: document.userId,
          module: "document-processing",
          batchStartIndex: start,
          persistedCountAfterBatch: persistedCount,
        });

        await documentsRepository.updateProcessingProgress(document.id, {
          status: "processing",
          processedChunks: persistedCount,
          totalChunks,
        });
      }

      const finalPersistedCount = await embeddingsRepository.countChunksBySource(
        document.id,
        "document",
      );

      if (finalPersistedCount !== expectedPersistedCount) {
        logger.error("Document embedding persistence mismatch", {
          documentId: document.id,
          userId: document.userId,
          module: "document-processing",
          expectedPersistedCount,
          finalPersistedCount,
        });

        await documentsRepository.updateProcessingProgress(document.id, {
          status: "failed",
          processedChunks: finalPersistedCount,
          totalChunks,
        });

        throw new Error(
          `Document embedding persistence mismatch: expected ${expectedPersistedCount}, got ${finalPersistedCount}`,
        );
      }

      await documentsRepository.updateProcessingProgress(document.id, {
        status: "completed",
        processedChunks: finalPersistedCount,
        totalChunks,
      });

      logger.info("Document processing completed", {
        documentId: document.id,
        userId: document.userId,
        totalChunks,
        finalPersistedCount,
        module: "document-processing",
      });
    } catch (error) {
      logger.error("Document processing error", {
        documentId: document.id,
        userId: document.userId,
        module: "document-processing",
        err: error,
      });

      const persistedCount = await embeddingsRepository.countChunksBySource(document.id, "document");
      await documentsRepository.updateProcessingProgress(document.id, {
        status: "failed",
        processedChunks: persistedCount,
        totalChunks: persistedCount,
      });
      throw error;
    }
  }

  async delete(userId: string, documentId: string) {
    const deleted = await documentsRepository.deleteByIdForUser(documentId, userId);
    if (!deleted) {
      throw new AppError("Document not found", 404);
    }

    await embeddingsRepository.deleteChunksBySource(documentId);

    try {
      await unlink(deleted.filePath);
    } catch {
      logger.warn("Document file missing on disk during delete", {
        documentId,
        userId,
        filePath: deleted.filePath,
        module: "document-processing",
      });
    }

    return { success: true };
  }
}

export const documentsService = new DocumentsService();
