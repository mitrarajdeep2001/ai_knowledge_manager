export const LLM_CONFIG = {
  defaultProvider: "gemini" as const,

  providers: {
    gemini: {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
      apiKey: process.env.GEMINI_API_KEY || "",
      defaultModel: "gemini-3.1-pro-preview",
      models: [
        { name: "gemini-3.1-pro-preview", isActive: true },
        { name: "gemini-3-flash-preview", isActive: true },
        { name: "gemini-3.1-flash-lite-preview", isActive: true },
        { name: "gemini-2.5-flash", isActive: true },
        { name: "gemini-2.5-flash-lite", isActive: true },
      ],
      maxRetriesPerModel: 2,
    },
  },
};

export type GeminiModel = "gemini-3.1-pro-preview" | "gemini-3-flash-preview" | "gemini-3.1-flash-lite-preview" | "gemini-2.5-flash" | "gemini-2.5-flash-lite";