import type { Bilingual, DirRecord } from './constants'

type L = (v: Bilingual) => string
type LArr = (v: Bilingual) => string[]

// ── FILTER BUSINESSES ─────────────────────────────────────
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
    const q = bizSearch.toLowerCase()
    data = data.filter(b =>
      L(b.name).toLowerCase().includes(q) ||
      L(b.description).toLowerCase().includes(q) ||
      L(b.city).toLowerCase().includes(q) ||
      L_arr(b.tags).some(tag => String(tag).toLowerCase().includes(q))
    )
  }
  return data
}

// ── FILTER ANSWERS ──────────────────────────────────────────
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
