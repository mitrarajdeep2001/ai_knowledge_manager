import { searchRepository, type SearchResultRow } from "./search.repository";
import type { SearchQueryInput, SearchResponse } from "./search.schema";

export class SearchService {
  async search(userId: string, query: SearchQueryInput): Promise<SearchResponse> {
    const results = await searchRepository.hybridSearch(
      userId,
      query.q,
      {
        page: query.page,
        limit: query.limit,
        vectorWeight: parseFloat(process.env.SEARCH_VECTOR_WEIGHT || "0.7"),
        keywordWeight: parseFloat(process.env.SEARCH_KEYWORD_WEIGHT || "0.3"),
      },
    );

    return {
      results: results.map((row: SearchResultRow) => ({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        content: row.content,
        similarity: row.similarity,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
      },
    };
  }
}

export const searchService = new SearchService();
