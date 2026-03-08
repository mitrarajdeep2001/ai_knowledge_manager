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

export const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1),
  tags: tagArraySchema.optional().default([]),
});

export const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    content: z.string().trim().min(1).optional(),
    tags: tagArraySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const noteIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(500).optional(),
  tags: z.preprocess(parseTagsInput, z.array(z.string()).default([])),
});

export const noteResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  embeddingStatus: z.string(),
  embeddingProgress: z.number().int().min(0).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const paginatedNotesResponseSchema = z.object({
  data: z.array(noteResponseSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesQueryInput = z.infer<typeof listNotesQuerySchema>;
