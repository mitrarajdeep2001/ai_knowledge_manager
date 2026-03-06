import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.schema";
import { z, ZodError } from "zod";

export const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/register",
    {
      schema: {
        tags: ["Auth"],
        summary: "Register user",
        body: registerSchema,
      },
    },
    async (request, reply) => {
      try {
        const data = registerSchema.parse(request.body);
        const result = await authService.register(data, fastify);
        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof ZodError) {
          return reply
            .code(400)
            .send({ message: "Validation error", errors: error.errors });
        }
        throw error;
      }
    },
  );

  fastify.post(
    "/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Login user",
        body: loginSchema,
      },
    },
    async (request, reply) => {
      try {
        const data = loginSchema.parse(request.body);
        const result = await authService.login(data, fastify);
        return reply.send(result);
      } catch (error) {
        if (error instanceof ZodError) {
          return reply
            .code(400)
            .send({ message: "Validation error", errors: error.errors });
        }
        throw error;
      }
    },
  );

  fastify.get(
    "/me",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Auth"],
        summary: "Get current user",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            id: z.string(),
            email: z.string().email(),
          }),
        },
      },
    },
    async (request) => {
      return request.user;
    },
  );
};
