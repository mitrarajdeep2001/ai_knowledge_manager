import { sql } from "drizzle-orm";
import { db } from "../../db/index";
import { notes, documents, quizSets, chatSessions, knowledgeChunks } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { DashboardActivityItem } from "./dashboard.schema";

export class DashboardRepository {
  async countNotes(userId: string): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(notes)
      .where(eq(notes.userId, userId));
    return rows[0]?.total ?? 0;
  }

  async countDocuments(userId: string): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.userId, userId));
    return rows[0]?.total ?? 0;
  }

  async countQuizzes(userId: string): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(quizSets)
      .where(eq(quizSets.userId, userId));
    return rows[0]?.total ?? 0;
  }

  async countChatSessions(userId: string): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId));
    return rows[0]?.total ?? 0;
  }

  async countEmbeddings(userId: string): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.userId, userId));
    return rows[0]?.total ?? 0;
  }

  async getRecentActivity(userId: string): Promise<DashboardActivityItem[]> {
    const result = await db.execute<{
      id: string;
      title: string;
      type: "note" | "document" | "quiz" | "chat";
      created_at: Date;
    }>(sql`
      SELECT id::text, title, 'note' AS type, created_at
        FROM notes WHERE user_id = ${userId}
      UNION ALL
      SELECT id::text, filename AS title, 'document' AS type, created_at
        FROM documents WHERE user_id = ${userId}
      UNION ALL
      SELECT id::text, title, 'quiz' AS type, created_at
        FROM quiz_sets WHERE user_id = ${userId}
      UNION ALL
      SELECT id::text, 'Chat Session' AS title, 'chat' AS type, created_at
        FROM chat_sessions WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `);

    return result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }
}

export const dashboardRepository = new DashboardRepository();
