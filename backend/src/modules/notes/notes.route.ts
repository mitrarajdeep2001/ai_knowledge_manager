import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { notesService } from "./notes.service";
import {
  createNoteSchema,
  listNotesQuerySchema,
  noteIdParamsSchema,
  noteResponseSchema,
  paginatedNotesResponseSchema,
  updateNoteSchema,
} from "./notes.schema";

const deleteResponseSchema = z.object({ success: z.boolean() });

export const notesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Notes"],
        summary: "Create note",
        security: [{ bearerAuth: [] }],
        body: createNoteSchema,
        response: {
          201: noteResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const note = await notesService.create(request.user.id, request.body);
      return reply.code(201).send(note);
    },
  );

  fastify.get(
    "/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Notes"],
        summary: "List notes with pagination/search/filter",
        security: [{ bearerAuth: [] }],
        querystring: listNotesQuerySchema,
        response: {
          200: paginatedNotesResponseSchema,
        },
      },
    },
    async (request) => {
      return notesService.list(request.user.id, request.query);
    },
  );

  fastify.get(
    "/:id",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Notes"],
        summary: "Get note by id",
        security: [{ bearerAuth: [] }],
        params: noteIdParamsSchema,
        response: {
          200: noteResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      return notesService.getById(request.user.id, id);
    },
  );

  fastify.put(
    "/:id",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Notes"],
        summary: "Update note",
        security: [{ bearerAuth: [] }],
        params: noteIdParamsSchema,
        body: updateNoteSchema,
        response: {
          200: noteResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const note = await notesService.update(request.user.id, id, request.body);
      return reply.send(note);
    },
  );

  fastify.delete(
    "/:id",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Notes"],
        summary: "Delete note",
        security: [{ bearerAuth: [] }],
        params: noteIdParamsSchema,
        response: {
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      return notesService.delete(request.user.id, id);
    },
  );
};
