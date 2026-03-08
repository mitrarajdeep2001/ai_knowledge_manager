import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import { logger } from "../utils/logger";

declare module "fastify" {
  interface FastifyRequest {
    startedAtMs?: number;
  }
}

const getRouteLabel = (request: FastifyRequest): string =>
  request.routeOptions?.url ?? request.url;

export const requestLoggerPlugin = fp(async (app) => {
  app.addHook("onRequest", async (request) => {
    request.startedAtMs = Date.now();
    logger.info("Request started", {
      method: request.method,
      route: getRouteLabel(request),
      module: "http-request",
    });
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt = request.startedAtMs ?? Date.now();
    const durationMs = Date.now() - startedAt;

    logger.info("Request completed", {
      method: request.method,
      route: getRouteLabel(request),
      statusCode: reply.statusCode,
      duration: `${durationMs}ms`,
      module: "http-request",
    });
  });
});
