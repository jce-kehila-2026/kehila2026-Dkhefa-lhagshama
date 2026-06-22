import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import translations from '../data/translations'

// ── Type surface (moved inline from the former LanguageContext.d.ts) ──
// A .d.ts cannot coexist with this .tsx, so the declarations live here and
// are re-exported so existing `import type { ... }` consumers keep working.
export type Lang = 'he' | 'en'

/** Text direction for a language. */
export type Dir = 'rtl' | 'ltr'

/** A selectable interface language. */
export interface LanguageOption {
  code: Lang
  label: string
  dir: Dir
}

/**
 * List-driven language model. Adding a language is an entry here (plus its
 * translation table) — the provider derives dir/RTL/persistence from this list
 * rather than a hardcoded he-branch.
 */
export const LANGUAGES: readonly LanguageOption[] = [
  { code: 'he', label: 'עברית', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
] as const

/** Active-language translation table — shape inferred from data/translations. */
export type Translations = (typeof import('@/data/translations'))['default'][Lang]

export interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  languages: readonly LanguageOption[]
  t: Translations
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const DEFAULT_LANG: Lang = 'he'

/** Look up a language option by code, falling back to the default language. */
function optionFor(code: Lang): LanguageOption {
  return (
    LANGUAGES.find((l) => l.code === code) ??
    LANGUAGES.find((l) => l.code === DEFAULT_LANG)!
  )
}

/** Type guard: is this a known language code? */
function isLang(value: unknown): value is Lang {
  return LANGUAGES.some((l) => l.code === value)
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // SSR-safe: start with the default and adopt the saved preference after mount.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)

  const setLang = useCallback((next: Lang) => setLangState(next), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('pff-lang')
    if (isLang(saved) && saved !== lang) setLangState(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = optionFor(lang)
  const t = translations[lang] || translations[DEFAULT_LANG]
  const isRTL = active.dir === 'rtl'

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('pff-lang', lang)

    document.documentElement.lang = lang
    document.documentElement.dir = active.dir

    if (active.dir === 'rtl') {
      document.body.classList.add('rtl')
      document.body.classList.remove('ltr')
    } else {
      document.body.classList.add('ltr')
      document.body.classList.remove('rtl')
    }

    document.title = lang === 'he'
      ? 'דחיפה להגשמה | Push for Fulfillment'
      : 'Push for Fulfillment | דחיפה להגשמה'
  }, [lang, active.dir])

  return (
    <LanguageContext.Provider
      value={{ lang, setLang, languages: LANGUAGES, t, isRTL }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }
  return ctx
}
