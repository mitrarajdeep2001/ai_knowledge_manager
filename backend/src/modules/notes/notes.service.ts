import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { enqueueNoteEmbeddingJob } from "../embeddings/embeddings.queue";
import { notesRepository, type NoteWithTags } from "./notes.repository";
import {
  CreateNoteInput,
  ListNotesQueryInput,
  UpdateNoteInput,
} from "./notes.schema";

const normalizeTags = (tags: string[] | undefined): string[] => {
  if (!tags) {
    return [];
  }

  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
};

const toNoteDto = (note: NoteWithTags) => ({
  id: note.id,
  userId: note.userId,
  title: note.title,
  content: note.content,
  tags: note.tags,
  embeddingStatus: note.embeddingStatus,
  embeddingProgress: note.embeddingProgress,
  createdAt: note.createdAt.toISOString(),
  updatedAt: note.updatedAt.toISOString(),
});

export class NotesService {
  private async enqueueEmbedding(noteId: string, userId: string) {
    try {
      await enqueueNoteEmbeddingJob({ noteId, userId });
    } catch (error) {
      logger.error("Failed to enqueue note embedding job", {
        noteId,
        userId,
        module: "notes-service",
        err: error,
      });
    }
  }

  async create(userId: string, input: CreateNoteInput) {
    const note = await notesRepository.create(
      {
        userId,
        title: input.title,
        content: input.content,
      },
      normalizeTags(input.tags),
    );

    logger.info("Note created", {
      noteId: note.id,
      userId,
      module: "notes-service",
    });

    await this.enqueueEmbedding(note.id, userId);

    return toNoteDto(note);
  }

  async list(userId: string, query: ListNotesQueryInput) {
    const filters = {
      page: query.page,
      limit: query.limit,
      search: query.search?.trim() || undefined,
      tags: normalizeTags(query.tags),
    };

    const { data, total } = await notesRepository.listByUser(userId, filters);
    const totalPages = total === 0 ? 0 : Math.ceil(total / filters.limit);

    return {
      data: data.map((note) => toNoteDto(note)),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
    };
  }

  async getById(userId: string, id: string) {
    const note = await notesRepository.findByIdForUser(id, userId);
    if (!note) {
      throw new AppError("Note not found", 404);
    }

    return toNoteDto(note);
  }

  async update(userId: string, id: string, input: UpdateNoteInput) {
    const note = await notesRepository.updateByIdForUser(
      id,
      userId,
      {
        title: input.title,
        content: input.content,
      },
      input.tags !== undefined ? normalizeTags(input.tags) : undefined,
    );

    if (!note) {
      throw new AppError("Note not found", 404);
    }

    logger.info("Note updated", {
      noteId: note.id,
      userId,
      module: "notes-service",
    });

    await this.enqueueEmbedding(note.id, userId);

    return toNoteDto(note);
  }

  async delete(userId: string, id: string) {
    const note = await notesRepository.deleteByIdForUser(id, userId);
    if (!note) {
      throw new AppError("Note not found", 404);
    }

    logger.info("Note deleted", {
      noteId: id,
      userId,
      module: "notes-service",
    });

    return { success: true };
  }
}

export const notesService = new NotesService();
