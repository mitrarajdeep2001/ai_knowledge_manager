import { embeddingsService } from "../embeddings/embeddings.service";
import { searchRepository, type SearchResultRow } from "./search.repository";
import type { SearchQueryInput, SearchResponse } from "./search.schema";

export class SearchService {
  async search(userId: string, query: SearchQueryInput): Promise<SearchResponse> {
    const embedding = await embeddingsService.generateEmbeddings([query.q]);
    const results = await searchRepository.searchByEmbedding(
      userId,
      embedding[0],
      {
        page: query.page,
        limit: query.limit,
      },
    );

    return {
      results: results.map((row: SearchResultRow) => ({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        content: row.content,
        similarity: Math.round(row.similarity * 100) / 100,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
      },
    };
  }
}

export const searchService = new SearchService();
