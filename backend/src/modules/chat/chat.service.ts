import type { FastifyReply } from "fastify";
import { logger } from "../../utils/logger";
import { AppError } from "../../utils/AppError";
import { embeddingsService } from "../../shared/ai/embeddings/embeddings.service";
import { llmService } from "../../shared/ai/llm/llm.service";
import { chatRepository } from "./chat.repository";
import type { ChatRequest } from "./chat.schema";

// Fallback message sent when no relevant chunks are found in the selected scope
const NO_CONTEXT_MESSAGE =
  "I don't have enough information in the selected knowledge to answer this.";

/**
 * Builds the system prompt for the LLM, injecting retrieved context chunks
 * and the recent conversation history.
 */
function buildPrompt(params: {
  userMessage: string;
  chunks: { content: string; sourceType: string }[];
  history: { role: string; content: string }[];
}): string {
  const { userMessage, chunks, history } = params;

  // Format the retrieved context for the prompt
  const contextBlock =
    chunks.length > 0
      ? chunks.map((c, i) => `[${i + 1}] (${c.sourceType}): ${c.content}`).join("\n\n")
      : "No relevant context found.";

  // Format the recent conversation history
  const historyBlock =
    history.length > 0
      ? history
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n")
      : "No previous conversation.";

  return `You are an AI assistant that answers strictly from the provided context.

Rules:
- Do NOT hallucinate or make up information.
- If the answer is not found in the context, reply exactly: "I don't know based on the provided knowledge."
- Respect the scope restriction — only use the context provided below.
- Be concise and accurate.

--- CONTEXT START ---
${contextBlock}
--- CONTEXT END ---

--- CONVERSATION HISTORY ---
${historyBlock}
--- HISTORY END ---

User: ${userMessage}
Assistant:`;
}

export class ChatService {
  /**
   * Main entry point — runs the full scoped RAG pipeline and streams the
   * response back to the client via SSE.
   */
  async streamChat(
    userId: string,
    body: ChatRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const { message, sessionId, scope } = body;

    logger.info("Chat stream started", {
      module: "chat-service",
      userId,
      scopeType: scope.type,
      sessionId: sessionId ?? "new",
    });

    // ── 1. Resolve or create the session ────────────────────────────────────
    let session;
    if (sessionId) {
      session = await chatRepository.findSession(sessionId, userId);
      if (!session) {
        throw new AppError("Chat session not found", 404);
      }
    } else {
      session = await chatRepository.createSession(userId);
    }

    // ── 2. Generate query embedding ──────────────────────────────────────────
    const [queryEmbedding] = await embeddingsService.generateEmbeddings([message]);
    if (!queryEmbedding) {
      throw new AppError("Failed to generate query embedding", 500);
    }

    // ── 3. Retrieve relevant chunks with scope filter ────────────────────────
    const SIMILARITY_THRESHOLD = 0.65;
    const CHUNK_LIMIT = 5;

    const chunks = await chatRepository.retrieveChunks(
      userId,
      queryEmbedding,
      scope,
      CHUNK_LIMIT,
      SIMILARITY_THRESHOLD,
    );

    logger.info("Chunks retrieved for chat", {
      module: "chat-service",
      userId,
      scopeType: scope.type,
      chunksFound: chunks.length,
      sessionId: session.id,
    });

    // ── 4. If no relevant chunks found → stream the fallback message ─────────
    if (chunks.length === 0) {
      logger.warn("No relevant chunks found for query", {
        module: "chat-service",
        userId,
        scopeType: scope.type,
        sessionId: session.id,
      });

      // Save the user's message
      await chatRepository.saveMessage({
        sessionId: session.id,
        userId,
        role: "user",
        content: message,
      });

      // Save the fallback response as assistant message
      await chatRepository.saveMessage({
        sessionId: session.id,
        userId,
        role: "assistant",
        content: NO_CONTEXT_MESSAGE,
      });

      // Stream the fallback as a single SSE event
      reply.raw.write(`data: ${JSON.stringify({ token: NO_CONTEXT_MESSAGE })}\n\n`);
      reply.raw.write(`data: ${JSON.stringify({ sessionId: session.id })}\n\n`);
      reply.raw.write("data: [DONE]\n\n");
      return;
    }

    // ── 5. Load recent conversation history (last 5 messages) ─────────────
    const history = await chatRepository.getRecentMessages(session.id, 5);

    // ── 6. Build the LLM prompt ───────────────────────────────────────────
    const prompt = buildPrompt({
      userMessage: message,
      chunks,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    });

    // ── 7. Save the user message before streaming starts ─────────────────
    await chatRepository.saveMessage({
      sessionId: session.id,
      userId,
      role: "user",
      content: message,
    });

    // ── 8. Stream the LLM response via SSE ───────────────────────────────
    let fullResponse = "";

    try {
      const stream = llmService.generateStream({
        prompt,
        temperature: 0.5, // Lower temperature for more factual RAG responses
        metadata: {
          module: "chat-service",
          userId,
          scopeType: scope.type,
          sessionId: session.id,
        },
      });

      for await (const token of stream) {
        fullResponse += token;
        // Send each token as an SSE event
        reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
      }

      // Send the session ID so the client can continue the conversation
      reply.raw.write(`data: ${JSON.stringify({ sessionId: session.id })}\n\n`);
      reply.raw.write("data: [DONE]\n\n");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error("LLM stream error during chat", {
        module: "chat-service",
        userId,
        sessionId: session.id,
        err,
      });

      // If streaming started, write an error event and close
      reply.raw.write(`data: ${JSON.stringify({ error: "Stream failed. Please try again." })}\n\n`);
      reply.raw.write("data: [DONE]\n\n");

      // Still save whatever was streamed before the error
    }

    // ── 9. Save the assistant's full response ─────────────────────────────
    if (fullResponse) {
      await chatRepository.saveMessage({
        sessionId: session.id,
        userId,
        role: "assistant",
        content: fullResponse,
      });
    }

    logger.info("Chat stream completed", {
      module: "chat-service",
      userId,
      scopeType: scope.type,
      chunksUsed: chunks.length,
      sessionId: session.id,
    });
  }

  /**
   * Returns all messages for a given session (for UI to load history).
   */
  async getSessionMessages(userId: string, sessionId: string) {
    const session = await chatRepository.findSession(sessionId, userId);
    if (!session) {
      throw new AppError("Chat session not found", 404);
    }

    return chatRepository.getRecentMessages(sessionId, 50);
  }

  /**
   * Returns all sessions for a user, ordered by recently updated.
   */
  async getUserSessions(userId: string) {
    return chatRepository.getUserSessions(userId);
  }
}

export const chatService = new ChatService();
