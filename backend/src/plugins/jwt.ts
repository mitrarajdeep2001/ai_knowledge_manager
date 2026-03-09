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

        // If Authorization header exists → normal flow
        if (authHeader?.startsWith("Bearer ")) {
          await request.jwtVerify();
          return;
        }

        // If token provided in query
        const queryToken = (request.query as any)?.token;

        if (queryToken) {
          request.headers.authorization = `Bearer ${queryToken}`;
          await request.jwtVerify();
          return;
        }

        return reply.code(401).send({ message: "Unauthorized" });
      } catch (err) {
        return reply.code(401).send({ message: "Unauthorized" });
      }
    },
  );
});
