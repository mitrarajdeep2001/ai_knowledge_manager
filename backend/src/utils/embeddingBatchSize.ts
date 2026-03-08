import { logger } from "./logger";

const DEFAULT_BATCH_SIZE = 8;

const parseBatchSize = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_BATCH_SIZE;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.floor(parsed);
};

export const resolveEmbeddingBatchSize = (moduleName: string): number => {
  const batchSize = parseBatchSize(process.env.EMBEDDING_BATCH_SIZE);

  logger.info("Embedding batch size resolved", {
    module: moduleName,
    batchSize,
    rawValue: process.env.EMBEDDING_BATCH_SIZE,
  });

  return batchSize;
};
