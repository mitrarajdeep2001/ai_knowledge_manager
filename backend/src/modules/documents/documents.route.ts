import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Multipart } from "@fastify/multipart";
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
import { persistUploadedFile } from "../../plugins/multer";
import { AppError } from "../../utils/AppError";

const deleteResponseSchema = z.object({ success: z.boolean() });

const readMultipartFieldValue = (
  value: Multipart | Multipart[] | undefined,
): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return readMultipartFieldValue(value[0]);
  }

  if (value.type !== "field") {
    return undefined;
  }

  return typeof value.value === "string" ? value.value : undefined;
};

export const documentsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/upload",
    {
      preValidation: [fastify.authenticate],
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
      const filePart = await request.file();
      if (!filePart) {
        throw new AppError("File is required", 400);
      }

      const parsedBody = documentUploadBodySchema.parse({
        title: readMultipartFieldValue(filePart.fields.title),
        tags: readMultipartFieldValue(filePart.fields.tags),
      });

      const uploadedFile = await persistUploadedFile(filePart);
      const document = await documentsService.upload(
        request.user.id,
        uploadedFile,
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

