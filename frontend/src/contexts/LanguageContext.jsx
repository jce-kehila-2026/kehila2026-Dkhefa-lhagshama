import { createContext, useContext, useState, useEffect } from 'react'
import translations from '../data/translations'

const LanguageContext = createContext(null)

const DEFAULT_LANG = 'he'

export function LanguageProvider({ children }) {
  // SSR-safe: start with the default and adopt the saved preference after mount.
  const [lang, setLang] = useState(DEFAULT_LANG)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('pff-lang')
    if (saved && saved !== lang) setLang(saved)
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const t = translations[lang] || translations[DEFAULT_LANG]

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('pff-lang', lang)

    document.documentElement.lang = lang
    document.documentElement.dir = t.dir

    if (t.dir === 'rtl') {
      document.body.classList.add('rtl')
      document.body.classList.remove('ltr')
    } else {
      document.body.classList.add('ltr')
      document.body.classList.remove('rtl')
    }

    document.title = lang === 'he'
      ? 'דחיפה להגשמה | Push for Fulfillment'
      : 'Push for Fulfillment | דחיפה להגשמה'
  }, [lang, t])

  const toggleLang = () => setLang(prev => (prev === 'he' ? 'en' : 'he'))
  const isRTL = t.dir === 'rtl'

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, isRTL, hydrated }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }
  return ctx
}
