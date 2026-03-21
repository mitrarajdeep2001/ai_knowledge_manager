import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import { jwtPlugin } from "./plugins/jwt";
import { authRoutes } from "./modules/auth/auth.route";
import { notesRoutes } from "./modules/notes/notes.route";
import { tagsRoutes } from "./modules/tags/tags.route";
import { documentsRoutes } from "./modules/documents/documents.route";
import { searchRoutes } from "./modules/search/search.route";
import { quizRoutes } from "./modules/quiz/quiz.route";
import { chatRoutes } from "./modules/chat/chat.route";
import { multerPlugin } from "./plugins/multer";
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
import { pinoLogger, logger } from "./utils/logger";
import { requestLoggerPlugin } from "./plugins/requestLogger";

export const buildApp = async () => {
  const app = Fastify({
    loggerInstance: pinoLogger,
    disableRequestLogging: true,
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
    transform: ({ schema, url, route }) => {
      try {
        const transformed = jsonSchemaTransform({ schema, url, route } as any);

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

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });
  await app.register(helmet);
  await app.register(cookie);
  await app.register(requestLoggerPlugin);
  await app.register(jwtPlugin);
  await app.register(multerPlugin);

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(notesRoutes, { prefix: "/api/notes" });
  app.register(tagsRoutes, { prefix: "/api/tags" });
  app.register(documentsRoutes, { prefix: "/api/documents" });
  app.register(searchRoutes, { prefix: "/api/search" });
  app.register(quizRoutes, { prefix: "/api/quiz" });
  app.register(chatRoutes, { prefix: "/api/chat" });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      logger.warn("Handled application error", {
        method: request.method,
        route: request.routeOptions?.url ?? request.url,
        statusCode: error.statusCode,
        module: "http-error-handler",
        err: error,
      });

      return reply.code(error.statusCode).send({ message: error.message });
    }

    if (error instanceof ZodError) {
      logger.warn("Validation error", {
        method: request.method,
        route: request.routeOptions?.url ?? request.url,
        statusCode: 400,
        module: "http-error-handler",
        errors: error.issues,
      });

      return reply
        .code(400)
        .send({ message: "Validation error", errors: error.issues });
    }

    logger.error("Unhandled API error", {
      method: request.method,
      route: request.routeOptions?.url ?? request.url,
      statusCode: 500,
      module: "http-error-handler",
      err: error,
    });

    reply.code(500).send({ message: "Internal Server Error" });
  });

  return app;
};
