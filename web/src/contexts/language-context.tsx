import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createT, type Language, SUPPORTED_LANGUAGES, STORAGE_KEY } from '@/lib/translations'
import { api } from '@/lib/api'

interface LanguageContextValue {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function detectLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED_LANGUAGES.includes(stored as Language)) {
    return stored as Language
  }
  const browser = navigator?.language?.split('-')[0]?.toLowerCase()
  if (browser && SUPPORTED_LANGUAGES.includes(browser as Language)) {
    return browser as Language
  }
  return 'en'
}

function updateUserLanguage(language: Language) {
  return api.patch('/users/profile/', { language })
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to 'en' to avoid SSR/hydration mismatch; useEffect sets real value
  const [lang, setLangState] = useState<Language>('en')

  useEffect(() => {
    setLangState(detectLanguage())
  }, [])

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang)
    localStorage.setItem(STORAGE_KEY, newLang)
    // Sync to backend if authenticated — fail silently if not
    updateUserLanguage(newLang).catch(() => {})
  }, [])

  // Sync from backend profile on app load (backend wins on conflict)
  useEffect(() => {
    api
      .get<{ language?: Language }>('/users/profile/')
      .then((profile) => {
        if (profile?.language && SUPPORTED_LANGUAGES.includes(profile.language)) {
          setLangState(profile.language)
          localStorage.setItem(STORAGE_KEY, profile.language)
        }
      })
      .catch(() => {
        // Not authenticated or endpoint unavailable — use localStorage value
      })
  }, [])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: createT(lang) }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
