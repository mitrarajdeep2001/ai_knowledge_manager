import { Queue, type ConnectionOptions } from "bullmq";
import { logger } from "../../../utils/logger";

export type NoteEmbeddingJobData = {
  noteId: string;
  userId: string;
};

export type DocumentProcessingJobData = {
  documentId: string;
  userId: string;
};

export type EmbeddingsJobName = "note-embedding-sync" | "document-processing";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const createRedisConnection = (name: string): ConnectionOptions => ({
  url: redisUrl,
  maxRetriesPerRequest: null,
  connectionName: name,
});

const queueConnection = createRedisConnection("embeddings-queue");

export const embeddingsQueue = new Queue<
  NoteEmbeddingJobData | DocumentProcessingJobData,
  void,
  EmbeddingsJobName
>("embeddings", {
  connection: queueConnection,
});

export const enqueueNoteEmbeddingJob = async (
  data: NoteEmbeddingJobData,
): Promise<void> => {
  await embeddingsQueue.add("note-embedding-sync", data, {
    jobId: `note_${data.noteId}`,
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: false,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  });
};
