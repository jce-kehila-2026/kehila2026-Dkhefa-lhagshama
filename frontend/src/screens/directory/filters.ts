/*
 * Client-side filtering for the public directory screen (UC-02 answers + UC-03
 * businesses). Pure functions: the directory page fetches the full approved
 * list once, then re-derives the visible rows here as the user types category /
 * region / audience / free-text filters. No network, no mutation of the input.
 *
 * All record text is bilingual (he/en); callers pass the language picker `L`
 * (Bilingual -> active-language string) and `L_arr` (Bilingual -> string[]) so
 * matching always runs against whatever language is currently active.
 */
import type { Bilingual, DirRecord } from './constants'

// language pickers supplied by the caller's LanguageContext
type L = (v: Bilingual) => string
type LArr = (v: Bilingual) => string[]

// narrow the businesses list by category + free-text search (name/desc/city/tags)
export function filterBusinesses(
  businesses: DirRecord[],
  bizCat: string,
  bizSearch: string,
  L: L,
  L_arr: LArr,
): DirRecord[] {
  // GET /api/businesses already returns only status==='approved' businesses,
  // so we don't re-filter on the legacy `approved` boolean — admin-approved
  // submissions set status but not that boolean, and would wrongly drop out.
  let data = businesses
  if (bizCat !== 'all') data = data.filter(b => b.category === bizCat)
  if (bizSearch.trim()) {
    const q = bizSearch.trim().toLowerCase()
    data = data.filter(b =>
      L(b.name).toLowerCase().includes(q) ||
      L(b.description).toLowerCase().includes(q) ||
      L(b.city).toLowerCase().includes(q) ||
      L_arr(b.tags).some(tag => String(tag).toLowerCase().includes(q))
    )
  }
  return data
}

// narrow the answers list by category + region + audience + free-text search
export function filterAnswers(
  answers: DirRecord[],
  answerCategory: string,
  answerRegion: string,
  answerAudience: string,
  answerSearch: string,
  L: L,
): DirRecord[] {
  let filtered = answers
  if (answerCategory !== 'all') filtered = filtered.filter((item) => item.category === answerCategory)
  // region/audience are bilingual objects — filter against the active-language
  // value (the API no longer filters these server-side).
  if (answerRegion.trim()) {
    const q = answerRegion.toLowerCase()
    filtered = filtered.filter((item) => L(item.region).toLowerCase().includes(q))
  }
  if (answerAudience.trim()) {
    const q = answerAudience.toLowerCase()
    filtered = filtered.filter((item) => L(item.audience).toLowerCase().includes(q))
  }
  if (answerSearch.trim()) {
    const q = answerSearch.toLowerCase()
    filtered = filtered.filter((item) =>
      L(item.title).toLowerCase().includes(q) ||
      L(item.body).toLowerCase().includes(q) ||
      L(item.region).toLowerCase().includes(q) ||
      L(item.audience).toLowerCase().includes(q)
    )
  }
  return filtered
}
