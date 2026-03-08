import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../../db/index";
import {
  NewNote,
  knowledgeChunks,
  noteTags,
  notes,
  tags,
  type Note,
} from "../../db/schema";
import { logger } from "../../utils/logger";

interface ListNotesFilters {
  page: number;
  limit: number;
  search?: string;
  tags: string[];
}

export interface NoteWithTags extends Note {
  tags: string[];
}

export interface ChunkToStore {
  userId: string;
  sourceId: string;
  content: string;
  contentHash: string;
  embedding: number[];
  metadata: Record<string, unknown>;
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
        .where(and(eq(tags.userId, userId), inArray(tags.name, filters.tags)))
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
    try {
      return await db.transaction(async (tx) => {
        const [note] = await tx
          .insert(notes)
          .values({
            ...data,
            embeddingStatus: "queued",
            embeddingProgress: 0,
            processedChunks: 0,
            totalChunks: 0,
            embeddingErrorMessage: null,
            embeddingUpdatedAt: null,
          })
          .returning();

        const tagIds = await this.upsertTagsForUser(tx, data.userId, tagNames);
        await this.replaceNoteTags(tx, note.id, tagIds);

        return {
          ...note,
          tags: tagNames,
        };
      });
    } catch (error) {
      logger.error("Database error while creating note", {
        userId: data.userId,
        module: "notes-repository",
        err: error,
      });
      throw error;
    }
  }

  async listByUser(
    userId: string,
    filters: ListNotesFilters,
  ): Promise<{ data: NoteWithTags[]; total: number }> {
    try {
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
    } catch (error) {
      logger.error("Database error while listing notes", {
        userId,
        module: "notes-repository",
        err: error,
      });
      throw error;
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<NoteWithTags | undefined> {
    try {
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
    } catch (error) {
      logger.error("Database error while loading note", {
        noteId: id,
        userId,
        module: "notes-repository",
        err: error,
      });
      throw error;
    }
  }

  async findRawByIdForUser(id: string, userId: string): Promise<Note | undefined> {
    const rows = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    return rows[0];
  }

  async updateByIdForUser(
    id: string,
    userId: string,
    updates: Partial<Pick<Note, "title" | "content">>,
    tagNames?: string[],
  ): Promise<NoteWithTags | undefined> {
    try {
      return await db.transaction(async (tx) => {
        const result = await tx
          .update(notes)
          .set({
            ...updates,
            embeddingStatus: "queued",
            embeddingProgress: 0,
            processedChunks: 0,
            totalChunks: 0,
            embeddingErrorMessage: null,
            embeddingUpdatedAt: null,
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
    } catch (error) {
      logger.error("Database error while updating note", {
        noteId: id,
        userId,
        module: "notes-repository",
        err: error,
      });
      throw error;
    }
  }

  async updateEmbeddingState(
    noteId: string,
    userId: string,
    state: {
      status: "queued" | "processing" | "ready" | "failed";
      progress: number;
      processedChunks?: number;
      totalChunks?: number;
      errorMessage?: string | null;
      embeddedAt?: Date | null;
    },
  ): Promise<void> {
    await db
      .update(notes)
      .set({
        embeddingStatus: state.status,
        embeddingProgress: state.progress,
        processedChunks: state.processedChunks,
        totalChunks: state.totalChunks,
        embeddingErrorMessage: state.errorMessage,
        embeddingUpdatedAt: state.embeddedAt,
      })
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
  }

  async getExistingChunkHashes(noteId: string): Promise<string[]> {
    const rows = await db
      .select({ contentHash: knowledgeChunks.contentHash })
      .from(knowledgeChunks)
      .where(and(eq(knowledgeChunks.sourceType, "note"), eq(knowledgeChunks.sourceId, noteId)));

    return rows.map((row) => row.contentHash);
  }

  async deleteChunksNotInHashes(noteId: string, keepHashes: string[]): Promise<void> {
    if (keepHashes.length === 0) {
      await db
        .delete(knowledgeChunks)
        .where(and(eq(knowledgeChunks.sourceType, "note"), eq(knowledgeChunks.sourceId, noteId)));
      return;
    }

    await db
      .delete(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.sourceType, "note"),
          eq(knowledgeChunks.sourceId, noteId),
          notInArray(knowledgeChunks.contentHash, keepHashes),
        ),
      );
  }

  async saveEmbeddedChunk(chunk: ChunkToStore): Promise<void> {
    await db
      .insert(knowledgeChunks)
      .values({
        userId: chunk.userId,
        sourceType: "note",
        sourceId: chunk.sourceId,
        content: chunk.content,
        contentHash: chunk.contentHash,
        embedding: chunk.embedding,
        metadata: chunk.metadata,
      })
      .onConflictDoNothing({
        target: [knowledgeChunks.sourceId, knowledgeChunks.contentHash],
      });
  }

  async countEmbeddedChunks(noteId: string): Promise<number> {
    const rows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(knowledgeChunks)
      .where(and(eq(knowledgeChunks.sourceType, "note"), eq(knowledgeChunks.sourceId, noteId)));

    return rows[0]?.total ?? 0;
  }

  async findStatusByIdForUser(noteId: string, userId: string): Promise<Note | undefined> {
    const rows = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .limit(1);

    return rows[0];
  }

  async deleteByIdForUser(id: string, userId: string): Promise<Note | undefined> {
    try {
      const result = await db
        .delete(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, userId)))
        .returning();

      return result[0];
    } catch (error) {
      logger.error("Database error while deleting note", {
        noteId: id,
        userId,
        module: "notes-repository",
        err: error,
      });
      throw error;
    }
  }
}

export const notesRepository = new NotesRepository();
