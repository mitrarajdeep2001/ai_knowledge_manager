import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { chatSessions } from "./chatSessions";

// Chat messages — stores individual user and assistant messages within a session
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    // role distinguishes user queries from AI responses
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index("chat_messages_session_id_idx").on(table.sessionId),
    userIdIdx: index("chat_messages_user_id_idx").on(table.userId),
  }),
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
