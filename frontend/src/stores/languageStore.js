import { create } from 'zustand'
import en from '../i18n/en.js'
import es from '../i18n/es.js'

const TRANSLATIONS = { en, es }

const getStored = () => {
  try { return localStorage.getItem('lang') || 'es' } catch { return 'es' }
}

export const useLanguageStore = create((set, get) => ({
  lang: getStored(),

  setLang: (lang) => {
    try { localStorage.setItem('lang', lang) } catch {}
    set({ lang })
  },

  t: (key, vars = {}) => {
    const dict = TRANSLATIONS[get().lang] || TRANSLATIONS.es
    const text = key.split('.').reduce((obj, k) => obj?.[k], dict) ?? key
    if (!vars || Object.keys(vars).length === 0) return text
    return String(text).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
  },
}))
