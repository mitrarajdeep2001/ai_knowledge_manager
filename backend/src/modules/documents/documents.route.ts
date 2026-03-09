import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { documentsService } from "./documents.service";
import {
  documentIdParamsSchema,
  documentResponseSchema,
  documentStatusResponseSchema,
  documentUploadBodySchema,
  listDocumentsQuerySchema,
  paginatedDocumentsResponseSchema,
} from "./documents.schema";
import { upload } from "../../plugins/multer";

const deleteResponseSchema = z.object({ success: z.boolean() });

export const documentsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/upload",
    {
      preValidation: [fastify.authenticate],
      preHandler: upload.single("file") as any,
      schema: {
        tags: ["Documents"],
        summary: "Upload document and enqueue ingestion",
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
        response: {
          201: documentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const parsedBody = documentUploadBodySchema.parse(request.body ?? {});
      const requestWithFile = request as typeof request & { file?: Express.Multer.File };
      const document = await documentsService.upload(
        request.user.id,
        requestWithFile.file,
        parsedBody,
      );

      return reply.code(201).send(document);
    },
  );

  fastify.get(
    "/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Documents"],
        summary: "List documents with pagination/search",
        security: [{ bearerAuth: [] }],
        querystring: listDocumentsQuerySchema,
        response: {
          200: paginatedDocumentsResponseSchema,
        },
      },
    },
    async (request) => {
      return documentsService.list(request.user.id, request.query);
    },
  );

  fastify.get(
    "/:id/view",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Documents"],
        summary: "Preview uploaded document",
        security: [{ bearerAuth: [] }],
        params: documentIdParamsSchema,
      },
    },
    async (request, reply) => {
      const payload = await documentsService.getViewStream(request.user.id, request.params.id);
      reply.header("Content-Type", payload.mimeType || "application/octet-stream");
      reply.header("Content-Disposition", `inline; filename="${payload.filename}"`);
      return reply.send(payload.stream);
    },
  );

  fastify.get(
    "/:id/download",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Documents"],
        summary: "Download uploaded document",
        security: [{ bearerAuth: [] }],
        params: documentIdParamsSchema,
      },
    },
    async (request, reply) => {
      const payload = await documentsService.getDownloadStream(request.user.id, request.params.id);
      reply.header("Content-Type", payload.mimeType || "application/octet-stream");
      reply.header("Content-Disposition", `attachment; filename="${payload.filename}"`);
      return reply.send(payload.stream);
    },
  );

  fastify.get(
    "/:id/status",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Documents"],
        summary: "Get document ingestion status",
        security: [{ bearerAuth: [] }],
        params: documentIdParamsSchema,
        response: {
          200: documentStatusResponseSchema,
        },
      },
    },
    async (request) => {
      return documentsService.getStatus(request.user.id, request.params.id);
    },
  );

  fastify.delete(
    "/:id",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Documents"],
        summary: "Delete a document",
        security: [{ bearerAuth: [] }],
        params: documentIdParamsSchema,
        response: {
          200: deleteResponseSchema,
        },
      },
    },
    async (request) => {
      return documentsService.delete(request.user.id, request.params.id);
    },
  );
};
