export interface LLMGenerateOptions {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface LLMGenerateResult {
  text: string;
  model: string;
}

export interface LLMSupportedModel {
  name: string;
  provider: "gemini";
  isActive: boolean;
}

export type LLMProvider = "gemini";

// Options for streaming generation (SSE)
export interface LLMStreamOptions {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: Record<string, unknown>;
}

// A single streamed token chunk returned by generateStream
export interface LLMStreamChunk {
  token: string;
  model: string;
}
