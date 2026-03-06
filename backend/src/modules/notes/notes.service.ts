import { AppError } from "../../utils/AppError";
import { notesRepository } from "./notes.repository";
import { CreateNoteInput, UpdateNoteInput } from "./notes.schema";

const toNoteDto = (note: {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: note.id,
  userId: note.userId,
  title: note.title,
  content: note.content,
  createdAt: note.createdAt.toISOString(),
  updatedAt: note.updatedAt.toISOString(),
});

export class NotesService {
  async create(userId: string, input: CreateNoteInput) {
    const note = await notesRepository.create({
      userId,
      title: input.title,
      content: input.content,
    });

    return toNoteDto(note);
  }

  async list(userId: string) {
    const noteList = await notesRepository.listByUser(userId);
    return noteList.map((note) => toNoteDto(note));
  }

  async getById(userId: string, id: string) {
    const note = await notesRepository.findByIdForUser(id, userId);
    if (!note) {
      throw new AppError("Note not found", 404);
    }

    return toNoteDto(note);
  }

  async update(userId: string, id: string, input: UpdateNoteInput) {
    if (Object.keys(input).length === 0) {
      throw new AppError("At least one field is required", 400);
    }

    const note = await notesRepository.updateByIdForUser(id, userId, input);
    if (!note) {
      throw new AppError("Note not found", 404);
    }

    return toNoteDto(note);
  }

  async delete(userId: string, id: string) {
    const note = await notesRepository.deleteByIdForUser(id, userId);
    if (!note) {
      throw new AppError("Note not found", 404);
    }

    return { success: true };
  }
}

export const notesService = new NotesService();
