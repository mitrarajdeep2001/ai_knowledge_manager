import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { notesRepository } from "../notes/notes.repository";
import { documentsRepository } from "../documents/documents.repository";
import { searchRepository } from "../search/search.repository";
import { quizRepository } from "./quiz.repository";
import type {
  GenerateQuizInput,
  GenerateQuizByTopicInput,
  StartQuizInput,
  SubmitQuizInput,
  ListQuizHistoryQueryInput,
} from "./quiz.schema";

interface QuizQuestionData {
  question: string;
  type: "mcq" | "true_false";
  options: Record<string, string>;
  correct_answer?: string;
  correctAnswer?: string;
  explanation?: string;
}

interface QuizQuestionWithQuizId {
  quizId: string;
  question: string;
  type: "mcq" | "true_false";
  options: Record<string, string>;
  correctAnswer: string;
  explanation?: string;
}

interface GeminiQuizResponse {
  questions: QuizQuestionData[];
}

const GEMINI_QUIZ_PROMPT = `Generate {count} quiz questions from the following knowledge.

Rules:
* Use multiple choice format
* Only one correct answer
* Provide explanation
* Avoid repeating questions

Context:
{context}

Return JSON in this exact format:
{"questions":[{"question":"","type":"mcq","options":{"A":"","B":"","C":"","D":""},"correct_answer":"A","explanation":"why A is correct"}]}`;

const MAX_CONTEXT_CHUNKS = 5;

const DEFAULT_GEMINI_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const getGeminiModels = (): string[] => {
  const envModels = process.env.GEMINI_MODELS;
  if (envModels) {
    return envModels.split(",").map((m) => m.trim()).filter(Boolean);
  }
  return DEFAULT_GEMINI_MODELS;
};

const MAX_RETRIES_PER_MODEL = 2;

const isTransientError = (status: number): boolean => {
  return status === 429 || (status >= 500 && status < 600);
};

const generateWithFallback = async (
  prompt: string,
  context?: { topic?: string; questionCount?: number },
): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const models = getGeminiModels();
  let lastError: Error | null = null;

  for (const model of models) {
    logger.info("Attempting quiz generation", {
      module: "quiz-service",
      model,
      ...context,
    });

    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4000,
              },
            }),
          },
        );

        if (response.status === 429) {
          logger.warn("Gemini quota exceeded", {
            module: "quiz-service",
            model,
            attempt,
            ...context,
          });
          break;
        }

        if (response.status === 404) {
          logger.warn("Gemini model not supported", {
            module: "quiz-service",
            model,
            ...context,
          });
          break;
        }

        if (!response.ok) {
          if (isTransientError(response.status)) {
            logger.warn("Gemini transient error, retrying", {
              module: "quiz-service",
              model,
              attempt,
              status: response.status,
              ...context,
            });
            continue;
          }

          const errorBody = await response.text();
          logger.warn("Gemini API error, skipping model", {
            module: "quiz-service",
            model,
            status: response.status,
            error: errorBody,
            ...context,
          });
          break;
        }

        const data = (await response.json()) as {
          candidates?: {
            content: {
              parts: { text: string }[];
            };
          }[];
        };

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (!text) {
          throw new Error("Empty response from Gemini");
        }

        logger.info("Quiz generation successful", {
          module: "quiz-service",
          model,
          ...context,
        });

        return text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn("Quiz generation attempt failed", {
          module: "quiz-service",
          model,
          attempt,
          error: lastError.message,
          ...context,
        });
      }
    }
  }

  logger.error("Quiz generation failed after trying all models", {
    module: "quiz-service",
    ...context,
    err: lastError,
  });

  throw new Error("Failed to generate quiz. Please try again later.");
};

