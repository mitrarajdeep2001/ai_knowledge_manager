import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index";
import { noteTags, tags } from "../../db/schema";

export class TagsRepository {
  async listUsedTagNames(userId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ name: tags.name })
      .from(tags)
      .innerJoin(noteTags, eq(noteTags.tagId, tags.id))
      .where(eq(tags.userId, userId))
      .orderBy(asc(tags.name));

    return rows.map((row) => row.name);
  }
}

export const tagsRepository = new TagsRepository();
