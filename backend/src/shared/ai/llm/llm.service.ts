import { logger } from "../../../utils/logger";
import { LLM_CONFIG } from "./llm.config";
import type { LLMGenerateOptions, LLMGenerateResult } from "./llm.types";
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
}

export const llmService = new LLMService();
