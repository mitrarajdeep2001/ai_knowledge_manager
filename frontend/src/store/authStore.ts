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
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isHydrated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterInput) => Promise<void>
  logout: () => void
  hydrate: () => Promise<void>
  hasPermission: (permission?: string) => boolean
}

const loadStoredUser = (): AuthUser | null => {
  const raw = localStorage.getItem('pkm_user')
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    localStorage.removeItem('pkm_user')
    return null
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: loadStoredUser(),
  token: localStorage.getItem('pkm_token'),
  isAuthenticated: !!localStorage.getItem('pkm_token'),
  isLoading: false,
  isHydrated: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const res = await authAPI.login({ email, password })
      const { token, user } = res.data

      localStorage.setItem('pkm_token', token)
      localStorage.setItem('pkm_user', JSON.stringify(user))

      set({
        token,
        user,
        isAuthenticated: true,
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
      const { token, user } = res.data

      localStorage.setItem('pkm_token', token)
      localStorage.setItem('pkm_user', JSON.stringify(user))

      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('pkm_token')
    localStorage.removeItem('pkm_user')
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: true,
    })
  },

  hydrate: async () => {
    const token = localStorage.getItem('pkm_token')
    const localUser = loadStoredUser()

    if (!token) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isHydrated: true,
      })
      return
    }

    set({ token, user: localUser, isAuthenticated: true })

    try {
      const res = await authAPI.me()
      const mergedUser: AuthUser = {
        ...(localUser ?? {}),
        id: res.data.id,
        email: res.data.email,
      }

      localStorage.setItem('pkm_user', JSON.stringify(mergedUser))

      set({
        user: mergedUser,
        isAuthenticated: true,
        isHydrated: true,
      })
    } catch {
      localStorage.removeItem('pkm_token')
      localStorage.removeItem('pkm_user')
      set({
        user: null,
        token: null,
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
