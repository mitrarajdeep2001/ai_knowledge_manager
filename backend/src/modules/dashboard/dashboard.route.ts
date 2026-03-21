import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { dashboardService } from "./dashboard.service";
import { dashboardResponseSchema } from "./dashboard.schema";

export const dashboardRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Dashboard"],
        summary: "Get current user's dashboard data",
        security: [{ bearerAuth: [] }],
        response: {
          200: dashboardResponseSchema,
        },
      },
    },
    async (request) => {
      return dashboardService.getDashboard(request.user.id);
    },
  );
};
