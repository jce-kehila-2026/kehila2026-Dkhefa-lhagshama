import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useApp } from '@/contexts/AppContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import type {
  ActiveVolunteer,
  Candidate,
  MatchReason,
  MatchingI18n,
  PendingTransition,
  RequestDetail,
} from './types'
import { rdStr } from './helpers'
import { buildTransitionCopy, buildTransitionControls } from './transitions'
import { useReferralAndDocs } from './useReferralAndDocs'

// All state, data fetching and action handlers for the admin request-detail
// screen. Mechanically lifted out of the page component so the page stays a
// thin shell that wires this hook into the presentational children.
export function useRequestDetail(id: string | string[] | undefined) {
  const { t, lang } = useLanguage()
  const a = t.admin
  const lc = t.lifecycle
  const { toast } = useApp()

  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [volunteers, setVolunteers] = useState<ActiveVolunteer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [note, setNote] = useState('')
  const [dismissedFormer, setDismissedFormer] = useState(false)
  // WS-6 — ranked match candidates for this request.
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidatesError, setCandidatesError] = useState(false)
  const [candIdx, setCandIdx] = useState(0)
  // FIX 2 — client-side name filter over the ranked candidate list. When
  // non-empty the list shows ALL matches (no 8-item cap); empty restores the
  // collapsing show-all behavior.
  const [candidateSearch, setCandidateSearch] = useState('')
  // FIX 2 — when a request is already assigned the aside shows an assigned
  // summary (who + why); toggling this reveals the ranked list to reassign.
  const [reassigning, setReassigning] = useState(false)

  // Lifecycle transition confirmation (Note 6).
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null)

  // `silent` refreshes the data WITHOUT toggling the page-level loading
  // skeleton, so post-action refreshes (assign, status, note) update the detail
  // in place instead of blanking + rebuilding the whole page. The mount/retry
  // load runs full (non-silent) so the initial skeleton still shows.
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const [reqData, volData] = await Promise.all([
        apiJson(`/api/admin/requests/${id}`) as Promise<RequestDetail>,
        apiJson('/api/admin/volunteers') as Promise<{ active?: ActiveVolunteer[] }>,
      ])
      setRequest(reqData)
      setVolunteers((volData && volData.active) || [])
      // WS-6 — ranked candidates. Non-fatal: a failure just hides the list and
      // surfaces a quiet error; the manual override below still works.
      try {
        const cand = (await apiJson(`/api/admin/requests/${id}/candidates`)) as { candidates?: Candidate[] }
        setCandidates(Array.isArray(cand.candidates) ? cand.candidates : [])
        setCandidatesError(false)
      } catch {
        setCandidates([])
        setCandidatesError(true)
      }
    } catch {
      setError(a.ui.loading)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [id, a.ui.loading])

  useEffect(() => {
    load()
  }, [load])

  // apiFetch returns the raw Response and does NOT throw on non-2xx, so we must
  // inspect res.ok ourselves. `onError(status, body)` lets callers map a
  // specific failure (e.g. #92 status conflicts) to a friendly message.
  const post = async (
    path: string,
    body: Record<string, unknown>,
    onError?: (status: number, payload: { error?: string; [key: string]: unknown } | null) => string | undefined | false,
  ): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/requests/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let payload: { error?: string; [key: string]: unknown } | null = null
        try { payload = await res.json() } catch { payload = null }
        setError((onError && onError(res.status, payload)) || a.reqDetail.statusGenericError)
        return false
      }
      // Refresh data in place — `silent` keeps the detail body mounted so the
      // page does not blank/rebuild on every action (the `saving` flag already
      // disables the controls during the request).
      await load({ silent: true })
      return true
    } catch {
      // Network / unexpected failure.
      setError((onError && onError(0, null)) || a.reqDetail.statusGenericError)
      return false
    } finally {
      setSaving(false)
    }
  }

  // WS-6 — assign directly from a ranked candidate card. Goes through the same
  // POST /assign endpoint as the claimant path, so every backend assign guard
  // (active check, terminal-request 409, chat-on-assign, beneficiary notify) is
  // preserved unchanged.
  const [assigningUid, setAssigningUid] = useState<string | null>(null)
  const m = a.reqDetail.matching as unknown as MatchingI18n
  const handleAssignCandidate = async (uid: string) => {
    setAssigningUid(uid)
    const ok = await post('assign', { volunteerId: uid })
    setAssigningUid(null)
    if (ok) {
      // FIX 2 — flip the aside back to the assigned summary; the silent reload
      // (FIX 1) has already refreshed request.assignedVolunteerId.
      setReassigning(false)
      toast(a.claims.assignSuccess, 'success')
    } else toast(a.claims.assignError, 'error')
  }
  const reasonChipLabel = (r: MatchReason): string => {
    if (r.key === 'speaksLanguage') {
      const langName = (r.lang && m.langLabels[r.lang]) || r.lang || ''
      return `${m.reasons.speaksLanguage}: ${langName}`
    }
    if (r.key === 'lowLoad') {
      // The matcher only emits this for a genuinely idle volunteer (openLoad===0),
      // and the per-candidate load is shown separately, so render without a count.
      return m.reasons.lowLoad
    }
    if (r.key === 'highlyRated' && typeof r.rating === 'number') {
      // Append the actual category-specific average (e.g. "Highly rated here · 4.6").
      return `${m.reasons.highlyRated} · ${r.rating.toFixed(1)}`
    }
    return m.reasons[r.key] || r.key
  }

  // req 22 — assign the request to a specific claimant. The backend assign
  // endpoint also clears the remaining claims, so a successful load() refresh
  // makes the "volunteers requesting this" section collapse on its own.
  const [assigningClaim, setAssigningClaim] = useState<string | null>(null)
  const handleAssignClaim = async (volunteerId: string) => {
    setAssigningClaim(volunteerId)
    const ok = await post('assign', { volunteerId })
    setAssigningClaim(null)
    if (ok) {
      // FIX 2 — assigning a claimant also flips the aside to the summary.
      setReassigning(false)
      toast(a.claims.assignSuccess, 'success')
    } else toast(a.claims.assignError, 'error')
  }
  const handleNote = async () => {
    const trimmed = note.trim()
    if (!trimmed) return
    const ok = await post('note', { note: trimmed })
    if (ok) setNote('')
  }

  // ── Lifecycle transitions (Note 6) ─────────────────────────────────────
  // Confirm copy + success/error toasts per transition kind, all bilingual.
  const TRANSITION_COPY = buildTransitionCopy(lc)

  // Execute a confirmed transition. `archive` posts to its own endpoint; the
  // rest post to /status with { to }. A 409/422 means the move is illegal per
  // the backend transition map — surface the dedicated message.
  const runTransition = async (pt: PendingTransition) => {
    const copy = TRANSITION_COPY[pt.kind]
    setSaving(true)
    setError(null)
    try {
      const res =
        pt.kind === 'archive'
          ? await apiFetch(`/api/admin/requests/${id}/archive`, { method: 'POST', body: JSON.stringify({}) })
          : await apiFetch(`/api/admin/requests/${id}/status`, {
              method: 'POST',
              body: JSON.stringify({ to: pt.to }),
            })
      if (!res.ok) {
        const msg = res.status === 409 || res.status === 422 ? lc.actions.illegalTransition : copy.error
        setError(msg)
        toast(msg, 'error')
        return
      }
      // Silent refresh so a status change updates in place rather than
      // re-running the full-page skeleton (FIX 1).
      await load({ silent: true })
      toast(copy.success, 'success')
    } catch {
      setError(copy.error)
      toast(copy.error, 'error')
    } finally {
      setSaving(false)
      setPendingTransition(null)
    }
  }

  // Referral flow (Note 8) + document viewer (Note 1) live in a companion hook.
  const referralAndDocs = useReferralAndDocs({ id, lang, lc, toast, setError, load })

  // Map the request's current status to the legal admin transition controls
  // (Note 6). Each control carries its label, icon, the pending-transition it
  // triggers, and whether it's destructive.
  const transitionControls = useMemo(
    () => buildTransitionControls(request, lc),
    [request, lc],
  )

  // Refer is offered only while the request is in progress (Note 8). Archive is
  // offered for terminal states (closed/referred) that aren't archived yet.
  const canRefer = request?.status === 'in_progress'
  const canArchive =
    !request?.archived && (request?.status === 'closed' || request?.status === 'referred')

  // Assigning a volunteer to a terminal request (closed/referred/rejected)
  // would create an active chat on a dead request and fire a misleading
  // "assigned" notification, so the assign control is disabled for those
  // states (the backend also rejects it with 409 as a hard guard).
  const isTerminal =
    request?.status === 'closed' ||
    request?.status === 'referred' ||
    request?.status === 'rejected'

  const EMPTY = '·' // middle dot placeholder for missing values

  const fmt = (ts: string | number | Date | undefined): string => {
    if (!ts) return EMPTY
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return EMPTY
    return d.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US')
  }

  const fullName = request
    ? [request.firstName, request.lastName].filter(Boolean).join(' ')
    : ''

  // The currently-assigned volunteer, looked up in the *active* list returned
  // by the API. If a request has an assigned volunteer but they're absent from
  // the active list, they have been deactivated since assignment (#91).
  const assignedVolunteer = useMemo(
    () =>
      request && request.assignedVolunteerId
        ? volunteers.find((v) => v.uid === request.assignedVolunteerId) || null
        : null,
    [request, volunteers],
  )

  // #91 — assigned to someone who is no longer an active volunteer.
  const isFormerVolunteer = Boolean(
    request && request.assignedVolunteerId && !assignedVolunteer,
  )

  // Label for the assigned volunteer cell: prefer the live active-list name,
  // then the denormalized name captured at assign time (survives deactivation,
  // #91 — matches the requests list), and only fall back to the raw uid.
  const assignedLabel = request && request.assignedVolunteerId
    ? (assignedVolunteer && assignedVolunteer.fullName) ||
      request.assignedVolunteerName ||
      request.assignedVolunteerId
    : rdStr(a, 'unassigned')

  // FIX 2 — the assigned volunteer's own match entry. The /candidates endpoint
  // ranks ALL active volunteers, so the assigned one is present with its score
  // + reasons; we surface those reasons as the "why" in the assigned summary.
  // Null if the assigned volunteer is no longer active (e.g. deactivated, #91).
  const assignedCandidate = useMemo(
    () =>
      (request?.assignedVolunteerId &&
        candidates.find((c) => c.uid === request.assignedVolunteerId)) ||
      null,
    [request, candidates],
  )

  // FIX 2 — case-insensitive name filter over the already-ranked candidates.
  // Candidates arrive sorted best-first, so a substring filter preserves the
  // score order; we never re-sort.
  const candidateQuery = candidateSearch.trim().toLowerCase()
  const filteredCandidates = useMemo(
    () =>
      candidateQuery
        ? candidates.filter((c) => c.name.toLowerCase().includes(candidateQuery))
        : candidates,
    [candidates, candidateQuery],
  )
  // One-at-a-time carousel: reset to the first card when the search narrows the
  // set, clamp the index, and render only the current (ranked best-first) card.
  useEffect(() => { setCandIdx(0) }, [candidateQuery])
  const safeIdx = Math.min(candIdx, Math.max(0, filteredCandidates.length - 1))
  const visibleCandidates = filteredCandidates.length ? [filteredCandidates[safeIdx]] : []

  return {
    // translation slices
    a, lc, m,
    // core data
    request, volunteers, loading, error, saving, load,
    // note
    note, setNote, handleNote,
    // former-volunteer notice
    dismissedFormer, setDismissedFormer, isFormerVolunteer,
    // candidates / matching
    candidates, candidatesError, candidateSearch, setCandidateSearch,
    filteredCandidates, visibleCandidates, safeIdx, setCandIdx,
    reassigning, setReassigning, assigningUid, assignedCandidate,
    reasonChipLabel, handleAssignCandidate,
    // claims
    assigningClaim, handleAssignClaim,
    // transitions
    pendingTransition, setPendingTransition, TRANSITION_COPY, runTransition,
    transitionControls, canRefer, canArchive, isTerminal,
    // referral + documents (companion hook)
    ...referralAndDocs,
    // derived
    EMPTY, fmt, fullName, assignedLabel,
  }
}
