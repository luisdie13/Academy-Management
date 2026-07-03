import { create } from 'zustand'
import api from '../services/api'

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  loading: false,

  login: async (email, password) => {
    set({ loading: true })
    try {
      const response = await api.post('/auth/login', { email, password })
      const { user } = response.data.data
      // Token is stored in an HttpOnly cookie set by the server — no localStorage needed.

      const fullName = user.firstName || user.lastName
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
        : user.email

      set({
        user: {
          ...user,
          name: fullName,
          mustChangePassword: user.mustChangePassword || false,
        },
        isAuthenticated: true,
        loading: false,
      })

      return { success: true, user: { ...user, name: fullName } }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || error.message || 'Login error'
      set({ loading: false })
      return { success: false, error: errorMessage }
    }
  },

  setUser: (updatedUser) => {
    set({
      user: updatedUser,
      isAuthenticated: !!updatedUser,
    })
  },

  logout: async () => {
    set({ loading: true })
    try {
      await api.post('/auth/logout') // server clears the HttpOnly cookie
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
      })
    }
  },

  checkAuth: async () => {
    set({ loading: true })
    try {
      const response = await api.get('/auth/profile')
      const { user } = response.data.data
      // Cookie is refreshed by the server on each profile call.

      const fullName = user.firstName || user.lastName
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
        : user.email

      set({
        user: {
          ...user,
          name: fullName,
          mustChangePassword: user.mustChangePassword || false,
        },
        isAuthenticated: true,
        loading: false,
      })

      return { success: true, user }
    } catch (error) {
      if (error.response?.status === 401) {
        set({ user: null, isAuthenticated: false, loading: false })
      } else {
        set({ loading: false })
      }
      return { success: false }
    }
  },
}))
