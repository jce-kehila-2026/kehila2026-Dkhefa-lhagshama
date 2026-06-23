/**
 * useReferralAndDocs: admin request-detail sub-hook for two side flows.
 *   1. referral: open a dialog, lazy-load the live answers catalog, and POST a
 *      referral of the current request to a chosen answer/org.
 *   2. document viewer: re-mint a short-lived signed URL for a request
 *      attachment and open it in a new tab (storage paths never reach client).
 *
 * Split out of useRequestDetail so that hook stays focused; this one owns only
 * referral + doc state and handlers, and is composed back into its return.
 * Collaborates with the backend admin/request routes via apiClient, and depends
 * on the parent for `id`, current `lang`, lifecycle copy (`lc`), `toast`,
 * `setError`, and `load` (used to silently refresh after a successful refer).
 */
import { useState, useCallback } from 'react'
import type { Translations } from '@/contexts/LanguageContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import type { AnswerOption } from './types'

type Toast = (msg: string, kind: 'success' | 'error') => void

// injected by useRequestDetail; `id` is the route param so it carries the
// next/router string|string[]|undefined shape.
interface Deps {
  id: string | string[] | undefined
  lang: string
  lc: Translations['lifecycle']
  toast: Toast
  setError: (msg: string | null) => void
  load: (opts?: { silent?: boolean }) => Promise<void>
}

// returns the referral dialog state + handlers and the doc-viewer state +
// handler; consumed by useRequestDetail which spreads them to the screen.
export function useReferralAndDocs({ id, lang, lc, toast, setError, load }: Deps) {
  // Referral flow (Note 8).
  const [referOpen, setReferOpen] = useState(false)
  const [answers, setAnswers] = useState<AnswerOption[]>([])
  const [answersLoaded, setAnswersLoaded] = useState(false)
  const [referAnswerId, setReferAnswerId] = useState('')
  const [referNote, setReferNote] = useState('')
  const [referring, setReferring] = useState(false)

  // Document viewer (Note 1): tracks which attachment is being opened.
  const [openingDoc, setOpeningDoc] = useState<string | null>(null)

  // ── Referral (Note 8) ──────────────────────────────────────────────────
  // Lazy-load the live answers catalog the first time the refer dialog opens.
  const openReferDialog = useCallback(async () => {
    setReferOpen(true)
    if (answersLoaded) return
    try {
      const res = (await apiJson('/api/answers')) as { items?: AnswerOption[] }
      setAnswers(res.items || [])
    } catch {
      setAnswers([])
    } finally {
      setAnswersLoaded(true)
    }
  }, [answersLoaded])

  // picks the right side of a {he,en} title for the current lang, tolerating a
  // plain string (legacy data) and falling back to the other locale if one
  // side is empty.
  const resolveBilingual = useCallback(
    (v: AnswerOption['title']): string => {
      if (!v) return ''
      if (typeof v === 'string') return v
      return (lang === 'he' ? v.he : v.en) || v.he || v.en || ''
    },
    [lang],
  )

  // POST /api/admin/requests/:id/refer with the chosen answerId + optional note.
  // 409/422 means the request can't be referred from its current status, so map
  // to the illegal-transition message; on success refresh in place and reset.
  const submitReferral = async () => {
    if (!referAnswerId) return
    setReferring(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/requests/${id}/refer`, {
        method: 'POST',
        body: JSON.stringify({ answerId: referAnswerId, note: referNote.trim() || undefined }),
      })
      if (!res.ok) {
        const msg = res.status === 409 || res.status === 422 ? lc.actions.illegalTransition : lc.referral.error
        // Toast surfaces the error; setError would double-report (and now
        // also trip the top-level ErrorState).
        toast(msg, 'error')
        return
      }
      // Silent refresh (FIX 1) — keep the detail mounted after referring.
      await load({ silent: true })
      toast(lc.referral.success, 'success')
      setReferOpen(false)
      setReferAnswerId('')
      setReferNote('')
    } catch {
      // Toast-only (see above) — avoid double-reporting via setError.
      toast(lc.referral.error, 'error')
    } finally {
      setReferring(false)
    }
  }

  // ── Document viewer (Note 1) ───────────────────────────────────────────
  // Re-mints a short-lived signed URL via the backend and opens it in a new
  // tab. Storage paths are never exposed to the client as fetchable URLs.
  const viewDoc = async (name: string) => {
    setOpeningDoc(name)
    try {
      const res = await apiFetch(
        `/api/requests/${id}/attachments/${encodeURIComponent(name)}`,
        { method: 'GET' },
      )
      if (!res.ok) {
        toast(lc.docs.viewError, 'error')
        return
      }
      const data = (await res.json()) as { url?: string }
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } else {
        toast(lc.docs.viewError, 'error')
      }
    } catch {
      toast(lc.docs.viewError, 'error')
    } finally {
      setOpeningDoc(null)
    }
  }

  return {
    referOpen, setReferOpen, answers, answersLoaded, referAnswerId,
    setReferAnswerId, referNote, setReferNote, referring,
    openReferDialog, resolveBilingual, submitReferral,
    openingDoc, viewDoc,
  }
}
