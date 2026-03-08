import { enqueueNoteEmbeddingJob as enqueueSharedNoteEmbeddingJob } from "../embeddings/embeddings.queue";
import type { NoteEmbeddingJobData } from "../embeddings/embeddings.queue";

export const enqueueNoteEmbeddingJob = async (data: NoteEmbeddingJobData): Promise<void> => {
  await enqueueSharedNoteEmbeddingJob(data);
};
