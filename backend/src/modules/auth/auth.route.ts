import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.schema";
import { z, ZodError } from "zod";

const AUTH_COOKIE_NAME = "auth_token";
const DEFAULT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const getAuthCookieOptions = () => {
  const maxAge = Number.parseInt(
    process.env.JWT_COOKIE_MAX_AGE_SECONDS ?? `${DEFAULT_COOKIE_MAX_AGE_SECONDS}`,
    10,
  );

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Number.isFinite(maxAge) && maxAge > 0 ? maxAge : DEFAULT_COOKIE_MAX_AGE_SECONDS,
  };
};

const authUserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  fullname: z.string(),
});

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

        reply.setCookie(AUTH_COOKIE_NAME, result.token, getAuthCookieOptions());

        return reply.code(201).send({ user: result.user });
      } catch (error) {
        if (error instanceof ZodError) {
          return reply
            .code(400)
            .send({ message: "Validation error", errors: error.issues });
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

        reply.setCookie(AUTH_COOKIE_NAME, result.token, getAuthCookieOptions());

        return reply.send({ user: result.user });
      } catch (error) {
        if (error instanceof ZodError) {
          return reply
            .code(400)
            .send({ message: "Validation error", errors: error.issues });
        }
        throw error;
      }
    },
  );

  fastify.post(
    "/logout",
    {
      schema: {
        tags: ["Auth"],
        summary: "Logout user",
        response: {
          200: z.object({ success: z.boolean() }),
        },
      },
    },
    async (_request, reply) => {
      reply.clearCookie(AUTH_COOKIE_NAME, {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      return reply.send({ success: true });
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
          200: authUserResponseSchema,
        },
      },
    },
    async (request) => {
      return authService.getCurrentUser(request.user.id);
    },
  );
};

