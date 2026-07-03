import { create } from 'zustand'
import api from '../services/api'

export const useSettingsStore = create((set, get) => ({
  currency: 'GTQ',
  loaded: false,

  fetchCurrency: async () => {
    if (get().loaded) return
    try {
      const res = await api.get('/academy/profile')
      const currency = res.data?.data?.currency || 'GTQ'
      set({ currency, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  setCurrency: (currency) => set({ currency }),

  reset: () => set({ currency: 'GTQ', loaded: false }),
}))
