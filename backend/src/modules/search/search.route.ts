import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { searchService } from "./search.service";
import { searchQuerySchema, searchResponseSchema } from "./search.schema";

export const searchRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Search"],
        summary: "Semantic search across knowledge base",
        security: [{ bearerAuth: [] }],
        querystring: searchQuerySchema,
        response: {
          200: searchResponseSchema,
        },
      },
    },
    async (request) => {
      return searchService.search(request.user.id, request.query);
    },
  );
};
