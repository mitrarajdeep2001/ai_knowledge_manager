import { z } from "zod";

// Scope defines what knowledge is searched during chat
const scopeSchema = z.discriminatedUnion("type", [
  // Global scope — searches all user's knowledge
  z.object({
    type: z.literal("all"),
  }),
  // Note scope — restricts retrieval to specific notes
  z.object({
    type: z.literal("note"),
    ids: z.array(z.string().uuid()).min(1, "At least one note id is required"),
  }),
  // Document scope — restricts retrieval to specific documents
  z.object({
    type: z.literal("document"),
    ids: z.array(z.string().uuid()).min(1, "At least one document id is required"),
  }),
]);

export const chatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(4000, "Message too long"),
  sessionId: z.string().uuid().optional(),
  scope: scopeSchema,
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatScope = z.infer<typeof scopeSchema>;
export type ChatScopeType = ChatScope["type"];
