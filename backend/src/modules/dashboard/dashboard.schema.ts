import { z } from "zod";

export const dashboardStatsSchema = z.object({
  notes: z.number().int().nonnegative(),
  documents: z.number().int().nonnegative(),
  quizzes: z.number().int().nonnegative(),
  chatSessions: z.number().int().nonnegative(),
});

export const dashboardKnowledgeBaseSchema = z.object({
  embeddingsCount: z.number().int().nonnegative(),
  embeddingModel: z.string(),
  dimension: z.number().int().positive(),
  status: z.enum(["online", "empty"]),
});

export const dashboardActivityItemSchema = z.object({
  id: z.string(),
  type: z.enum(["note", "document", "quiz", "chat"]),
  title: z.string(),
  createdAt: z.string(),
});

export const dashboardResponseSchema = z.object({
  stats: dashboardStatsSchema,
  knowledgeBase: dashboardKnowledgeBaseSchema,
  recentActivity: z.array(dashboardActivityItemSchema),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
export type DashboardKnowledgeBase = z.infer<typeof dashboardKnowledgeBaseSchema>;
export type DashboardActivityItem = z.infer<typeof dashboardActivityItemSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
