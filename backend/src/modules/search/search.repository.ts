import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index";
import { knowledgeChunks, type KnowledgeChunk } from "../../db/schema/knowledgeChunks";

export interface SearchResultRow extends Record<string, unknown> {
  sourceType: string;
  sourceId: string;
  content: string;
  similarity: number;
}

interface SearchFilters {
  page: number;
  limit: number;
}

export class SearchRepository {
  async searchByEmbedding(
    userId: string,
    embedding: number[],
    filters: SearchFilters,
  ): Promise<SearchResultRow[]> {
    const offset = (filters.page - 1) * filters.limit;
    const embeddingStr = `[${embedding.join(",")}]`;

    const result = await db.execute<SearchResultRow>(
      sql`
        SELECT 
          source_type as "sourceType",
          source_id as "sourceId",
          content,
          (1 - (embedding <=> ${embeddingStr}::vector)) as similarity
        FROM knowledge_chunks
        WHERE user_id = ${userId}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${filters.limit}
        OFFSET ${offset}
      `,
    );

    return result.rows.map((row) => ({
      ...row,
      sourceId: row.sourceId as string,
      similarity: Number(row.similarity),
    }));
  }
}

export const searchRepository = new SearchRepository();
