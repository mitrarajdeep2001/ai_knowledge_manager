import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../../db/index";
import { NewNote, noteTags, notes, tags, type Note } from "../../db/schema";

interface ListNotesFilters {
  page: number;
  limit: number;
  search?: string;
  tags: string[];
}

export interface NoteWithTags extends Note {
  tags: string[];
}

export class NotesRepository {
  private buildWhereClause(userId: string, filters?: ListNotesFilters): SQL {
    const conditions: SQL[] = [eq(notes.userId, userId)];

    if (filters?.search && filters.search.length > 0) {
      const pattern = `%${filters.search}%`;
      conditions.push(or(ilike(notes.title, pattern), ilike(notes.content, pattern))!);
    }

    if (filters?.tags && filters.tags.length > 0) {
      const filteredNoteIds = db
        .select({ noteId: noteTags.noteId })
        .from(noteTags)
        .innerJoin(tags, eq(tags.id, noteTags.tagId))
        .where(
          and(eq(tags.userId, userId), inArray(tags.name, filters.tags)),
        )
        .groupBy(noteTags.noteId)
        .having(sql`count(distinct ${tags.name}) = ${filters.tags.length}`);

      conditions.push(inArray(notes.id, filteredNoteIds));
    }

    return and(...conditions)!;
  }

  private async getTagMapForNoteIds(
    userId: string,
    noteIds: string[],
  ): Promise<Map<string, string[]>> {
    const tagMap = new Map<string, string[]>();
    if (noteIds.length === 0) {
      return tagMap;
    }

    const rows = await db
      .select({ noteId: noteTags.noteId, tagName: tags.name })
      .from(noteTags)
      .innerJoin(tags, eq(tags.id, noteTags.tagId))
      .where(and(eq(tags.userId, userId), inArray(noteTags.noteId, noteIds)))
      .orderBy(tags.name);

    for (const row of rows) {
      const current = tagMap.get(row.noteId) ?? [];
      current.push(row.tagName);
      tagMap.set(row.noteId, current);
    }

    return tagMap;
  }

  private async upsertTagsForUser(
    tx: typeof db,
    userId: string,
    tagNames: string[],
  ): Promise<string[]> {
    if (tagNames.length === 0) {
      return [];
    }

    await tx
      .insert(tags)
      .values(tagNames.map((name) => ({ userId, name })))
      .onConflictDoNothing({ target: [tags.userId, tags.name] });

    const existing = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, tagNames)));

    return existing.map((tag) => tag.id);
  }

  private async replaceNoteTags(
    tx: typeof db,
    noteId: string,
    tagIds: string[],
  ): Promise<void> {
    await tx.delete(noteTags).where(eq(noteTags.noteId, noteId));

    if (tagIds.length > 0) {
      await tx
        .insert(noteTags)
        .values(tagIds.map((tagId) => ({ noteId, tagId })))
        .onConflictDoNothing();
    }
  }

  async create(data: NewNote, tagNames: string[]): Promise<NoteWithTags> {
    return db.transaction(async (tx) => {
      const [note] = await tx.insert(notes).values(data).returning();
      const tagIds = await this.upsertTagsForUser(tx, data.userId, tagNames);
      await this.replaceNoteTags(tx, note.id, tagIds);

      return {
        ...note,
        tags: tagNames,
      };
    });
  }

  async listByUser(userId: string, filters: ListNotesFilters): Promise<{ data: NoteWithTags[]; total: number }> {
    const whereClause = this.buildWhereClause(userId, filters);
    const offset = (filters.page - 1) * filters.limit;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(notes)
        .where(whereClause)
        .orderBy(desc(notes.updatedAt))
        .limit(filters.limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(notes)
        .where(whereClause),
    ]);

    const noteIds = rows.map((note) => note.id);
    const tagMap = await this.getTagMapForNoteIds(userId, noteIds);

    return {
      data: rows.map((note) => ({
        ...note,
        tags: tagMap.get(note.id) ?? [],
      })),
      total: totalRows[0]?.total ?? 0,
    };
  }

  async findByIdForUser(id: string, userId: string): Promise<NoteWithTags | undefined> {
    const result = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    const note = result[0];
    if (!note) {
      return undefined;
    }

    const tagMap = await this.getTagMapForNoteIds(userId, [note.id]);
    return {
      ...note,
      tags: tagMap.get(note.id) ?? [],
    };
  }

  async updateByIdForUser(
    id: string,
    userId: string,
    updates: Partial<Pick<Note, "title" | "content">>,
    tagNames?: string[],
  ): Promise<NoteWithTags | undefined> {
    return db.transaction(async (tx) => {
      const result = await tx
        .update(notes)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(eq(notes.id, id), eq(notes.userId, userId)))
        .returning();

      const note = result[0];
      if (!note) {
        return undefined;
      }

      if (tagNames !== undefined) {
        const tagIds = await this.upsertTagsForUser(tx, userId, tagNames);
        await this.replaceNoteTags(tx, note.id, tagIds);
      }

      const tagMap = await this.getTagMapForNoteIds(userId, [note.id]);
      return {
        ...note,
        tags: tagMap.get(note.id) ?? [],
      };
    });
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
