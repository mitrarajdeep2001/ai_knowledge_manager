import { sql } from "drizzle-orm";
import { db } from "../../db/index";

export interface SearchResultRow extends Record<string, unknown> {
  sourceType: string;
  sourceId: string;
  content: string;
  similarity: number;
}

interface HybridSearchOptions {
  page: number;
  limit: number;
  vectorWeight: number;
  keywordWeight: number;
}

const getSearchWeights = () => {
  const vectorWeight = parseFloat(process.env.SEARCH_VECTOR_WEIGHT || "0.7");
  const keywordWeight = parseFloat(process.env.SEARCH_KEYWORD_WEIGHT || "0.3");
  return { vectorWeight, keywordWeight };
};

export class SearchRepository {
  async hybridSearch(
    userId: string,
    query: string,
    options: HybridSearchOptions,
  ): Promise<SearchResultRow[]> {

    const offset = (options.page - 1) * options.limit;

    const embedding = await this.getQueryEmbedding(query);
    const embeddingStr = `[${embedding.join(",")}]`;

    const { vectorWeight, keywordWeight } = getSearchWeights();

    const result = await db.execute<SearchResultRow>(
      sql`
      WITH vector_candidates AS (
        SELECT
          source_type,
          source_id,
          content,
          search_vector,
          (1 - (embedding <=> ${embeddingStr}::vector)) AS vector_score
        FROM knowledge_chunks
        WHERE user_id = ${userId}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT 100
      ),
      scored_candidates AS (
        SELECT
          source_type,
          source_id,
          content,
          (
            (vector_score * ${vectorWeight}) +
            (
              COALESCE(
                ts_rank_cd(search_vector, plainto_tsquery('english', ${query})),
                0
              ) * ${keywordWeight}
            )
          ) AS similarity
        FROM vector_candidates
        WHERE vector_score > 0.75
      ),
      ranked_candidates AS (
        SELECT
          source_type AS "sourceType",
          source_id AS "sourceId",
          content,
          similarity,
          ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY similarity DESC) as rn
        FROM scored_candidates
      )
      SELECT
        "sourceType",
        "sourceId",
        content,
        similarity
      FROM ranked_candidates
      WHERE rn = 1
      ORDER BY similarity DESC
      LIMIT ${options.limit}
      OFFSET ${offset}
      `,
    );

    return result.rows.map((row) => ({
      ...row,
      sourceId: row.sourceId as string,
      similarity: Math.round(Number(row.similarity) * 100) / 100,
    }));
  }

  private async getQueryEmbedding(query: string): Promise<number[]> {
    const { embeddingsService } = await import("../../shared/ai/embeddings/embeddings.service");

    const embeddings = await embeddingsService.generateEmbeddings([query]);

    return embeddings[0];
  }
}

export const searchRepository = new SearchRepository();