export class QuizService {
  async generateQuiz(userId: string, input: GenerateQuizInput) {
    logger.info("Generating quiz", {
      userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      module: "quiz-service",
    });

    let content = "";

    if (input.sourceType === "note") {
      const note = await notesRepository.findByIdForUser(input.sourceId, userId);
      if (!note) {
        throw new AppError("Note not found", 404);
      }
      content = note.content;
    } else {
      const document = await documentsRepository.findByIdForUser(input.sourceId, userId);
      if (!document) {
        throw new AppError("Document not found", 404);
      }
      content = `Document: ${document.filename}`;
    }

    const quizSet = await quizRepository.createQuizSet({
      userId,
      title: input.title,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      durationSeconds: input.durationSeconds,
    });

    try {
      const questions = await this.generateQuestionsWithAI(
        content,
        input.questionCount,
        quizSet.id,
      );

      await quizRepository.createQuestions(questions);

      logger.info("Quiz generated successfully", {
        quizId: quizSet.id,
        questionCount: questions.length,
        module: "quiz-service",
      });

      return {
        id: quizSet.id,
        title: quizSet.title,
        questionCount: questions.length,
        durationSeconds: quizSet.durationSeconds,
      };
    } catch (error) {
      await quizRepository.deleteQuizSet(quizSet.id, userId);
      throw error;
    }
  }

  async generateQuizByTopic(userId: string, input: GenerateQuizByTopicInput) {
    logger.info("Generating quiz by topic", {
      userId,
      topic: input.topic,
      questionCount: input.questionCount,
      module: "quiz-service",
    });

    const knowledgeChunks = await searchRepository.hybridSearch(
      userId,
      input.topic,
      {
        page: 1,
        limit: MAX_CONTEXT_CHUNKS,
        vectorWeight: parseFloat(process.env.SEARCH_VECTOR_WEIGHT || "0.7"),
        keywordWeight: parseFloat(process.env.SEARCH_KEYWORD_WEIGHT || "0.3"),
      },
    );

    if (knowledgeChunks.length === 0) {
      throw new AppError("No relevant knowledge found for this topic", 404);
    }

    const context = knowledgeChunks.map((chunk) => chunk.content).join("\n\n");

    const quizSet = await quizRepository.createQuizSet({
      userId,
      title: `Quiz: ${input.topic}`,
      sourceType: "note",
      sourceId: knowledgeChunks[0].sourceId,
      durationSeconds: 300,
    });

    try {
      const questions = await this.generateQuestionsWithAI(
        context,
        input.questionCount,
        quizSet.id,
      );

      await quizRepository.createQuestions(questions);

      logger.info("Quiz generated by topic successfully", {
        quizId: quizSet.id,
        topic: input.topic,
        questionCount: questions.length,
        chunksUsed: knowledgeChunks.length,
        module: "quiz-service",
      });

      return {
        id: quizSet.id,
        title: quizSet.title,
        questionCount: questions.length,
        durationSeconds: quizSet.durationSeconds,
      };
    } catch (error) {
      await quizRepository.deleteQuizSet(quizSet.id, userId);
      throw error;
    }
  }

  private async generateQuestionsWithAI(
    context: string,
    count: number,
    quizId: string,
  ): Promise<QuizQuestionWithQuizId[]> {
    const prompt = GEMINI_QUIZ_PROMPT
      .replace("{count}", count.toString())
      .replace("{context}", context);

    const text = await generateWithFallback(prompt, { questionCount: count });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AppError("Failed to parse quiz questions from AI response", 500);
    }

