import { logger } from "../../../utils/logger";
import { LLM_CONFIG } from "./llm.config";
import type { LLMGenerateOptions, LLMGenerateResult, LLMStreamOptions } from "./llm.types";
import type { GeminiModel } from "./llm.config";

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const isTransientStatus = (status: number): boolean => {
  return status === 429 || (status >= 500 && status < 600);
};

const isUnsupportedModel = (status: number): boolean => {
  return status === 404;
};

export class LLMService {
  private readonly provider = LLM_CONFIG.providers.gemini;

  async generateText(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const apiKey = this.provider.apiKey;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const models = this.provider.models.filter((m) => m.isActive);
    let lastError: Error | null = null;

    for (const model of models) {
      const modelName = model.name as GeminiModel;
      logger.info("Attempting LLM generation", {
        module: "llm-service",
        model: modelName,
        ...options.metadata,
      });

      for (
        let attempt = 1;
        attempt <= this.provider.maxRetriesPerModel;
        attempt++
      ) {
        try {
          const response = await fetch(
            `${this.provider.baseUrl}/${modelName}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: options.prompt }] }],
                generationConfig: {
                  temperature: options.temperature ?? 0.7,
                  maxOutputTokens: options.maxOutputTokens ?? 4000,
                },
              }),
            },
          );

          if (response.status === 429) {
            logger.warn("LLM quota exceeded, switching model", {
              module: "llm-service",
              model: modelName,
              attempt,
              ...options.metadata,
            });
            break;
          }

          if (isUnsupportedModel(response.status)) {
            logger.warn("LLM model not supported", {
              module: "llm-service",
              model: modelName,
              ...options.metadata,
            });
            break;
          }

          if (!response.ok) {
            const errorBody = await response.text();

            if (isTransientStatus(response.status)) {
              logger.warn("LLM transient error, retrying", {
                module: "llm-service",
                model: modelName,
                attempt,
                status: response.status,
                ...options.metadata,
              });
              continue;
            }

            logger.warn("LLM API error, skipping model", {
              module: "llm-service",
              model: modelName,
              status: response.status,
              error: errorBody,
              ...options.metadata,
            });
            break;
          }

          const data = (await response.json()) as {
            candidates?: {
              content?: {
                parts?: { text?: string }[];
              };
            }[];
          };

          const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (!text) {
            throw new Error("Empty response from LLM");
          }

          logger.info("LLM generation successful", {
            module: "llm-service",
            model: modelName,
            ...options.metadata,
          });

          return {
            text,
            model: modelName,
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.warn("LLM generation attempt failed", {
            module: "llm-service",
            model: modelName,
            attempt,
            error: lastError.message,
            ...options.metadata,
          });
        }
      }
    }

    logger.error("LLM generation failed after trying all models", {
      module: "llm-service",
      ...options.metadata,
      err: lastError,
    });

    throw new Error("Failed to generate text. Please try again later.");
  }

  async generateStructured<T>(
    prompt: string,
    schema: unknown,
    options?: Omit<LLMGenerateOptions, "prompt">,
  ): Promise<T & { _model: string }> {
    const result = await this.generateText({
      prompt,
      ...options,
    });

    try {
      const parsed = JSON.parse(result.text) as T;
      return { ...parsed, _model: result.model };
    } catch (error) {
      logger.error("Failed to parse LLM response as JSON", {
        module: "llm-service",
        model: result.model,
        error: error instanceof Error ? error.message : String(error),
        ...options?.metadata,
      });
      throw new Error("Failed to parse LLM response as JSON");
    }
  }

  /**
   * Streams a Gemini response token-by-token using the streamGenerateContent endpoint.
   * Yields each text fragment as it arrives. Falls back through active models on quota errors.
   */
  async *generateStream(options: LLMStreamOptions): AsyncGenerator<string> {
    const apiKey = this.provider.apiKey;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const models = this.provider.models.filter((m) => m.isActive);
    let lastError: Error | null = null;

    for (const model of models) {
      const modelName = model.name as GeminiModel;

      logger.info("Attempting LLM stream generation", {
        module: "llm-service",
        model: modelName,
        ...options.metadata,
      });

      try {
        const response = await fetch(
          `${this.provider.baseUrl}/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: options.prompt }] }],
              generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxOutputTokens ?? 4000,
              },
            }),
          },
        );

        // On quota exceeded, try the next model
        if (response.status === 429) {
          logger.warn("LLM stream quota exceeded, switching model", {
            module: "llm-service",
            model: modelName,
            ...options.metadata,
          });
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          logger.warn("LLM stream API error, skipping model", {
            module: "llm-service",
            model: modelName,
            status: response.status,
            error: errorBody,
            ...options.metadata,
          });
          continue;
        }

        if (!response.body) {
          throw new Error("No response body for stream");
        }

        // Read the SSE stream line-by-line and yield text tokens
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            // SSE lines are prefixed with "data: "
            if (!trimmed.startsWith("data:")) continue;

            const jsonStr = trimmed.slice("data:".length).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonStr) as {
                candidates?: {
                  content?: {
                    parts?: { text?: string }[];
                  };
                }[];
              };

              const token = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (token) {
                yield token;
              }
            } catch {
              // Skip malformed JSON lines from the stream
            }
          }
        }

        logger.info("LLM stream completed", {
          module: "llm-service",
          model: modelName,
          ...options.metadata,
        });

        // Stream finished successfully — no need to try other models
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn("LLM stream attempt failed", {
          module: "llm-service",
          model: modelName,
          error: lastError.message,
          ...options.metadata,
        });
      }
    }

    logger.error("LLM stream failed after trying all models", {
      module: "llm-service",
      ...options.metadata,
      err: lastError,
    });

    throw new Error("Failed to stream response. Please try again later.");
  }
}

export const llmService = new LLMService();
