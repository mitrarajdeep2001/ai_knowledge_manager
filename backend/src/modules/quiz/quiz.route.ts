import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { quizService } from "./quiz.service";
import {
  generateQuizSchema,
  generateQuizByTopicSchema,
  startQuizSchema,
  submitQuizSchema,
  listQuizHistoryQuerySchema,
  paginatedQuizHistoryResponseSchema,
  quizGeneratedResponseSchema,
  quizStartedResponseSchema,
  quizSubmittedResponseSchema,
  paginatedQuizSetsResponseSchema,
} from "./quiz.schema";

export const quizRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/generate",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Quiz"],
        summary: "Generate a quiz from note or document",
        security: [{ bearerAuth: [] }],
        body: generateQuizSchema,
        response: {
          201: quizGeneratedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const quiz = await quizService.generateQuiz(request.user.id, request.body);
      return reply.code(201).send(quiz);
    },
  );

  fastify.post(
    "/generate-by-topic",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Quiz"],
        summary: "Generate a quiz from knowledge base using semantic search",
        security: [{ bearerAuth: [] }],
        body: generateQuizByTopicSchema,
        response: {
          201: quizGeneratedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const quiz = await quizService.generateQuizByTopic(request.user.id, request.body);
      return reply.code(201).send(quiz);
    },
  );

  fastify.post(
    "/start",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Quiz"],
        summary: "Start a quiz attempt",
        security: [{ bearerAuth: [] }],
        body: startQuizSchema,
        response: {
          200: quizStartedResponseSchema,
        },
      },
    },
    async (request) => {
      return quizService.startQuiz(request.user.id, request.body);
    },
  );

  fastify.post(
    "/submit",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Quiz"],
        summary: "Submit quiz answers",
        security: [{ bearerAuth: [] }],
        body: submitQuizSchema,
        response: {
          200: quizSubmittedResponseSchema,
        },
      },
    },
    async (request) => {
      return quizService.submitQuiz(request.user.id, request.body);
    },
  );

  fastify.get(
    "/history",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Quiz"],
        summary: "Get quiz history",
        security: [{ bearerAuth: [] }],
        querystring: listQuizHistoryQuerySchema,
        response: {
          200: paginatedQuizHistoryResponseSchema,
        },
      },
    },
    async (request) => {
      return quizService.getHistory(request.user.id, request.query);
    },
  );

  fastify.get(
    "/",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Quiz"],
        summary: "List all quiz sets",
        security: [{ bearerAuth: [] }],
        querystring: listQuizHistoryQuerySchema,
        response: {
          200: paginatedQuizSetsResponseSchema,
        },
      },
    },
    async (request) => {
      return quizService.listQuizSets(request.user.id, request.query);
    },
  );

  fastify.delete(
    "/:id",
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ["Quiz"],
        summary: "Delete a quiz set and all its history",
        security: [{ bearerAuth: [] }],
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await quizService.deleteQuizSet(id, request.user.id);
      return { message: "Quiz deleted successfully" };
    },
  );
};