    let parsed: GeminiQuizResponse;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new AppError("Invalid JSON in AI response", 500);
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new AppError("AI response missing questions array", 500);
    }

    const questions = parsed.questions;

    return questions.map((q) => ({
      quizId,
      question: q.question,
      type: q.type || "mcq",
      options: q.options || {},
      correctAnswer: (q.correct_answer || q.correctAnswer || "") as string,
      explanation: q.explanation,
    }));
  }

  async startQuiz(userId: string, input: StartQuizInput) {
    const quizSet = await quizRepository.findQuizSetById(input.quizId);
    if (!quizSet) {
      throw new AppError("Quiz not found", 404);
    }

    if (quizSet.userId !== userId) {
      throw new AppError("Unauthorized", 403);
    }

    const questions = await quizRepository.findQuestionsByQuizId(input.quizId);
    if (questions.length === 0) {
      throw new AppError("No questions found for this quiz", 404);
    }

    const attempt = await quizRepository.createAttempt({
      quizId: input.quizId,
      userId,
      totalQuestions: questions.length,
      startedAt: new Date(),
    });

    const expiresAt = new Date(
      attempt.startedAt.getTime() + quizSet.durationSeconds * 1000,
    );

    const questionsWithoutAnswers = questions.map((q) => ({
      id: q.id,
      question: q.question,
      type: q.type,
      options: q.options,
    }));

    return {
      attemptId: attempt.id,
      title: quizSet.title,
      durationSeconds: quizSet.durationSeconds,
      totalQuestions: questions.length,
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      questions: questionsWithoutAnswers,
    };
  }

  async submitQuiz(userId: string, input: SubmitQuizInput) {
    const attempt = await quizRepository.findAttemptById(input.attemptId);
    if (!attempt) {
      throw new AppError("Attempt not found", 404);
    }

    if (attempt.userId !== userId) {
      throw new AppError("Unauthorized", 403);
    }

    if (attempt.completedAt) {
      throw new AppError("Quiz already submitted", 400);
    }

    const quizSet = await quizRepository.findQuizSetById(attempt.quizId);
    if (!quizSet) {
      throw new AppError("Quiz not found", 404);
    }

    const expiresAt = new Date(
      attempt.startedAt.getTime() + quizSet.durationSeconds * 1000,
    );
    const isTimeExpired = Date.now() > expiresAt.getTime();

    const questions = await quizRepository.findQuestionsByQuizId(attempt.quizId);
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let correctCount = 0;
    const answers = input.answers.map((answer) => {
      const question = questionMap.get(answer.questionId);
      const isCorrect = question?.correctAnswer === answer.answer;
      if (isCorrect) correctCount++;

      return {
        attemptId: input.attemptId,
        questionId: answer.questionId,
        selectedAnswer: answer.answer,
        isCorrect,
      };
    });

    await quizRepository.saveAnswers(answers);

    const finalAttempt = await quizRepository.completeAttempt(
      input.attemptId,
      correctCount,
      isTimeExpired,
    );

    return {
      attemptId: finalAttempt.id,
      score: finalAttempt.score,
      correctAnswers: finalAttempt.score,
      totalQuestions: finalAttempt.totalQuestions,
      completedAt: finalAttempt.completedAt?.toISOString() ?? null,
      isTimeExpired: finalAttempt.isTimeExpired,
    };
  }

  async getHistory(userId: string, query: ListQuizHistoryQueryInput) {
    const { data, total } = await quizRepository.getHistoryByUser(userId, {
      page: query.page,
      limit: query.limit,
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      data: data.map((item) => ({
        id: item.id,
        quizTitle: item.quizTitle,
        score: item.score,
        totalQuestions: item.totalQuestions,
        startedAt: item.startedAt.toISOString(),
        completedAt: item.completedAt?.toISOString() ?? null,
        isTimeExpired: item.isTimeExpired,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async listQuizSets(userId: string, query: ListQuizHistoryQueryInput) {
    const { data, total } = await quizRepository.listQuizSetsByUser(userId, {
      page: query.page,
      limit: query.limit,
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    const quizSetsWithCount = await Promise.all(
      data.map(async (quiz) => {
        const questions = await quizRepository.findQuestionsByQuizId(quiz.id);
        return {
          id: quiz.id,
          title: quiz.title,
          sourceType: quiz.sourceType,
          sourceId: quiz.sourceId,
          durationSeconds: quiz.durationSeconds,
          questionCount: questions.length,
          createdAt: quiz.createdAt.toISOString(),
        };
      }),
    );

    return {
      data: quizSetsWithCount,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async deleteQuizSet(quizId: string, userId: string) {
    logger.info("Deleting quiz set", {
      quizId,
      userId,
      module: "quiz-service",
    });

    const quizSet = await quizRepository.findQuizSetById(quizId);
    if (!quizSet) {
      throw new AppError("Quiz not found", 404);
    }

    if (quizSet.userId !== userId) {
      throw new AppError("Unauthorized", 403);
    }

    await quizRepository.deleteQuizSet(quizId, userId);

    logger.info("Quiz set deleted successfully", {
      quizId,
      userId,
      module: "quiz-service",
    });
  }
}

export const quizService = new QuizService();
