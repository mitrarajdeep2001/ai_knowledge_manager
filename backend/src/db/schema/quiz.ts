import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const sourceTypeEnum = pgEnum("source_type", ["note", "document"]);

export const quizSets = pgTable(
  "quiz_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id"),
    durationSeconds: integer("duration_seconds").notNull().default(300),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("quiz_sets_user_id_idx").on(table.userId),
    sourceIdx: index("quiz_sets_source_idx").on(table.sourceType, table.sourceId),
  }),
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizSets.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    type: text("type").notNull(),
    options: jsonb("options").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    explanation: text("explanation"),
  },
  (table) => ({
    quizIdIdx: index("quiz_questions_quiz_id_idx").on(table.quizId),
  }),
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizSets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: integer("score").notNull().default(0),
    totalQuestions: integer("total_questions").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    isTimeExpired: boolean("is_time_expired").notNull().default(false),
  },
  (table) => ({
    quizIdIdx: index("quiz_attempts_quiz_id_idx").on(table.quizId),
    userIdIdx: index("quiz_attempts_user_id_idx").on(table.userId),
  }),
);

export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    selectedAnswer: text("selected_answer"),
    isCorrect: boolean("is_correct").notNull().default(false),
  },
  (table) => ({
    attemptIdIdx: index("quiz_answers_attempt_id_idx").on(table.attemptId),
    questionIdIdx: index("quiz_answers_question_id_idx").on(table.questionId),
  }),
);

export type QuizSet = typeof quizSets.$inferSelect;
export type NewQuizSet = typeof quizSets.$inferInsert;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type NewQuizQuestion = typeof quizQuestions.$inferInsert;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
export type QuizAnswer = typeof quizAnswers.$inferSelect;
export type NewQuizAnswer = typeof quizAnswers.$inferInsert;
