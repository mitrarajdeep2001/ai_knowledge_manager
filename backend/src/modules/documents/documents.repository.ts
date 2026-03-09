import { and, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { logger } from "../../utils/logger";
import {
  documentTags,
  documents,
  knowledgeChunks,
  tags,
  type Document,
  type NewDocument,
} from "../../db/schema";

type DocumentProcessingStatus = "uploaded" | "processing" | "completed" | "failed";

interface ListDocumentsFilters {
  page: number;
  limit: number;
  search?: string;
}

export interface DocumentWithTags extends Document {
  tags: string[];
}

export class DocumentsRepository {
  private buildWhereClause(userId: string, filters?: ListDocumentsFilters): SQL {
    const conditions: SQL[] = [eq(documents.userId, userId)];

    if (filters?.search && filters.search.length > 0) {
      conditions.push(ilike(documents.filename, `%${filters.search}%`));
    }

    return and(...conditions)!;
  }

  private async getTagMapForDocumentIds(
    userId: string,
    documentIds: string[],
  ): Promise<Map<string, string[]>> {
    const tagMap = new Map<string, string[]>();
    if (documentIds.length === 0) {
      return tagMap;
    }

    const rows = await db
      .select({ documentId: documentTags.documentId, tagName: tags.name })
      .from(documentTags)
      .innerJoin(tags, eq(tags.id, documentTags.tagId))
      .where(and(eq(tags.userId, userId), inArray(documentTags.documentId, documentIds)))
      .orderBy(tags.name);

    for (const row of rows) {
      const current = tagMap.get(row.documentId) ?? [];
      current.push(row.tagName);
      tagMap.set(row.documentId, current);
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

  private async replaceDocumentTags(tx: typeof db, documentId: string, tagIds: string[]): Promise<void> {
    await tx.delete(documentTags).where(eq(documentTags.documentId, documentId));

    if (tagIds.length > 0) {
      await tx
        .insert(documentTags)
        .values(tagIds.map((tagId) => ({ documentId, tagId })))
        .onConflictDoNothing();
    }
  }

  async create(data: NewDocument, tagNames: string[]): Promise<DocumentWithTags> {
    try {
      return await db.transaction(async (tx) => {
        const [document] = await tx.insert(documents).values(data).returning();

        const tagIds = await this.upsertTagsForUser(tx, data.userId, tagNames);
        await this.replaceDocumentTags(tx, document.id, tagIds);

        return {
          ...document,
          tags: tagNames,
        };
      });
    } catch (error) {
      logger.error("Database error while creating document", {
        userId: data.userId,
        filename: data.filename,
        module: "documents-repository",
        err: error,
      });
      throw error;
    }
  }

  async listByUser(
    userId: string,
    filters: ListDocumentsFilters,
  ): Promise<{ data: DocumentWithTags[]; total: number }> {
    try {
      const whereClause = this.buildWhereClause(userId, filters);
      const offset = (filters.page - 1) * filters.limit;

      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(documents)
          .where(whereClause)
          .orderBy(desc(documents.createdAt))
          .limit(filters.limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(documents)
          .where(whereClause),
      ]);

      const documentIds = rows.map((document) => document.id);
      const tagMap = await this.getTagMapForDocumentIds(userId, documentIds);

      return {
        data: rows.map((document) => ({
          ...document,
          tags: tagMap.get(document.id) ?? [],
        })),
        total: totalRows[0]?.total ?? 0,
      };
    } catch (error) {
      logger.error("Database error while listing documents", {
        userId,
        module: "documents-repository",
        err: error,
      });
      throw error;
    }
  }

  async findByIdForUser(documentId: string, userId: string): Promise<DocumentWithTags | undefined> {
    try {
      const result = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
        .limit(1);

      const document = result[0];
      if (!document) {
        return undefined;
      }

      const tagMap = await this.getTagMapForDocumentIds(userId, [document.id]);

      return {
        ...document,
        tags: tagMap.get(document.id) ?? [],
      };
    } catch (error) {
      logger.error("Database error while finding document", {
        documentId,
        userId,
        module: "documents-repository",
        err: error,
      });
      throw error;
    }
  }

  async findStatusByIdForUser(documentId: string, userId: string) {
    try {
      const rows = await db
        .select({
          status: documents.status,
          processedChunks: documents.processedChunks,
          totalChunks: documents.totalChunks,
        })
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
        .limit(1);

      return rows[0];
    } catch (error) {
      logger.error("Database error while loading document status", {
        documentId,
        userId,
        module: "documents-repository",
        err: error,
      });
      throw error;
    }
  }

  async findRawById(documentId: string): Promise<Document | undefined> {
    try {
      const rows = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
      return rows[0];
    } catch (error) {
      logger.error("Database error while loading raw document", {
        documentId,
        module: "documents-repository",
        err: error,
      });
      throw error;
    }
  }

  async updateProcessingProgress(
    documentId: string,
    state: {
      status: DocumentProcessingStatus;
      processedChunks: number;
      totalChunks: number;
    },
  ): Promise<void> {
    try {
      await db
        .update(documents)
        .set({
          status: state.status,
          processedChunks: state.processedChunks,
          totalChunks: state.totalChunks,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
    } catch (error) {
      logger.error("Database error while updating document progress", {
        documentId,
        status: state.status,
        module: "documents-repository",
        err: error,
      });
      throw error;
    }
  }

  async deleteByIdForUser(documentId: string, userId: string): Promise<Document | undefined> {
    try {
      return await db.transaction(async (tx) => {
        await tx
          .delete(knowledgeChunks)
          .where(
            and(
              eq(knowledgeChunks.sourceType, "document"),
              eq(knowledgeChunks.sourceId, documentId),
            ),
          );

        await tx.delete(documentTags).where(eq(documentTags.documentId, documentId));

        const [deletedDocument] = await tx
          .delete(documents)
          .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
          .returning();

        return deletedDocument;
      });
    } catch (error) {
      logger.error("Database error while deleting document", {
        documentId,
        userId,
        module: "documents-repository",
        err: error,
      });
      throw error;
    }
  }
}

export const documentsRepository = new DocumentsRepository();
