import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { logger } from "../../utils/logger";
import { knowledgeChunks, notes } from "../../db/schema";

export interface ChunkToStore {
  userId: string;
  sourceType: "note" | "document";
  sourceId: string;
  content: string;
  contentHash: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export class EmbeddingsRepository {
  async findNoteByIdAndUser(noteId: string, userId: string) {
    try {
      const rows = await db
        .select()
        .from(notes)
        .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
        .limit(1);

      return rows[0];
    } catch (error) {
      logger.error("Database error while loading note for embedding", {
        noteId,
        userId,
        module: "embeddings-repository",
        err: error,
      });
      throw error;
    }
  }

  async updateNoteEmbeddingState(
    noteId: string,
    state: {
      status: "queued" | "processing" | "ready" | "failed";
      progress: number;
      embeddedAt?: Date;
    },
  ) {
    try {
      await db
        .update(notes)
        .set({
          embeddingStatus: state.status,
          embeddingProgress: state.progress,
          embeddingUpdatedAt: state.embeddedAt,
        })
        .where(eq(notes.id, noteId));
    } catch (error) {
      logger.error("Database error while updating note embedding state", {
        noteId,
        status: state.status,
        module: "embeddings-repository",
        err: error,
      });
      throw error;
    }
  }

  async getExistingChunkHashes(sourceId: string): Promise<string[]> {
    try {
      const rows = await db
        .select({ contentHash: knowledgeChunks.contentHash })
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.sourceId, sourceId));

      return rows.map((row) => row.contentHash);
    } catch (error) {
      logger.error("Database error while loading existing chunk hashes", {
        sourceId,
        module: "embeddings-repository",
        err: error,
      });
      throw error;
    }
  }

  async countChunksBySource(
    sourceId: string,
    sourceType: "note" | "document",
  ): Promise<number> {
    try {
      const rows = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(knowledgeChunks)
        .where(and(eq(knowledgeChunks.sourceId, sourceId), eq(knowledgeChunks.sourceType, sourceType)));

      return rows[0]?.total ?? 0;
    } catch (error) {
      logger.error("Database error while counting chunks", {
        sourceId,
        sourceType,
        module: "embeddings-repository",
        err: error,
      });
      throw error;
    }
  }

  async deleteChunksNotInHashes(sourceId: string, keepHashes: string[]): Promise<void> {
    try {
      if (keepHashes.length === 0) {
        await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, sourceId));
        return;
      }

      await db
        .delete(knowledgeChunks)
        .where(
          and(
            eq(knowledgeChunks.sourceId, sourceId),
            notInArray(knowledgeChunks.contentHash, keepHashes),
          ),
        );
    } catch (error) {
      logger.error("Database error while deleting stale chunks", {
        sourceId,
        keepCount: keepHashes.length,
        module: "embeddings-repository",
        err: error,
      });
      throw error;
    }
  }

  async deleteChunksBySource(sourceId: string): Promise<void> {
    try {
      await db.delete(knowledgeChunks).where(eq(knowledgeChunks.sourceId, sourceId));
    } catch (error) {
      logger.error("Database error while deleting chunks by source", {
        sourceId,
        module: "embeddings-repository",
        err: error,
      });
      throw error;
    }
  }

  async saveChunk(chunk: ChunkToStore): Promise<void> {
    try {
      await db
        .insert(knowledgeChunks)
        .values({
          userId: chunk.userId,
          sourceType: chunk.sourceType,
          sourceId: chunk.sourceId,
          content: chunk.content,
          contentHash: chunk.contentHash,
          embedding: chunk.embedding,
          metadata: chunk.metadata,
        })
        .onConflictDoNothing({
          target: [knowledgeChunks.sourceId, knowledgeChunks.contentHash],
        });
    } catch (error) {
      logger.error("Database error while saving chunk", {
        sourceId: chunk.sourceId,
        sourceType: chunk.sourceType,
        module: "embeddings-repository",
        err: error,
      });
      throw error;
    }
  }
}

export const embeddingsRepository = new EmbeddingsRepository();
