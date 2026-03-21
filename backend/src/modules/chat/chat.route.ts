import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { chatService } from "./chat.service";
import { chatRequestSchema } from "./chat.schema";

export const chatRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * POST /api/chat/stream
   *
   * Scoped RAG chat endpoint — streams the AI response as SSE.
   *
   * scope.type controls what knowledge is searched:
   *   "all"      → entire knowledge base
   *   "note"     → specific notes (ids required)
   *   "document" → specific documents (ids required)
   *
   * SSE events during streaming:
   *   data: {"token":"..."}        — partial response token
   *   data: {"sessionId":"..."}    — session id (sent once, before DONE)
   *   data: [DONE]                 — stream complete
   *   data: {"error":"..."}        — on stream error (before DONE)
   */
  fastify.post(
    "/stream",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Chat"],
        summary: "Scoped RAG chat (SSE streaming)",
        description:
          "Send a message and receive a streaming response grounded in the selected knowledge scope.",
        security: [{ bearerAuth: [] }],
        body: chatRequestSchema,
        // SSE responses cannot be described accurately in OpenAPI; use 200 raw
        response: {
          200: z.any().describe("text/event-stream — SSE token stream"),
        },
      },
    },
    async (request, reply) => {
      const { user } = request;

      // Tell Fastify we are taking over the raw response stream
      reply.hijack();

      // Set SSE headers before any data is written
      const origin = request.headers.origin;
      const headers: Record<string, string> = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        // Prevents nginx/proxy buffering which would break streaming
        "X-Accel-Buffering": "no",
      };

      // Since we hijacked the request, we must manually inject CORS headers
      if (origin) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Credentials"] = "true";
      }

      reply.raw.writeHead(200, headers);
      reply.raw.flushHeaders();

      try {
        // Run the RAG pipeline — service writes directly to reply.raw
        await chatService.streamChat(user.id, request.body, reply);
      } catch (error: any) {
        request.log.error(error, "Error during chat stream");
        const errorMessage = error.message || "An unexpected error occurred during chat processing";
        reply.raw.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        reply.raw.write("data: [DONE]\n\n");
      } finally {
        // Ensure the underlying HTTP stream is closed properly
        reply.raw.end();
      }
    },
  );

  /**
   * GET /api/chat/sessions
   *
   * Returns all chat sessions for the logged in user.
   */
  fastify.get(
    "/sessions",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Chat"],
        summary: "Get all chat sessions",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              updatedAt: z.date(),
              createdAt: z.date(),
            }),
          ),
        },
      },
    },
    async (request) => {
      return chatService.getUserSessions(request.user.id);
    },
  );

  /**
   * GET /api/chat/sessions/:sessionId/messages
   *
   * Returns the message history for a given chat session (up to 50 messages).
   */
  fastify.get(
    "/sessions/:sessionId/messages",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Chat"],
        summary: "Get chat session messages",
        security: [{ bearerAuth: [] }],
        params: z.object({
          sessionId: z.string().uuid(),
        }),
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              sessionId: z.string(),
              userId: z.string(),
              role: z.enum(["user", "assistant"]),
              content: z.string(),
              // Drizzle returns timestamp columns as Date objects
              createdAt: z.date(),
            }),
          ),
        },
      },
    },
    async (request) => {
      const { sessionId } = request.params;
      return chatService.getSessionMessages(request.user.id, sessionId);
    },
  );
};
