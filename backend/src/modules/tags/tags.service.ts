import { logger } from "../../utils/logger";
import { tagsRepository } from "./tags.repository";

export class TagsService {
  async listUsedTagNames(userId: string) {
    logger.debug("Fetching used tags", { userId, module: "tags-service" });
    const tagList = await tagsRepository.listUsedTagNames(userId);
    return { tags: tagList };
  }
}

export const tagsService = new TagsService();
