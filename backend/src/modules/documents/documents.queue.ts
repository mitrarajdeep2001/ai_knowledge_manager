import { embeddingsQueue, type DocumentProcessingJobData } from "../embeddings/embeddings.queue";

export { type DocumentProcessingJobData };

export const enqueueDocumentProcessingJob = async (
  data: DocumentProcessingJobData,
): Promise<void> => {
  await embeddingsQueue.add("document-processing", data, {
    jobId: `document_${data.documentId}`,
    attempts: 3,
    removeOnComplete: true,
    removeOnFail: false,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  });
};
