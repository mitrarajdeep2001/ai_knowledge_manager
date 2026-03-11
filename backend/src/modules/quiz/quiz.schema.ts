import { z } from "zod";

export const generateQuizSchema = z.object({
  sourceType: z.enum(["note", "document"]),
  sourceId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  questionCount: z.number().int().min(3).max(20).default(5),
  durationSeconds: z.number().int().min(60).max(3600).default(300),
});

export const generateQuizByTopicSchema = z.object({
  topic: z.string().trim().min(1).max(500),
  questionCount: z.number().int().min(3).max(20).default(5),
});

export const startQuizSchema = z.object({
  quizId: z.string().uuid(),
});

export const submitQuizSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      answer: z.string(),
    }),
  ),
});

export const quizIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listQuizHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const quizSetResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  sourceType: z.string(),
  sourceId: z.string().uuid().nullable(),
  durationSeconds: z.number().int(),
  createdAt: z.string(),
});

export const quizQuestionResponseSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  question: z.string(),
  type: z.string(),
  options: z.record(z.string(), z.string()),
});

export const quizAttemptResponseSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  userId: z.string().uuid(),
  score: z.number().int(),
  totalQuestions: z.number().int(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  isTimeExpired: z.boolean(),
});

export const quizHistoryResponseSchema = z.object({
  id: z.string().uuid(),
  quizTitle: z.string(),
  score: z.number().int(),
  totalQuestions: z.number().int(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  isTimeExpired: z.boolean(),
});

export const paginatedQuizHistoryResponseSchema = z.object({
  data: z.array(quizHistoryResponseSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export const quizGeneratedResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  questionCount: z.number().int(),
  durationSeconds: z.number().int(),
});

export const quizStartedQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  type: z.string(),
  options: z.unknown(),
});

export const quizStartedResponseSchema = z.object({
  attemptId: z.string().uuid(),
  title: z.string(),
  durationSeconds: z.number().int(),
  totalQuestions: z.number().int(),
  startedAt: z.string(),
  expiresAt: z.string(),
  questions: z.array(quizStartedQuestionSchema),
});

export const quizSubmittedResponseSchema = z.object({
  attemptId: z.string().uuid(),
  score: z.number().int(),
  correctAnswers: z.number().int(),
  totalQuestions: z.number().int(),
  completedAt: z.string().nullable(),
  isTimeExpired: z.boolean(),
});

export const quizSetItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  sourceType: z.string(),
  sourceId: z.string().uuid().nullable(),
  durationSeconds: z.number().int(),
  questionCount: z.number().int(),
  createdAt: z.string(),
});

export const paginatedQuizSetsResponseSchema = z.object({
  data: z.array(quizSetItemSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
export type GenerateQuizByTopicInput = z.infer<typeof generateQuizByTopicSchema>;
export type StartQuizInput = z.infer<typeof startQuizSchema>;
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;
export type ListQuizHistoryQueryInput = z.infer<typeof listQuizHistoryQuerySchema>;
