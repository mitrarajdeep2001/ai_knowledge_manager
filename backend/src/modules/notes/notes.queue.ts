import { enqueueNoteEmbeddingJob as enqueueSharedNoteEmbeddingJob } from "../../shared/ai/embeddings/embeddings.queue";
import type { NoteEmbeddingJobData } from "../../shared/ai/embeddings/embeddings.queue";

export const enqueueNoteEmbeddingJob = async (data: NoteEmbeddingJobData): Promise<void> => {
  await enqueueSharedNoteEmbeddingJob(data);
};
