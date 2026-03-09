import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyReply, FastifyRequest } from "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      id: string;
      email: string;
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

export const jwtPlugin = fp(async (fastify) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET,
  });

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;

        // If Authorization header exists -> verify normally.
        if (authHeader?.startsWith("Bearer ")) {
          await request.jwtVerify();
          return;
        }

        // Otherwise, fallback to JWT token from HTTP-only cookie.
        const cookieToken = request.cookies.auth_token;
        if (cookieToken) {
          request.headers.authorization = `Bearer ${cookieToken}`;
          await request.jwtVerify();
          return;
        }

        return reply.code(401).send({ message: "Unauthorized" });
      } catch {
        return reply.code(401).send({ message: "Unauthorized" });
      }
    },
  );
});
