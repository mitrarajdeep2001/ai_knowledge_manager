import axios from 'axios'

export interface AuthUser {
  id: string
  email: string
  username?: string
  fullname?: string
  role?: string
  permissions?: string[]
}

export interface AuthResponse {
  user: AuthUser
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  register: (data: {
    email: string
    username: string
    fullname: string
    password: string
  }) => api.post<AuthResponse>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data),
  logout: () => api.post<{ success: boolean }>('/auth/logout'),
  me: () => api.get<Pick<AuthUser, 'id' | 'email' | 'username' | 'fullname'>>('/auth/me'),
}

export const notesAPI = {
  list: (params?: any) => api.get('/notes', { params }),
  get: (id: string) => api.get(`/notes/${id}`),
  create: (data: any) => api.post('/notes', data),
  update: (id: string, data: any) => api.put(`/notes/${id}`, data),
  delete: (id: string) => api.delete(`/notes/${id}`),
  summarize: (id: string, style?: string) =>
    api.post(`/notes/${id}/summarize`, null, { params: { style } }),
  generateTags: (id: string) => api.post(`/notes/${id}/generate-tags`),
  reembed: (id: string) => api.post(`/notes/${id}/reembed`),
}

export const tagsAPI = {
  list: () => api.get<{ tags: string[] }>('/tags'),
}

export const documentsAPI = {
  list: () => api.get('/documents'),
  get: (id: string) => api.get(`/documents/${id}`),
  status: (id: string) => api.get(`/documents/${id}/status`),
  view: (id: string) => api.get(`/documents/${id}/view`, { responseType: 'blob' }),
  download: (id: string) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  upload: (formData: FormData) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: string) => api.delete(`/documents/${id}`),
}

export const chatAPI = {
  listSessions: () => api.get('/chat/sessions'),
  getSessionMessages: (id: string) => api.get(`/chat/sessions/${id}/messages`),
  
  /**
   * Scoped RAG SSE streaming endpoint wrapper.
   */
  streamMessage: async (
    params: { message: string; sessionId?: string; scope: any },
    handlers: {
      onToken: (token: string) => void;
      onSessionId: (sessionId: string) => void;
      onError: (err: string) => void;
      onDone: () => void;
    },
    signal?: AbortSignal
  ) => {
    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(params),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("text/event-stream")) {
        throw new Error("Invalid response type (expected SSE)");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // SSE events are separated by double newlines
        const events = buffer.split("\n\n");

        // The last element is either incomplete or empty, keep it in the buffer
        buffer = events.pop() ?? "";

        for (const event of events) {
          const trimmed = event.trim();
          if (!trimmed.startsWith("data:")) continue;

          // Extract the JSON string following "data:"
          const jsonStr = trimmed.slice("data:".length).trim();
          if (!jsonStr) continue;

          if (jsonStr === "[DONE]") {
             handlers.onDone();
             return;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.token) {
              handlers.onToken(parsed.token);
            } else if (parsed.sessionId) {
              handlers.onSessionId(parsed.sessionId);
            } else if (parsed.error) {
              handlers.onError(parsed.error);
            }
          } catch (err) {
            // Ignore malformed JSON chunks
          }
        }
      }
      
      handlers.onDone();
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Chat stream aborted");
        return;
      }
      handlers.onError(error.message || "Failed to stream message");
      handlers.onDone();
    }
  },
}

export const quizAPI = {
  list: (params?: { page?: number; limit?: number }) => api.get('/quiz', { params }),
  listHistory: (params?: { page?: number; limit?: number }) => api.get('/quiz/history', { params }),
  generate: (data: {
    sourceType: 'note' | 'document';
    sourceId: string;
    title: string;
    questionCount?: number;
    durationSeconds?: number;
  }) => api.post('/quiz/generate', data),
  generateByTopic: (data: {
    topic: string;
    questionCount?: number;
  }) => api.post('/quiz/generate-by-topic', data),
  start: (quizId: string) => api.post('/quiz/start', { quizId }),
  submit: (data: {
    attemptId: string;
    answers: { questionId: string; answer: string }[];
  }) => api.post('/quiz/submit', data),
  delete: (id: string) => api.delete(`/quiz/${id}`),
}

export interface SearchResult {
  sourceType: string
  sourceId: string
  content: string
  similarity: number
}

export interface SearchResponse {
  results: SearchResult[]
  pagination: {
    page: number
    limit: number
  }
}

export const searchAPI = {
  search: (params: { q: string; limit?: number; page?: number }) =>
    api.get<SearchResponse>('/search', { params }),
}

export const statsAPI = {
  get: () => api.get('/stats'),
}

export interface DashboardStats {
  notes: number
  documents: number
  quizzes: number
  chatSessions: number
}

export interface DashboardKnowledgeBase {
  embeddingsCount: number
  embeddingModel: string
  dimension: number
  status: 'online' | 'empty'
}

export interface DashboardActivityItem {
  id: string
  type: 'note' | 'document' | 'quiz' | 'chat'
  title: string
  createdAt: string
}

export interface DashboardData {
  stats: DashboardStats
  knowledgeBase: DashboardKnowledgeBase
  recentActivity: DashboardActivityItem[]
}

export const dashboardAPI = {
  get: () => api.get<DashboardData>('/dashboard'),
}

export default api

