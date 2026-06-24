/*
 * bilingual.ts — resolve HE/EN content fields down to a single display string.
 * Firestore documents store some user-facing fields either as a plain string (legacy/single-language
 * data) or as a { he, en } object (the bilingual shape). These helpers take whichever form is stored
 * plus the active UI language and return the value to render, so callers never branch on the shape.
 * Used across screens that show NGO/business/answer content; pairs with LanguageContext's current lang.
 * Invariant: never throws on bad/empty input — always returns a usable '' (or [] for arrays) fallback,
 * and falls back across languages (preferred lang, then he, then en) so a partially-translated doc
 * still shows something rather than blank.
 */
export type Bilingual = string | { he?: string; en?: string } | null | undefined
export type BilingualArray = string[] | { he?: string[]; en?: string[] } | null | undefined

export function pickLang(value: Bilingual, lang: string): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  // Prefer the active language; fall back he -> en -> '' so a half-translated doc still renders.
  return (lang === 'he' ? value.he : value.en) || value.he || value.en || ''
}

export function pickLangArray(value: BilingualArray, lang: string): string[] {
  // Array-of-strings version of pickLang (e.g. tag/feature lists): same lang-preference fallback.
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    const arr = (lang === 'he' ? value.he : value.en) || value.he || value.en
    return Array.isArray(arr) ? arr : []
  }
  return []
}
