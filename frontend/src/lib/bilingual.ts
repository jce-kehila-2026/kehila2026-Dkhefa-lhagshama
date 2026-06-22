export type Bilingual = string | { he?: string; en?: string } | null | undefined
export type BilingualArray = string[] | { he?: string[]; en?: string[] } | null | undefined

export function pickLang(value: Bilingual, lang: string): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return (lang === 'he' ? value.he : value.en) || value.he || value.en || ''
}

export function pickLangArray(value: BilingualArray, lang: string): string[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    const arr = (lang === 'he' ? value.he : value.en) || value.he || value.en
    return Array.isArray(arr) ? arr : []
  }
  return []
}
