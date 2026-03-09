import { create } from 'zustand'
import { authAPI, type AuthUser } from '../services/api'

interface RegisterInput {
  email: string
  username: string
  fullname: string
  password: string
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isHydrated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  hydrate: () => Promise<void>
  hasPermission: (permission?: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const res = await authAPI.login({ email, password })
      const { user } = res.data

      set({
        user,
        isAuthenticated: true,
        isHydrated: true,
        isLoading: false,
      })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  register: async (data) => {
    set({ isLoading: true })
    try {
      const res = await authAPI.register(data)
      const { user } = res.data

      set({
        user,
        isAuthenticated: true,
        isHydrated: true,
        isLoading: false,
      })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: async () => {
    try {
      await authAPI.logout()
    } catch {
      // Always clear client auth state, even if the API call fails.
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isHydrated: true,
      })
    }
  },

  hydrate: async () => {
    try {
      const res = await authAPI.me()
      const user: AuthUser = {
        id: res.data.id,
        email: res.data.email,
        username: res.data.username,
        fullname: res.data.fullname,
      }

      set({
        user,
        isAuthenticated: true,
        isHydrated: true,
      })
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isHydrated: true,
      })
    }
  },

  hasPermission: (permission) => {
    if (!permission) {
      return get().isAuthenticated
    }

    const user = get().user
    if (!user) {
      return false
    }

    if (Array.isArray(user.permissions) && user.permissions.length > 0) {
      return user.permissions.includes(permission)
    }

    if (user.role === 'admin') {
      return true
    }

    return get().isAuthenticated
  },
}))

