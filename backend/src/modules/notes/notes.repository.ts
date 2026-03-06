import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index";
import { NewNote, notes, Note } from "../../db/schema";

export class NotesRepository {
  async create(data: NewNote): Promise<Note> {
    const result = await db.insert(notes).values(data).returning();
    return result[0];
  }

  async listByUser(userId: string): Promise<Note[]> {
    return db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt));
  }

  async findByIdForUser(id: string, userId: string): Promise<Note | undefined> {
    const result = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    return result[0];
  }

  async updateByIdForUser(
    id: string,
    userId: string,
    updates: Partial<Pick<Note, "title" | "content">>,
  ): Promise<Note | undefined> {
    const result = await db
      .update(notes)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();

    return result[0];
  }

  async deleteByIdForUser(id: string, userId: string): Promise<Note | undefined> {
    const result = await db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();

    return result[0];
  }
}

export const notesRepository = new NotesRepository();
