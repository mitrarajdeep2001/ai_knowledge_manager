import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { jwtPlugin } from "./plugins/jwt";
import { authRoutes } from "./modules/auth/auth.route";
import { notesRoutes } from "./modules/notes/notes.route";
import { AppError } from "./utils/AppError";
import { ZodError } from "zod";

import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";

export const buildApp = async () => {
  const app = Fastify({
    logger: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "AI Knowledge Manager API",
        description: "API documentation for the AI Knowledge Manager backend.",
        version: "1.0.0",
      },
      servers: [],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    transform: ({ schema, url }) => {
      try {
        const transformed = jsonSchemaTransform({ schema, url });

        if (url === "/api/auth/register" && transformed.schema?.body) {
          (transformed.schema.body as any).example = {
            email: "testuser@example.com",
            username: "testuser123",
            fullname: "Test User",
            password: "SecurePassword123!",
          };
        }

        if (url === "/api/auth/login" && transformed.schema?.body) {
          (transformed.schema.body as any).example = {
            email: "testuser@example.com",
            password: "SecurePassword123!",
          };
        }

        return transformed;
      } catch {
        return { schema, url };
      }
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  await app.register(cors);
  await app.register(helmet);
  await app.register(jwtPlugin);

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(notesRoutes, { prefix: "/api/notes" });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      app.log.warn(error);
      return reply.code(error.statusCode).send({ message: error.message });
    }
    if (error instanceof ZodError) {
      return reply
        .code(400)
        .send({ message: "Validation error", errors: error.errors });
    }

    app.log.error(error);
    reply.code(500).send({ message: "Internal Server Error" });
  });

  return app;
};
