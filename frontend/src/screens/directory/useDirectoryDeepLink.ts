import { useEffect, useRef } from 'react'
import type { NextRouter } from 'next/router'
import { apiJson } from '../../lib/apiClient'
import type { DirRecord } from './constants'

type Category = { id: string }

type Params = {
  router: NextRouter
  ngoCategories: Category[]
  userInteracted: { current: boolean }
  setActiveTab: (tab: string) => void
  setAnswerCategory: (cat: string) => void
  setAnswerPage: (page: number) => void
}

// Deep-link from the URL (request form → directory). Once the router is ready
// and the taxonomy has loaded, read ?category=<id> and optional
// ?tab=ngo|partner: a valid category sets the answer-category filter and lands
// on the chosen org tab. An explicit ?tab=partner honors that tab; otherwise
// (no/other tab param) we land on whichever org tab actually has answers in
// the deep-linked category so partner-only matches are never hidden behind an
// empty עמותות tab. ngo wins ties (it is the larger default catalog). Unknown
// or absent params are a silent no-op (keeps 'business' tab + 'all' filter).
// Applied once so a later manual tab/filter change is never overridden.
export function useDirectoryDeepLink({
  router,
  ngoCategories,
  userInteracted,
  setActiveTab,
  setAnswerCategory,
  setAnswerPage,
}: Params) {
  const deepLinkApplied = useRef(false)
  // Read the deep-link params off `router.query` directly: depending on the
  // whole `router.query` object would re-run this effect on its identity churn
  // during Pages-Router query hydration, and because the one-shot guard short-
  // circuits the re-run BEFORE a new cleanup is registered, React would then
  // invoke the previous run's cleanup and cancel an in-flight probe (the
  // deep-link would silently never apply). Keying on the stable primitive
  // params instead means the only re-runs are real param changes.
  const queryCategory = router.query.category
  const queryTab = router.query.tab
  useEffect(() => {
    if (deepLinkApplied.current) return
    if (!router.isReady) return
    // Wait for the taxonomy so we can validate the category against live ids.
    if (ngoCategories.length === 0) return

    const category = Array.isArray(queryCategory) ? queryCategory[0] : queryCategory
    if (!category || !ngoCategories.some((c) => c.id === category)) return

    const tab = Array.isArray(queryTab) ? queryTab[0] : queryTab

    // Mark applied only once we have a valid, actionable deep-link in hand, so
    // an early `return` above (no/invalid category) leaves the guard open for a
    // later render where the params have settled.
    deepLinkApplied.current = true

    const applyDeepLink = (nextTab: 'ngo' | 'partner') => {
      setActiveTab(nextTab)
      setAnswerCategory(category)
      setAnswerPage(1)
    }

    // Explicit partner request — honor it as-is.
    if (tab === 'partner') {
      applyDeepLink('partner')
      return
    }
    // Explicit ngo request — honor it as-is.
    if (tab === 'ngo') {
      applyDeepLink('ngo')
      return
    }

    // No tab hint: probe both org types for the category and land on the one
    // with results (ngo preferred on a tie / when both empty). A lightweight
    // count-only check keeps the deep-link from dead-ending on an empty tab.
    let alive = true
    const probe = async () => {
      const countFor = async (orgType: 'ngo' | 'partner') => {
        try {
          const data = await apiJson(
            `/api/answers?orgType=${orgType}&category=${encodeURIComponent(category)}`
          ) as { items?: DirRecord[] }
          return data?.items?.length ?? 0
        } catch {
          return 0
        }
      }
      const [ngoCount, partnerCount] = await Promise.all([countFor('ngo'), countFor('partner')])
      if (!alive) return
      // If the user clicked a tab / chip while the counts were loading, respect
      // their choice — do not snap the tab/category back (review r6, finding 3).
      if (userInteracted.current) return
      // ngo wins unless it is empty and partner has matches.
      applyDeepLink(ngoCount === 0 && partnerCount > 0 ? 'partner' : 'ngo')
    }
    void probe()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, queryCategory, queryTab, ngoCategories])
}
