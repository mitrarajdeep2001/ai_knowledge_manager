import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(1000),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const searchResultSchema = z.object({
  sourceType: z.string(),
  sourceId: z.string().uuid(),
  content: z.string(),
  similarity: z.number(),
});

export const searchPaginationSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
});

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  pagination: searchPaginationSchema,
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
