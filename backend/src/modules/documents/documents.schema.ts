import { z } from "zod";

const parseTagsInput = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => String(item).split(","));
  }

  if (typeof value === "string") {
    return value.split(",");
  }

  return [];
};

const tagArraySchema = z.array(z.string().trim().min(1).max(100)).max(20);

export const documentStatusSchema = z.enum([
  "uploaded",
  "processing",
  "completed",
  "failed",
]);

export const documentUploadBodySchema = z.object({
  tags: z.preprocess(parseTagsInput, tagArraySchema).optional().default([]),
});

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(500).optional(),
});

export const documentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const documentResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  filename: z.string(),
  filePath: z.string(),
  mimeType: z.string(),
  status: documentStatusSchema,
  processedChunks: z.number().int().min(0),
  totalChunks: z.number().int().min(0),
  tags: z.array(z.string()),
  createdAt: z.string(),
});

export const documentStatusResponseSchema = z.object({
  status: documentStatusSchema,
  processedChunks: z.number().int().min(0),
  totalChunks: z.number().int().min(0),
  progress: z.number().min(0).max(100),
});

export const paginatedDocumentsResponseSchema = z.object({
  data: z.array(documentResponseSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export type DocumentUploadBodyInput = z.infer<typeof documentUploadBodySchema>;
export type ListDocumentsQueryInput = z.infer<typeof listDocumentsQuerySchema>;
