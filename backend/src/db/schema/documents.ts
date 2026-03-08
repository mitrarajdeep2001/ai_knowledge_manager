import {
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 500 }).notNull(),
    filePath: text("file_path").notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("uploaded"),
    processedChunks: integer("processed_chunks").notNull().default(0),
    totalChunks: integer("total_chunks").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("documents_user_id_idx").on(table.userId),
    userFilenameIdx: index("documents_user_filename_idx").on(
      table.userId,
      table.filename,
    ),
    userStatusIdx: index("documents_user_status_idx").on(table.userId, table.status),
  }),
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
