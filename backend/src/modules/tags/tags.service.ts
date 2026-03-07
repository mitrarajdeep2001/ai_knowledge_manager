import { tagsRepository } from "./tags.repository";

export class TagsService {
  async listUsedTagNames(userId: string) {
    const tagList = await tagsRepository.listUsedTagNames(userId);
    return { tags: tagList };
  }
}

export const tagsService = new TagsService();
