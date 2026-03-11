import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { logger } from "../../utils/logger";
import {
  quizSets,
  quizQuestions,
  quizAttempts,
  quizAnswers,
  type QuizSet,
  type NewQuizSet,
  type QuizQuestion,
  type NewQuizQuestion,
  type QuizAttempt,
  type NewQuizAttempt,
  type QuizAnswer,
  type NewQuizAnswer,
} from "../../db/schema/quiz";

interface CreateQuizSetInput {
  userId: string;
  title: string;
  sourceType: "note" | "document";
  sourceId: string;
  durationSeconds: number;
}

interface CreateQuizQuestionInput {
  quizId: string;
  question: string;
  type: "mcq" | "true_false";
  options: Record<string, string>;
  correctAnswer: string;
  explanation?: string;
}

interface CreateQuizAttemptInput {
  quizId: string;
  userId: string;
  totalQuestions: number;
  startedAt: Date;
}

interface CreateQuizAnswerInput {
  attemptId: string;
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}

export class QuizRepository {
  async createQuizSet(input: CreateQuizSetInput): Promise<QuizSet> {
    try {
      const [quizSet] = await db
        .insert(quizSets)
        .values({
          userId: input.userId,
          title: input.title,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          durationSeconds: input.durationSeconds,
        })
        .returning();

      return quizSet;
    } catch (error) {
      logger.error("Database error while creating quiz set", {
        userId: input.userId,
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async createQuestions(questions: CreateQuizQuestionInput[]): Promise<QuizQuestion[]> {
    try {
      const created = await db
        .insert(quizQuestions)
        .values(questions)
        .returning();

      return created;
    } catch (error) {
      logger.error("Database error while creating quiz questions", {
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async findQuizSetById(quizId: string): Promise<QuizSet | undefined> {
    try {
      const rows = await db
        .select()
        .from(quizSets)
        .where(eq(quizSets.id, quizId))
        .limit(1);

      return rows[0];
    } catch (error) {
      logger.error("Database error while finding quiz set", {
        quizId,
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async findQuestionsByQuizId(quizId: string): Promise<QuizQuestion[]> {
    try {
      return await db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quizId));
    } catch (error) {
      logger.error("Database error while finding quiz questions", {
        quizId,
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async createAttempt(input: CreateQuizAttemptInput): Promise<QuizAttempt> {
    try {
      const [attempt] = await db
        .insert(quizAttempts)
        .values({
          quizId: input.quizId,
          userId: input.userId,
          totalQuestions: input.totalQuestions,
          startedAt: input.startedAt,
        })
        .returning();

      return attempt;
    } catch (error) {
      logger.error("Database error while creating quiz attempt", {
        quizId: input.quizId,
        userId: input.userId,
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async findAttemptById(attemptId: string): Promise<QuizAttempt | undefined> {
    try {
      const rows = await db
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.id, attemptId))
        .limit(1);

      return rows[0];
    } catch (error) {
      logger.error("Database error while finding quiz attempt", {
        attemptId,
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async saveAnswers(answers: CreateQuizAnswerInput[]): Promise<QuizAnswer[]> {
    try {
      return await db
        .insert(quizAnswers)
        .values(answers)
        .returning();
    } catch (error) {
      logger.error("Database error while saving quiz answers", {
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async completeAttempt(
    attemptId: string,
    score: number,
    isTimeExpired: boolean,
  ): Promise<QuizAttempt> {
    try {
      const [attempt] = await db
        .update(quizAttempts)
        .set({
          score,
          completedAt: new Date(),
          isTimeExpired,
        })
        .where(eq(quizAttempts.id, attemptId))
        .returning();

      return attempt;
    } catch (error) {
      logger.error("Database error while completing quiz attempt", {
        attemptId,
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async getHistoryByUser(
    userId: string,
    filters: { page: number; limit: number },
  ): Promise<{ data: (QuizAttempt & { quizTitle: string })[]; total: number }> {
    try {
      const offset = (filters.page - 1) * filters.limit;

      const [rows, totalRows] = await Promise.all([
        db
          .select({
            id: quizAttempts.id,
            quizId: quizAttempts.quizId,
            userId: quizAttempts.userId,
            score: quizAttempts.score,
            totalQuestions: quizAttempts.totalQuestions,
            startedAt: quizAttempts.startedAt,
            completedAt: quizAttempts.completedAt,
            isTimeExpired: quizAttempts.isTimeExpired,
            quizTitle: quizSets.title,
          })
          .from(quizAttempts)
          .innerJoin(quizSets, eq(quizAttempts.quizId, quizSets.id))
          .where(eq(quizAttempts.userId, userId))
          .orderBy(desc(quizAttempts.startedAt))
          .limit(filters.limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(quizAttempts)
          .where(eq(quizAttempts.userId, userId)),
      ]);

      return {
        data: rows,
        total: totalRows[0]?.total ?? 0,
      };
    } catch (error) {
      logger.error("Database error while getting quiz history", {
        userId,
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async deleteQuizSet(quizId: string, userId: string): Promise<QuizSet | undefined> {
    try {
      const [deleted] = await db
        .delete(quizSets)
        .where(and(eq(quizSets.id, quizId), eq(quizSets.userId, userId)))
        .returning();

      return deleted;
    } catch (error) {
      logger.error("Database error while deleting quiz set", {
        quizId,
        userId,
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async listQuizSetsByUser(
    userId: string,
    filters: { page: number; limit: number },
  ): Promise<{ data: QuizSet[]; total: number }> {
    try {
      const offset = (filters.page - 1) * filters.limit;

      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(quizSets)
          .where(eq(quizSets.userId, userId))
          .orderBy(desc(quizSets.createdAt))
          .limit(filters.limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(quizSets)
          .where(eq(quizSets.userId, userId)),
      ]);

      return {
        data: rows,
        total: totalRows[0]?.total ?? 0,
      };
    } catch (error) {
      logger.error("Database error while listing quiz sets", {
        userId,
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }

  async getQuizSetWithQuestionCount(quizId: string, userId: string): Promise<(QuizSet & { questionCount: number }) | undefined> {
    try {
      const rows = await db
        .select({
          id: quizSets.id,
          userId: quizSets.userId,
          title: quizSets.title,
          sourceType: quizSets.sourceType,
          sourceId: quizSets.sourceId,
          durationSeconds: quizSets.durationSeconds,
          createdAt: quizSets.createdAt,
          questionCount: sql<number>`count(${quizQuestions.id})::int`,
        })
        .from(quizSets)
        .leftJoin(quizQuestions, eq(quizSets.id, quizQuestions.quizId))
        .where(and(eq(quizSets.id, quizId), eq(quizSets.userId, userId)))
        .groupBy(quizSets.id);

      return rows[0];
    } catch (error) {
      logger.error("Database error while getting quiz set with question count", {
        quizId,
        userId,
        module: "quiz-repository",
        err: error,
      });
      throw error;
    }
  }
}

export const quizRepository = new QuizRepository();
