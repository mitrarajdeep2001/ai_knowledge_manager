import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: string | number[] }>({
  dataType() {
    return "vector";
  },
  toDriver(value) {
    if (Array.isArray(value)) {
      return `[${value.join(",")}]`;
    }

    return value;
  },
});

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
  toDriver(value) {
    return value;
  },
});

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: vector("embedding").notNull(),
    searchVector: tsvector("search_vector"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sourceHashUniqueIdx: uniqueIndex("knowledge_chunks_source_hash_unique").on(
      table.sourceId,
      table.contentHash,
    ),
    sourceIdIdx: index("knowledge_chunks_source_id_idx").on(table.sourceId),
    userIdIdx: index("knowledge_chunks_user_id_idx").on(table.userId),
  }),
);

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;
