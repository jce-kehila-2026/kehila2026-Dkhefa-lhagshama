/**
 * useCities — client hook over the public GET /api/cities locality table.
 *
 * Every city field in the app picks from this one list instead of accepting
 * free text, so a locality is stored as a stable CBS code (`code`) rather than
 * a name someone typed. Two spellings of the same place used to be two
 * different places to any string comparison — which is what silently disabled
 * the volunteer matcher's same-city signal.
 *
 * Same shape as useCategories: the fetch is memoized at module level so any
 * number of mounted pickers share ONE network call per page load, and it is
 * SSR-safe because the fetch only runs inside useEffect.
 */
import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
import type { City, Lang } from '@/types'

let cache: City[] | null = null
let inflight: Promise<City[]> | null = null

function load(): Promise<City[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = apiJson<{ items?: City[] }>('/api/cities')
      .then((data) => {
        cache = Array.isArray(data.items) ? data.items : []
        return cache
      })
      .catch(() => {
        // Fail soft: the picker shows its "could not load" state and stays
        // typable-but-unselectable. The failure is NOT cached, so the next
        // mounting consumer retries.
        return []
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/**
 * Fold a name for comparison: lowercase, drop the punctuation that varies
 * between spellings, collapse whitespace. Mirrors CitySelect's search folding
 * so "בני-ברק", "בני ברק" and "BENE BERAQ" all reconcile to one locality.
 */
function fold(value: string): string {
  return value
    .toLocaleLowerCase('he')
    // Apostrophes and geresh vanish INSIDE a word, so "Be'er Sheva" and the
    // apostrophe-less "beer sheva" people actually type fold alike.
    .replace(/['"׳״]/g, '')
    // Separators become a SPACE rather than nothing, so a hyphenated spelling
    // still reads as two words: "בני-ברק" -> "בני ברק", not "בניברק".
    .replace(/[-()./\\,]/g, ' ')
    // Hebrew ktiv male/haser: people write "קריית גת", the official table has
    // "קרית גת". Collapsing a double yod reconciles the two spellings.
    .replace(/יי/g, 'י')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface UseCitiesResult {
  /** Every locality, Hebrew-name sorted by the API. */
  cities: City[]
  loading: boolean
  /** Resolve a stored city code to its display name in the active language. */
  labelFor: (code: string | null | undefined, lang?: Lang) => string
  /**
   * Best-effort reverse lookup for records written before the picker existed,
   * which stored a free-text name and no code. Returns '' when the name does
   * not correspond to an official locality (a typo, or a place off the list),
   * so callers can tell "resolved" from "leave it alone".
   */
  codeForName: (name: string | null | undefined) => string
}

// Consumer hook: seeds state from the module cache so a warm cache renders
// synchronously (no loading flash) and an empty cache shows loading.
export function useCities(): UseCitiesResult {
  const { lang: activeLang } = useLanguage()
  const [cities, setCities] = useState<City[]>(() => cache ?? [])
  const [loading, setLoading] = useState(cache === null)

  useEffect(() => {
    // `alive` guards against setState after unmount if the fetch resolves late.
    let alive = true
    load().then((items) => {
      if (!alive) return
      setCities(items)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const labelFor = useCallback(
    (code: string | null | undefined, lang?: Lang): string => {
      if (!code) return ''
      const l = lang ?? activeLang
      const city = cities.find((c) => c.code === code)
      // Legacy rows stored a free-text name rather than a code: echo it back so
      // historical data still renders something instead of going blank.
      if (!city) return code
      return (l === 'he' ? city.nameHe : city.nameEn) || city.nameHe
    },
    [cities, activeLang],
  )

  const codeForName = useCallback(
    (name: string | null | undefined): string => {
      const wanted = fold(name ?? '')
      if (!wanted) return ''
      const hit = cities.find((c) => fold(c.nameHe) === wanted || fold(c.nameEn) === wanted)
      return hit?.code ?? ''
    },
    [cities],
  )

  return { cities, loading, labelFor, codeForName }
}
