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
  createSession: () => api.post('/chat/sessions'),
  getSession: (id: number) => api.get(`/chat/sessions/${id}`),
  deleteSession: (id: number) => api.delete(`/chat/sessions/${id}`),
  sendMessage: (data: any) => api.post('/chat/message', data),
}

export const quizAPI = {
  list: () => api.get('/quiz'),
  get: (id: number) => api.get(`/quiz/${id}`),
  generate: (data: any) => api.post('/quiz/generate', data),
  delete: (id: number) => api.delete(`/quiz/${id}`),
  submitAttempt: (id: number, data: any) => api.post(`/quiz/${id}/attempt`, data),
  getAttempts: (id: number) => api.get(`/quiz/${id}/attempts`),
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

export default api

