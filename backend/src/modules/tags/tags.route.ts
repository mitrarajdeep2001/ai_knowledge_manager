import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { tagsService } from "./tags.service";

const tagsResponseSchema = z.object({
  tags: z.array(z.string()),
});

export const tagsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Tags"],
        summary: "Get used tags for current user",
        security: [{ bearerAuth: [] }],
        response: {
          200: tagsResponseSchema,
        },
      },
    },
    async (request) => {
      return tagsService.listUsedTagNames(request.user.id);
    },
  );
};
