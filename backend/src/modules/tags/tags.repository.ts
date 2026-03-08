import { eq } from "drizzle-orm";
import { db } from "../../db";
import { logger } from "../../utils/logger";
import { documentTags, noteTags, tags } from "../../db/schema";

export class TagsRepository {
  async listUsedTagNames(userId: string): Promise<string[]> {
    try {
      const [noteRows, documentRows] = await Promise.all([
        db
          .selectDistinct({ name: tags.name })
          .from(tags)
          .innerJoin(noteTags, eq(noteTags.tagId, tags.id))
          .where(eq(tags.userId, userId)),
        db
          .selectDistinct({ name: tags.name })
          .from(tags)
          .innerJoin(documentTags, eq(documentTags.tagId, tags.id))
          .where(eq(tags.userId, userId)),
      ]);

      return [...new Set([...noteRows, ...documentRows].map((row) => row.name))].sort(
        (a, b) => a.localeCompare(b),
      );
    } catch (error) {
      logger.error("Database error while listing used tags", {
        userId,
        module: "tags-repository",
        err: error,
      });
      throw error;
    }
  }
}

export const tagsRepository = new TagsRepository();
