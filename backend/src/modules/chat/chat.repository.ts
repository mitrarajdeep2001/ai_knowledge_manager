import { sql } from "drizzle-orm";
import { db } from "../../db/index";
import { chatSessions, chatMessages } from "../../db/schema";
import type { ChatSession, NewChatSession } from "../../db/schema/chatSessions";
import type { ChatMessage, NewChatMessage } from "../../db/schema/chatMessages";
import type { ChatScope } from "./chat.schema";

// A retrieved knowledge chunk from pgvector similarity search
export interface RetrievedChunk extends Record<string, unknown> {
  sourceType: string;
  sourceId: string;
  content: string;
  similarity: number;
}

export class ChatRepository {
  // ─── Session Management ───────────────────────────────────────────────────

  /**
   * Creates a new chat session for a user.
   */
  async createSession(userId: string): Promise<ChatSession> {
    const [session] = await db
      .insert(chatSessions)
      .values({ userId } satisfies Omit<NewChatSession, "id" | "createdAt" | "updatedAt">)
      .returning();

    if (!session) {
      throw new Error("Failed to create chat session");
    }

    return session;
  }

  /**
   * Finds a session by ID, ensuring it belongs to the given user.
   */
  /**
   * Finds a session by ID, ensuring it belongs to the given user.
   */
  async findSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    const result = await db
      .select()
      .from(chatSessions)
      .where(sql`${chatSessions.id} = ${sessionId} AND ${chatSessions.userId} = ${userId}`)
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Retrieves all chat sessions for a user, ordered by most recently updated.
   * Derives a 'title' from the first user message in that session.
   */
  async getUserSessions(userId: string) {
    const sessions = await db
      .select({
        id: chatSessions.id,
        updatedAt: chatSessions.updatedAt,
        createdAt: chatSessions.createdAt,
      })
      .from(chatSessions)
      .where(sql`${chatSessions.userId} = ${userId}`)
      .orderBy(sql`${chatSessions.updatedAt} DESC`);

    // Fetch the first message for each session to infer a title
    // Efficiently done with a subquery or by fetching in parallel for small limits.
    // For simplicity, we query the first message for all returned sessions.
    const result = [];
    for (const s of sessions) {
      const msgs = await db
        .select({ content: chatMessages.content })
        .from(chatMessages)
        .where(sql`${chatMessages.sessionId} = ${s.id} AND ${chatMessages.role} = 'user'`)
        .orderBy(sql`${chatMessages.createdAt} ASC`)
        .limit(1);
        
      const firstMessage = msgs.length > 0 ? msgs[0].content : "New Chat";
      
      result.push({
        id: s.id,
        title: firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : ""),
        updatedAt: s.updatedAt,
        createdAt: s.createdAt,
      });
    }

    return result;
  }

  // ─── Message Management ───────────────────────────────────────────────────

  /**
   * Retrieves the last N messages for a session (for conversation history).
   */
  async getRecentMessages(sessionId: string, limit: number = 5): Promise<ChatMessage[]> {
    const result = await db
      .select()
      .from(chatMessages)
      .where(sql`${chatMessages.sessionId} = ${sessionId}`)
      .orderBy(sql`${chatMessages.createdAt} DESC`)
      .limit(limit);

    // Return in chronological order so they read naturally
    return result.reverse();
  }

  /**
   * Persists a single chat message (user or assistant role).
   */
  async saveMessage(params: {
    sessionId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
  }): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values(params satisfies Omit<NewChatMessage, "id" | "createdAt">)
      .returning();

    if (!message) {
      throw new Error("Failed to save chat message");
    }

    return message;
  }

  // ─── Scoped RAG Retrieval ─────────────────────────────────────────────────

  /**
   * Retrieves knowledge chunks using vector similarity with optional scope filtering.
   *
   * - scope.type === "all"      → searches all of the user's knowledge_chunks
   * - scope.type === "note"     → WHERE source_type = 'note' AND source_id IN (ids)
   * - scope.type === "document" → WHERE source_type = 'document' AND source_id IN (ids)
   */
  async retrieveChunks(
    userId: string,
    embedding: number[],
    scope: ChatScope,
    limit: number = 5,
    similarityThreshold: number = 0.65,
  ): Promise<RetrievedChunk[]> {
    const embeddingStr = `[${embedding.join(",")}]`;

    // Build the optional scope filter clause
    let scopeFilter = sql``;

    if (scope.type === "note") {
      // Cast ids array to uuid[] for the IN clause
      const idsLiteral = scope.ids.map((id) => `'${id}'`).join(",");
      scopeFilter = sql`AND source_type = 'note' AND source_id IN (${sql.raw(idsLiteral)})`;
    } else if (scope.type === "document") {
      const idsLiteral = scope.ids.map((id) => `'${id}'`).join(",");
      scopeFilter = sql`AND source_type = 'document' AND source_id IN (${sql.raw(idsLiteral)})`;
    }

    const result = await db.execute<RetrievedChunk>(
      sql`
      SELECT
        source_type AS "sourceType",
        source_id   AS "sourceId",
        content,
        (1 - (embedding <=> ${embeddingStr}::vector)) AS similarity
      FROM knowledge_chunks
      WHERE user_id = ${userId}
        AND (1 - (embedding <=> ${embeddingStr}::vector)) > ${similarityThreshold}
        ${scopeFilter}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
      `,
    );

    return result.rows.map((row) => ({
      ...row,
      similarity: Math.round(Number(row.similarity) * 100) / 100,
    }));
  }
}

export const chatRepository = new ChatRepository();
