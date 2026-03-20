import "dotenv/config";
import { Worker } from "bullmq";
import {
  createRedisConnection,
  type DocumentProcessingJobData,
  type EmbeddingsJobName,
  type NoteEmbeddingJobData,
} from "../shared/ai/embeddings/embeddings.queue";
import { documentsService } from "../modules/documents/documents.service";
import { notesService } from "../modules/notes/notes.service";
import { logger } from "../utils/logger";

export const startEmbeddingsWorker = () => {
  const redisConnection = createRedisConnection("embeddings-worker");

  const worker = new Worker<
    NoteEmbeddingJobData | DocumentProcessingJobData,
    void,
    EmbeddingsJobName
  >(
    "embeddings",
    async (job) => {
      logger.info("Worker job received", {
        module: "embeddings-worker",
        jobName: job.name,
        jobId: job.id,
        documentId: (job.data as DocumentProcessingJobData).documentId,
        userId: job.data.userId,
      });

      if (job.name === "note-embedding-sync") {
        const noteData = job.data as NoteEmbeddingJobData;
        await notesService.processNoteEmbeddingJob(noteData.noteId, noteData.userId);
        return;
      }

      if (job.name === "document-processing") {
        await documentsService.processDocumentJob(job.data as DocumentProcessingJobData);
      }
    },
    {
      connection: redisConnection,
    },
  );

  worker.on("completed", (job) => {
    logger.info("Worker job completed", {
      module: "embeddings-worker",
      jobName: job.name,
      jobId: job.id,
      userId: job.data.userId,
      documentId: (job.data as DocumentProcessingJobData).documentId,
      noteId: (job.data as NoteEmbeddingJobData).noteId,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("Worker job failed", {
      module: "embeddings-worker",
      jobName: job?.name,
      jobId: job?.id,
      userId: job?.data?.userId,
      documentId: (job?.data as DocumentProcessingJobData | undefined)?.documentId,
      noteId: (job?.data as NoteEmbeddingJobData | undefined)?.noteId,
      err: error,
    });
  });

  worker.on("error", (error) => {
    logger.error("Worker runtime error", {
      module: "embeddings-worker",
      err: error,
    });
  });

  process.on("uncaughtException", (error) => {
    logger.error("Worker uncaught exception", {
      module: "embeddings-worker",
      err: error,
    });
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Worker unhandled promise rejection", {
      module: "embeddings-worker",
      err: reason instanceof Error ? reason : new Error(String(reason)),
    });
  });

  return worker;
};

startEmbeddingsWorker();
