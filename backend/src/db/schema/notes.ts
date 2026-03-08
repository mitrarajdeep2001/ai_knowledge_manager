import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    embeddingStatus: varchar("embedding_status", { length: 32 })
      .notNull()
      .default("queued"),
    embeddingProgress: integer("embedding_progress").notNull().default(0),
    processedChunks: integer("processed_chunks").notNull().default(0),
    totalChunks: integer("total_chunks").notNull().default(0),
    embeddingErrorMessage: text("embedding_error_message"),
    embeddingUpdatedAt: timestamp("embedding_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("notes_user_id_idx").on(table.userId),
  }),
);

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
