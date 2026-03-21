import { dashboardRepository } from "./dashboard.repository";
import type { DashboardResponse } from "./dashboard.schema";

const DEFAULT_EMBEDDING_MODEL = "multilingual-e5-large";
const DEFAULT_EMBEDDING_DIMENSION = 1024;

export class DashboardService {
  async getDashboard(userId: string): Promise<DashboardResponse> {
    const [
      notesCount,
      documentsCount,
      quizzesCount,
      chatSessionsCount,
      embeddingsCount,
      recentActivity,
    ] = await Promise.all([
      dashboardRepository.countNotes(userId),
      dashboardRepository.countDocuments(userId),
      dashboardRepository.countQuizzes(userId),
      dashboardRepository.countChatSessions(userId),
      dashboardRepository.countEmbeddings(userId),
      dashboardRepository.getRecentActivity(userId),
    ]);

    const embeddingModel =
      process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
    const dimension =
      parseInt(process.env.EMBEDDING_DIMENSION ?? "", 10) ||
      DEFAULT_EMBEDDING_DIMENSION;

    return {
      stats: {
        notes: notesCount,
        documents: documentsCount,
        quizzes: quizzesCount,
        chatSessions: chatSessionsCount,
      },
      knowledgeBase: {
        embeddingsCount,
        embeddingModel,
        dimension,
        status: embeddingsCount === 0 ? "empty" : "online",
      },
      recentActivity,
    };
  }
}

export const dashboardService = new DashboardService();
