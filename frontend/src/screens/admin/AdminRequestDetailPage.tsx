import { useEffect, useState, useCallback, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Clock3,
  MapPin,
  Tag,
  UserCircle2,
  History,
  UserPlus,
  StickyNote,
  CheckCircle2,
  Handshake,
  RotateCcw,
  XCircle,
  Undo2,
  Share2,
  Archive,
  FileText,
  ExternalLink,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useApp } from '@/contexts/AppContext'
import { useCategories } from '@/hooks/useCategories'
import { apiJson, apiFetch } from '@/lib/apiClient'
import type { Attachment, CloseRequestSummary, RequestStatus } from '@/types'
import AdminLayout from '@/components/admin/AdminLayout'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import { StatusBadge, ErrorState } from '@/components/admin/AdminUI'
import Reveal from '../../components/motion/Reveal'

// ── Transition map (mirrors the backend authority in lib/requestTransitions).
// Only legal admin moves are listed; the UI renders a control per legal move
// from the request's current status. `referred` is handled by the dedicated
// refer action, and `archived` is a boolean flag set via the archive endpoint.
const ADMIN_TRANSITIONS: Record<string, RequestStatus[]> = {
  pending: ['in_progress', 'rejected'],
  // An admin alone may one-step close an in-progress request (no
  // awaiting_review stop) — mirrors the backend map on this branch.
  in_progress: ['awaiting_review', 'closed', 'referred', 'rejected'],
  awaiting_review: ['closed', 'in_progress'],
  closed: ['in_progress'],
  referred: [],
  rejected: [],
}

// A partner option sourced from the live answers catalog (Note 8). Titles are
// bilingual { he, en }; we resolve to the active language for display.
interface AnswerOption {
  id: string
  title?: { he?: string; en?: string } | string | null
  sourceName?: { he?: string; en?: string } | string | null
  sourceUrl?: string | null
}

// A single audit/timeline event on a request. `details` is genuinely dynamic
// per event type, so it stays loose.
interface RequestEvent {
  id: string
  type: string
  createdAt?: string | number | Date
  details?: { volunteerId?: string; to?: string; note?: string; [key: string]: unknown }
}

// A volunteer who has expressed interest in (claimed) a pooled request (req 22).
interface RequestClaim {
  volunteerId: string
  volunteerName?: string
  note?: string
  claimedAt?: string | number | Date
}

// A request as returned by GET /api/admin/requests/:id. Loose by design — only
// the fields this screen reads are declared.
interface RequestDetail {
  id: string
  firstName?: string
  lastName?: string
  title?: string
  description?: string
  category?: string
  city?: string
  status?: string
  assignedVolunteerId?: string
  language?: string
  preferredLanguage?: string
  events?: RequestEvent[]
  archived?: boolean
  attachments?: Attachment[]
  referral?: { partnerName?: string; note?: string }
  onBehalf?: boolean
  submittedBy?: string
  submittedByRole?: string
  claims?: RequestClaim[]
  hasClaims?: boolean
  origin?: string
  requestType?: string
  // Pending consent-close handshake (req 25), null/absent when none.
  closeRequest?: CloseRequestSummary | null
  [key: string]: unknown
}

// An active volunteer as returned by GET /api/admin/volunteers.
interface ActiveVolunteer {
  uid: string
  fullName?: string
  languages?: string[]
  [key: string]: unknown
}

// The translation bundle slice consumed here (t.admin). Loose so we don't
// duplicate the full translation typing that lives elsewhere.
type AdminCopy = {
  statusLabels: Record<string, string>
  roleLabels: Record<string, string>
  reqDetail: Record<string, string>
  [key: string]: unknown
}

// Normalize a language token to a comparable lowercase code (e.g. 'Hebrew' →
// 'he' is out of scope; we compare the raw stored codes like 'he'/'am'/'en').
function normLang(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

function eventLabel(ev: RequestEvent, a: AdminCopy): string {
  switch (ev.type) {
    case 'assigned':
      return `${a.reqDetail.assign}: ${ev.details && ev.details.volunteerId ? ev.details.volunteerId : ''}`
    case 'status_changed':
      return `${a.reqDetail.changeStatus}: ${
        (ev.details && ev.details.to && a.statusLabels[ev.details.to]) || (ev.details && ev.details.to) || ''
      }`
    case 'note_added':
      return (ev.details && ev.details.note) || a.reqDetail.addNote
    // req 25 — consent-close handshake trail: details carry
    // { action: 'proposed'|'approved'|'declined', role: 'volunteer'|'beneficiary' }.
    case 'close_consent': {
      const action = typeof ev.details?.action === 'string' ? ev.details.action : ''
      const role = typeof ev.details?.role === 'string' ? ev.details.role : ''
      const base =
        action === 'declined'
          ? a.reqDetail.closeConsentDeclined
          : action === 'approved'
            ? a.reqDetail.closeConsentApproved
            : a.reqDetail.closeConsentProposed
      const roleLabel = (role && a.roleLabels[role]) || role
      return roleLabel ? `${base} (${roleLabel})` : base
    }
    default:
      return ev.type
  }
}

// A meta cell in the request summary: a labelled value with a quiet icon.
// Declared at module scope (not inside render) so it never remounts.
interface MetaCellProps {
  icon: LucideIcon
  label: ReactNode
  children: ReactNode
}

function MetaCell({ icon: Icon, label, children }: MetaCellProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        paddingBlock: 'var(--sp-2)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          width: '34px',
          height: '34px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--sky-3)',
          color: 'var(--ink-2)',
        }}
      >
        <Icon size={17} />
      </span>
      <div style={{ minWidth: 0 }}>
        <dt
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 'var(--fs-xs)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--gray-500)',
            margin: 0,
          }}
        >
          {label}
        </dt>
        <dd
          style={{
            margin: '4px 0 0',
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {children}
        </dd>
      </div>
    </div>
  )
}

// Shared eyebrow treatment used to label each block — matches the marketing
// surfaces (uppercase mono, ember accent, generous tracking).
const EYEBROW: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ember)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
}

// A pending lifecycle transition awaiting confirmation. `kind` selects the
// confirm copy + the endpoint to call; `to` is the target status (omitted for
// archive, which hits its own endpoint).
type TransitionKind = 'close' | 'reopen' | 'reject' | 'sendBack' | 'archive'
interface PendingTransition {
  kind: TransitionKind
  to?: RequestStatus
}

export default function AdminRequestDetailPage() {
  const { t, lang, isRTL } = useLanguage()
  const a = t.admin
  const lc = t.lifecycle
  // Bilingual category labels from the admin-managed taxonomy.
  const { labelFor } = useCategories()
  const { toast } = useApp()
  const router = useRouter()
  const { id } = router.query
  const BackArrow = isRTL ? ArrowRight : ArrowLeft

  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [volunteers, setVolunteers] = useState<ActiveVolunteer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [assignTo, setAssignTo] = useState('')
  const [note, setNote] = useState('')
  const [dismissedFormer, setDismissedFormer] = useState(false)
  const [dismissedLangWarn, setDismissedLangWarn] = useState(false)

  // Lifecycle transition confirmation (Note 6).
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null)

  // Referral flow (Note 8).
  const [referOpen, setReferOpen] = useState(false)
  const [answers, setAnswers] = useState<AnswerOption[]>([])
  const [answersLoaded, setAnswersLoaded] = useState(false)
  const [referAnswerId, setReferAnswerId] = useState('')
  const [referNote, setReferNote] = useState('')
  const [referring, setReferring] = useState(false)

  // Document viewer (Note 1): tracks which attachment is being opened.
  const [openingDoc, setOpeningDoc] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [reqData, volData] = await Promise.all([
        apiJson(`/api/admin/requests/${id}`) as Promise<RequestDetail>,
        apiJson('/api/admin/volunteers') as Promise<{ active?: ActiveVolunteer[] }>,
      ])
      setRequest(reqData)
      setAssignTo(reqData.assignedVolunteerId || '')
      setVolunteers((volData && volData.active) || [])
    } catch {
      setError(a.ui.loading)
    } finally {
      setLoading(false)
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
      await load()
      return true
    } catch {
      // Network / unexpected failure.
      setError((onError && onError(0, null)) || a.reqDetail.statusGenericError)
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = () => {
    if (assignTo) post('assign', { volunteerId: assignTo })
  }

  // req 22 — assign the request to a specific claimant. The backend assign
  // endpoint also clears the remaining claims, so a successful load() refresh
  // makes the "volunteers requesting this" section collapse on its own.
  const [assigningClaim, setAssigningClaim] = useState<string | null>(null)
  const handleAssignClaim = async (volunteerId: string) => {
    setAssigningClaim(volunteerId)
    const ok = await post('assign', { volunteerId })
    setAssigningClaim(null)
    if (ok) toast(a.claims.assignSuccess, 'success')
    else toast(a.claims.assignError, 'error')
  }
  const handleNote = async () => {
    const trimmed = note.trim()
    if (!trimmed) return
    const ok = await post('note', { note: trimmed })
    if (ok) setNote('')
  }

  // ── Lifecycle transitions (Note 6) ─────────────────────────────────────
  // Confirm copy + success/error toasts per transition kind, all bilingual.
  const TRANSITION_COPY: Record<
    TransitionKind,
    { confirm: string; success: string; error: string; variant: 'default' | 'danger' }
  > = {
    close:    { confirm: lc.actions.closeConfirm,    success: lc.actions.closeSuccess,    error: lc.actions.closeError,    variant: 'default' },
    reopen:   { confirm: lc.actions.reopenConfirm,   success: lc.actions.reopenSuccess,   error: lc.actions.reopenError,   variant: 'default' },
    reject:   { confirm: lc.actions.rejectConfirm,   success: lc.actions.rejectSuccess,   error: lc.actions.rejectError,   variant: 'danger'  },
    sendBack: { confirm: lc.actions.sendBackConfirm, success: lc.actions.sendBackSuccess, error: lc.actions.sendBackError, variant: 'default' },
    archive:  { confirm: lc.actions.archiveConfirm,  success: lc.actions.archiveSuccess,  error: lc.actions.archiveError,  variant: 'default' },
  }

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
      await load()
      toast(copy.success, 'success')
    } catch {
      setError(copy.error)
      toast(copy.error, 'error')
    } finally {
      setSaving(false)
      setPendingTransition(null)
    }
  }

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

  const resolveBilingual = useCallback(
    (v: AnswerOption['title']): string => {
      if (!v) return ''
      if (typeof v === 'string') return v
      return (lang === 'he' ? v.he : v.en) || v.he || v.en || ''
    },
    [lang],
  )

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
        setError(msg)
        toast(msg, 'error')
        return
      }
      await load()
      toast(lc.referral.success, 'success')
      setReferOpen(false)
      setReferAnswerId('')
      setReferNote('')
    } catch {
      setError(lc.referral.error)
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

  // Map the request's current status to the legal admin transition controls
  // (Note 6). Each control carries its label, icon, the pending-transition it
  // triggers, and whether it's destructive.
  const transitionControls = useMemo(() => {
    const current = request?.status || ''
    const allowed = ADMIN_TRANSITIONS[current] || []
    const controls: {
      key: TransitionKind
      label: string
      Icon: LucideIcon
      pt: PendingTransition
      danger?: boolean
    }[] = []
    // Close is offered from awaiting_review AND in_progress (admin one-step
    // close, e.g. to resolve a one-sided consent-close handshake — req 25).
    if ((current === 'awaiting_review' || current === 'in_progress') && allowed.includes('closed')) {
      controls.push({ key: 'close', label: lc.actions.close, Icon: CheckCircle2, pt: { kind: 'close', to: 'closed' } })
    }
    if (current === 'awaiting_review' && allowed.includes('in_progress')) {
      controls.push({ key: 'sendBack', label: lc.actions.sendBack, Icon: Undo2, pt: { kind: 'sendBack', to: 'in_progress' } })
    }
    if (current === 'closed' && allowed.includes('in_progress')) {
      controls.push({ key: 'reopen', label: lc.actions.reopen, Icon: RotateCcw, pt: { kind: 'reopen', to: 'in_progress' } })
    }
    if (allowed.includes('rejected')) {
      controls.push({ key: 'reject', label: lc.actions.reject, Icon: XCircle, pt: { kind: 'reject', to: 'rejected' }, danger: true })
    }
    return controls
  }, [request, lc.actions])

  // Refer is offered only while the request is in progress (Note 8). Archive is
  // offered for terminal states (closed/referred) that aren't archived yet.
  const canRefer = request?.status === 'in_progress'
  const canArchive =
    !request?.archived && (request?.status === 'closed' || request?.status === 'referred')

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

  // Label for the assigned volunteer cell: prefer their name, fall back to uid.
  const assignedLabel = request && request.assignedVolunteerId
    ? (assignedVolunteer && assignedVolunteer.fullName) || request.assignedVolunteerId
    : a.reqDetail.unassigned

  // #95 — non-blocking language-match check for the volunteer being *picked* in
  // the assign dropdown. Requests don't yet carry a language field, so we treat
  // Hebrew ('he') as the community default and warn if the chosen volunteer's
  // languages don't include the beneficiary's language. If language data is
  // missing on either side we stay silent (no warning).
  const langMismatch = useMemo(() => {
    if (!assignTo || !request) return false
    const candidate = volunteers.find((v) => v.uid === assignTo)
    if (!candidate) return false
    const volLangs = (candidate.languages || []).map(normLang).filter(Boolean)
    if (volLangs.length === 0) return false
    const beneficiaryLang = normLang(
      request.language || request.preferredLanguage || 'he',
    )
    if (!beneficiaryLang) return false
    return !volLangs.includes(beneficiaryLang)
  }, [assignTo, volunteers, request])

  return (
    <AdminLayout title={a.reqDetail.title}>
      <Link
        href="/admin/requests"
        className="admin-back-link"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
      >
        <BackArrow size={16} aria-hidden="true" />
        {a.reqDetail.back}
      </Link>

      {error && (
        <div style={{ marginBlockStart: 'var(--sp-4)' }}>
          <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />
        </div>
      )}

      {/* Loading — an intentional skeleton mirroring the final two-column layout */}
      {loading && (
        <div
          className="admin-detail-grid"
          style={{ marginBlockStart: 'var(--sp-5)' }}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">{a.ui.loading}</span>
          <section className="card" style={{ padding: 'var(--sp-5)' }} aria-hidden="true">
            <span className="skeleton skeleton-line" style={{ width: '45%', height: '1.6rem' }} />
            <span className="skeleton skeleton-line" style={{ width: '100%', marginBlockStart: 'var(--sp-4)' }} />
            <span className="skeleton skeleton-line" style={{ width: '92%', marginBlockStart: 'var(--sp-2)' }} />
            <span className="skeleton skeleton-line" style={{ width: '70%', marginBlockStart: 'var(--sp-2)' }} />
            <span className="skeleton skeleton-line" style={{ width: '60%', height: '2.6rem', marginBlockStart: 'var(--sp-5)' }} />
          </section>
          <aside className="card" style={{ padding: 'var(--sp-5)' }} aria-hidden="true">
            <span className="skeleton skeleton-line" style={{ width: '50%' }} />
            <span className="skeleton skeleton-line" style={{ width: '100%', height: '2.6rem', marginBlockStart: 'var(--sp-3)' }} />
            <span className="skeleton skeleton-line" style={{ width: '50%', height: '2.6rem', marginBlockStart: 'var(--sp-5)' }} />
          </aside>
        </div>
      )}

      {/* #91 — assigned volunteer was deactivated; prompt reassignment */}
      {!loading && request && isFormerVolunteer && !dismissedFormer && (
        <div
          className="admin-notice admin-notice-warn"
          role="alert"
          style={{ marginBlockStart: 'var(--sp-4)' }}
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{a.reqDetail.formerVolWarning}</span>
          <button
            type="button"
            className="admin-notice-action"
            onClick={() => setDismissedFormer(true)}
          >
            {a.reqDetail.dismiss}
          </button>
        </div>
      )}

      {!loading && request && (
        <Reveal y={16}>
          <div className="admin-detail-grid" style={{ marginBlockStart: 'var(--sp-5)' }}>
            <section
              className="card admin-detail-main"
              style={{ padding: 'clamp(var(--sp-5), 3vw, var(--sp-6))' }}
            >
              {/* Editorial header: eyebrow → serif name → status */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--sp-3)',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={EYEBROW}>
                    <UserCircle2 size={14} aria-hidden="true" />
                    {a.reqDetail.title}
                  </span>
                  <h2
                    style={{
                      fontFamily: 'Frank Ruhl Libre, Georgia, serif',
                      fontSize: 'var(--fs-h2)',
                      fontWeight: 500,
                      lineHeight: 1.15,
                      letterSpacing: '-0.01em',
                      color: 'var(--ink)',
                      margin: '10px 0 0',
                      wordBreak: 'break-word',
                    }}
                  >
                    {fullName || request.id}
                  </h2>
                </div>
                <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <StatusBadge
                    status={request.status ?? ''}
                    label={(request.status ? (a.statusLabels as Record<string, string>)[request.status] : '') || request.status || ''}
                  />
                  {request.archived && (
                    <StatusBadge status="archived" label={lc.archivedBadge} />
                  )}
                  {(request.onBehalf === true || request.submittedByRole === 'volunteer') && (
                    <StatusBadge
                      status="onBehalf"
                      label={request.submittedBy ? `${a.onBehalf} · ${request.submittedBy}` : a.onBehalf}
                    />
                  )}
                </span>
              </div>

              <p
                style={{
                  color: 'var(--gray-700)',
                  fontSize: 'var(--fs-lede)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  margin: 'var(--sp-4) 0 0',
                }}
              >
                {request.description}
              </p>

              {/* Meta facts as labelled, icon-led cells */}
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--sp-1) var(--sp-5)',
                  margin: 'var(--sp-5) 0 0',
                  paddingBlockStart: 'var(--sp-4)',
                  borderBlockStart: '1px solid var(--hair)',
                }}
              >
                <MetaCell icon={Tag} label={a.reqDetail.category}>
                  {request.category ? labelFor(request.category) : EMPTY}
                </MetaCell>
                <MetaCell icon={MapPin} label={a.reqDetail.city}>
                  {request.city || EMPTY}
                </MetaCell>
                <MetaCell icon={UserCircle2} label={a.reqDetail.assignedTo}>
                  {assignedLabel}
                  {isFormerVolunteer && (
                    <span className="former-tag">{a.reqDetail.formerTag}</span>
                  )}
                </MetaCell>
              </dl>

              {/* req 25 — pending consent-close handshake: who proposed and
                  where each side stands. The admin may close for the missing
                  party via the Close control in the action panel. */}
              {request.closeRequest && (
                <div
                  style={{
                    margin: 'var(--sp-5) 0 0',
                    padding: 'var(--sp-4)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--hair)',
                    background: 'var(--sky-3)',
                  }}
                >
                  <span style={{ ...EYEBROW, color: 'var(--ember)' }}>
                    <Handshake size={14} aria-hidden="true" />
                    {a.reqDetail.closePanelTitle}
                  </span>
                  <p style={{ margin: 'var(--sp-2) 0 0', fontWeight: 600, color: 'var(--ink)' }}>
                    {a.reqDetail.closeProposedBy}:{' '}
                    {(request.closeRequest.proposedRole &&
                      (a.roleLabels as Record<string, string>)[request.closeRequest.proposedRole]) ||
                      request.closeRequest.proposedRole ||
                      EMPTY}
                    {' · '}
                    {fmt(request.closeRequest.proposedAt ?? undefined)}
                  </p>
                  <p style={{ margin: 'var(--sp-1) 0 0', color: 'var(--gray-700)', lineHeight: 1.5 }}>
                    {(a.roleLabels as Record<string, string>).volunteer}:{' '}
                    {request.closeRequest.volunteerApproved
                      ? a.reqDetail.closeAgreed
                      : a.reqDetail.closeWaiting}
                    {' · '}
                    {(a.roleLabels as Record<string, string>).beneficiary}:{' '}
                    {request.closeRequest.beneficiaryApproved
                      ? a.reqDetail.closeAgreed
                      : a.reqDetail.closeWaiting}
                  </p>
                  <p style={{ margin: 'var(--sp-1) 0 0', color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
                    {a.reqDetail.closeAdminHint}
                  </p>
                </div>
              )}

              {/* Referral panel (Note 8) — shown once the request was referred */}
              {request.referral && request.referral.partnerName && (
                <div
                  className="admin-referral-panel"
                  style={{
                    margin: 'var(--sp-5) 0 0',
                    padding: 'var(--sp-4)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--hair)',
                    background: 'var(--sky-3)',
                  }}
                >
                  <span style={{ ...EYEBROW, color: 'var(--ember)' }}>
                    <Share2 size={14} aria-hidden="true" />
                    {lc.actions.refer}
                  </span>
                  <p style={{ margin: 'var(--sp-2) 0 0', fontWeight: 600, color: 'var(--ink)' }}>
                    {lc.referral.timelineTitle(request.referral.partnerName)}
                  </p>
                  {request.referral.note && (
                    <p style={{ margin: 'var(--sp-1) 0 0', color: 'var(--gray-700)', lineHeight: 1.5 }}>
                      {request.referral.note}
                    </p>
                  )}
                </div>
              )}

              {/* ── Volunteers requesting this (req 22) — multi-claimant review.
                  Each claimant shows their name, note + when they claimed, with
                  an Assign action. Assigning clears the other claims server-side. ── */}
              {request.claims && request.claims.length > 0 && (
                <div
                  style={{
                    margin: 'var(--sp-6) 0 0',
                    paddingBlockStart: 'var(--sp-5)',
                    borderBlockStart: '1px solid var(--hair)',
                  }}
                >
                  <span style={{ ...EYEBROW, color: 'var(--ember)' }}>
                    <UserPlus size={14} aria-hidden="true" />
                    {a.claims.heading}
                  </span>
                  <ul className="admin-claim-list">
                    {request.claims.map((claim) => {
                      const busyClaim = assigningClaim === claim.volunteerId
                      return (
                        <li key={claim.volunteerId} className="admin-claim-item">
                          <div className="admin-claim-body">
                            <span className="admin-claim-name">
                              {claim.volunteerName || claim.volunteerId}
                            </span>
                            <p className="admin-claim-note">
                              {claim.note?.trim() || a.claims.noNote}
                            </p>
                            {claim.claimedAt && (
                              <p className="admin-claim-meta">
                                {a.claims.claimedAt}: {fmt(claim.claimedAt)}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm admin-claim-assign"
                            disabled={saving || busyClaim}
                            aria-busy={busyClaim || undefined}
                            aria-label={`${a.claims.assign}: ${claim.volunteerName || claim.volunteerId}`}
                            onClick={() => handleAssignClaim(claim.volunteerId)}
                          >
                            {busyClaim ? a.claims.assigning : a.claims.assign}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* Timeline */}
              <div
                style={{
                  margin: 'var(--sp-6) 0 0',
                  paddingBlockStart: 'var(--sp-5)',
                  borderBlockStart: '1px solid var(--hair)',
                }}
              >
                <span style={{ ...EYEBROW, color: 'var(--ink-2)' }}>
                  <History size={14} aria-hidden="true" />
                  {a.reqDetail.timeline}
                </span>

                {request.events && request.events.length > 0 ? (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 'var(--sp-4) 0 0',
                      padding: 0,
                      position: 'relative',
                    }}
                  >
                    {request.events.map((ev, i, arr) => (
                      <li
                        key={ev.id}
                        style={{
                          display: 'flex',
                          gap: 'var(--sp-3)',
                          paddingBlockEnd: i < arr.length - 1 ? 'var(--sp-4)' : 0,
                        }}
                      >
                        {/*
                          Marker + connector rail. The dot must sit on the FIRST
                          line of the event label even when the note wraps to
                          several lines and even at the larger HE serif metrics.
                          Rather than hardcoding pixel offsets tied to one font's
                          cap height, we give this column a line box that matches
                          the label's line-height (1.45em) and center the dot in
                          it. The rail then starts right below the dot and runs to
                          the next item, derived from the same line-height — no
                          magic numbers, and it re-balances if the label wraps.
                        */}
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            width: '14px',
                            // line box of the first label line — keeps the dot
                            // vertically centered on that line, not the whole
                            // (possibly multi-line) label.
                            height: 'calc(var(--fs-body) * 1.45)',
                          }}
                        >
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: i === 0 ? 'var(--ember)' : 'var(--white)',
                              border: `2px solid ${i === 0 ? 'var(--ember)' : 'var(--gray-300)'}`,
                              boxShadow: i === 0 ? 'var(--ring)' : 'none',
                              zIndex: 1,
                            }}
                          />
                          {i < arr.length - 1 && (
                            <span
                              style={{
                                position: 'absolute',
                                // start just past the centered dot (half the line
                                // box + half the dot) and extend through the row's
                                // bottom padding to meet the next marker.
                                insetBlockStart: 'calc(50% + 7px)',
                                insetBlockEnd: 'calc(var(--sp-4) * -1)',
                                width: '2px',
                                background: 'var(--hair)',
                              }}
                            />
                          )}
                        </span>

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '4px var(--sp-3)',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 }}>
                            {eventLabel(ev, a)}
                          </span>
                          <time
                            style={{
                              color: 'var(--gray-500)',
                              fontSize: 'var(--fs-sm)',
                              whiteSpace: 'nowrap',
                              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {fmt(ev.createdAt)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div
                    role="status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-3)',
                      margin: 'var(--sp-4) 0 0',
                      padding: 'var(--sp-4)',
                      borderRadius: 'var(--radius)',
                      border: '1px dashed var(--gray-300)',
                      background: 'var(--paper)',
                      color: 'var(--gray-500)',
                    }}
                  >
                    <Clock3 size={18} aria-hidden="true" />
                    <span>{a.reqDetail.noEvents}</span>
                  </div>
                )}
              </div>
            </section>

            {/* ── Action panel — sticky on desktop ───────────────────────── */}
            <aside
              className="card admin-detail-side"
              style={{
                padding: 'clamp(var(--sp-5), 3vw, var(--sp-6))',
                position: 'sticky',
                // AdminLayout has no fixed top chrome (header scrolls; nav is a
                // left sidebar), so we pin to a small explicit offset rather than
                // borrowing the marketing shell's --nav-h, which produced a
                // bogus ~80px gap above the panel.
                insetBlockStart: 'var(--sp-5)',
              }}
            >
              <span style={{ ...EYEBROW, marginBlockEnd: 'var(--sp-4)' }}>
                {a.reqDetail.changeStatus}
              </span>

              <div className="field" style={{ marginBlockStart: 'var(--sp-2)' }}>
                <label
                  className="form-label"
                  htmlFor="assign"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
                >
                  <UserPlus size={15} aria-hidden="true" style={{ color: 'var(--ember)' }} />
                  {a.reqDetail.assign}
                </label>
                <select
                  id="assign"
                  className="form-select"
                  value={assignTo}
                  onChange={(e) => {
                    setAssignTo(e.target.value)
                    setDismissedLangWarn(false)
                  }}
                >
                  <option value="">{a.reqDetail.chooseVol}</option>
                  {volunteers.map((v) => (
                    <option key={v.uid} value={v.uid}>
                      {v.fullName || v.uid}
                    </option>
                  ))}
                </select>
                {/* #95 — non-blocking language-mismatch warning */}
                {langMismatch && !dismissedLangWarn && (
                  <div
                    className="admin-notice admin-notice-warn"
                    role="status"
                    style={{ marginBlockStart: 'var(--sp-3)' }}
                  >
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>{a.reqDetail.langMismatchWarning}</span>
                    <button
                      type="button"
                      className="admin-notice-action"
                      onClick={() => setDismissedLangWarn(true)}
                    >
                      {a.reqDetail.dismiss}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-primary admin-side-btn"
                  disabled={saving || !assignTo}
                  aria-busy={saving || undefined}
                  onClick={handleAssign}
                >
                  {a.reqDetail.assignBtn}
                </button>
              </div>

              {/* ── Lifecycle transitions (Note 6 + 8) — only legal moves from
                  the current status are shown. Refer + archive sit alongside. ── */}
              <div
                className="field"
                style={{
                  marginBlockStart: 'var(--sp-5)',
                  paddingBlockStart: 'var(--sp-5)',
                  borderBlockStart: '1px solid var(--hair)',
                }}
              >
                <span
                  className="form-label"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBlockEnd: 'var(--sp-2)' }}
                >
                  <Share2 size={15} aria-hidden="true" style={{ color: 'var(--ember)' }} />
                  {a.reqDetail.changeStatus}
                </span>

                {transitionControls.length === 0 && !canRefer && !canArchive ? (
                  <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
                    {EMPTY}
                  </p>
                ) : (
                  <div className="admin-lifecycle-actions" role="group" aria-label={a.reqDetail.changeStatus}>
                    {transitionControls.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        className={`btn admin-side-btn ${c.danger ? 'btn-danger' : 'btn-outline'}`}
                        disabled={saving}
                        onClick={() => setPendingTransition(c.pt)}
                      >
                        <c.Icon size={15} aria-hidden="true" />
                        {c.label}
                      </button>
                    ))}
                    {canRefer && (
                      <button
                        type="button"
                        className="btn btn-outline admin-side-btn"
                        disabled={saving}
                        onClick={openReferDialog}
                      >
                        <Share2 size={15} aria-hidden="true" />
                        {lc.actions.refer}
                      </button>
                    )}
                    {canArchive && (
                      <button
                        type="button"
                        className="btn btn-outline admin-side-btn"
                        disabled={saving}
                        onClick={() => setPendingTransition({ kind: 'archive' })}
                      >
                        <Archive size={15} aria-hidden="true" />
                        {lc.actions.archive}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Documents (Note 1) — list attachments; each opens a freshly
                  minted short-lived signed URL in a new tab. ── */}
              <div
                className="field"
                style={{
                  marginBlockStart: 'var(--sp-5)',
                  paddingBlockStart: 'var(--sp-5)',
                  borderBlockStart: '1px solid var(--hair)',
                }}
              >
                <span
                  className="form-label"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBlockEnd: 'var(--sp-2)' }}
                >
                  <FileText size={15} aria-hidden="true" style={{ color: 'var(--ember)' }} />
                  {lc.docs.heading}
                </span>

                {request.attachments && request.attachments.length > 0 ? (
                  <ul className="admin-doc-list">
                    {request.attachments.map((doc) => {
                      const busy = openingDoc === doc.name
                      return (
                        <li key={doc.name} className="admin-doc-item">
                          <FileText size={16} aria-hidden="true" className="admin-doc-icon" />
                          <span className="admin-doc-name" title={doc.name}>{doc.name}</span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm admin-doc-view"
                            disabled={busy}
                            aria-busy={busy || undefined}
                            aria-label={`${lc.docs.view}: ${doc.name}`}
                            onClick={() => viewDoc(doc.name)}
                          >
                            {busy ? lc.docs.opening : lc.docs.view}
                            {!busy && <ExternalLink size={14} aria-hidden="true" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
                    {lc.docs.empty}
                  </p>
                )}
              </div>

              <div
                className="field"
                style={{
                  marginBlockStart: 'var(--sp-5)',
                  paddingBlockStart: 'var(--sp-5)',
                  borderBlockStart: '1px solid var(--hair)',
                }}
              >
                <label
                  className="form-label"
                  htmlFor="note"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
                >
                  <StickyNote size={15} aria-hidden="true" style={{ color: 'var(--ember)' }} />
                  {a.reqDetail.addNote}
                </label>
                <textarea
                  id="note"
                  className="form-textarea"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={a.reqDetail.notePH}
                />
                <button
                  type="button"
                  className="btn btn-outline admin-side-btn"
                  disabled={saving || !note.trim()}
                  onClick={handleNote}
                >
                  {a.reqDetail.saveNote}
                </button>
              </div>
            </aside>
          </div>
        </Reveal>
      )}

      {/* ── Transition confirmation (Note 6) ── */}
      {pendingTransition && (
        <ConfirmDialog
          open
          title={
            transitionControls.find((c) => c.key === pendingTransition.kind)?.label ||
            (pendingTransition.kind === 'archive' ? lc.actions.archive : lc.actions.refer)
          }
          message={TRANSITION_COPY[pendingTransition.kind].confirm}
          confirmLabel={t.common.confirm}
          cancelLabel={t.common.cancel}
          variant={TRANSITION_COPY[pendingTransition.kind].variant}
          busy={saving}
          onConfirm={() => runTransition(pendingTransition)}
          onCancel={() => setPendingTransition(null)}
        />
      )}

      {/* ── Refer to partner dialog (Note 8) — picker over the answers catalog
          + optional note. Reuses the branded confirm surface for consistency. ── */}
      {referOpen && (
        <div
          className="confirm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !referring) setReferOpen(false)
          }}
        >
          <div
            className="confirm-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refer-title"
          >
            <span className="confirm-icon confirm-icon--default" aria-hidden="true">
              <Share2 size={22} />
            </span>
            <h2 id="refer-title" className="confirm-title">{lc.referral.dialogTitle}</h2>

            <div className="field" style={{ textAlign: 'start' }}>
              <label className="form-label" htmlFor="refer-partner">
                {lc.referral.choosePartner}
              </label>
              {!answersLoaded ? (
                <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
                  {a.ui.loading}
                </p>
              ) : answers.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
                  {lc.referral.noPartners}
                </p>
              ) : (
                <select
                  id="refer-partner"
                  className="form-select"
                  value={referAnswerId}
                  onChange={(e) => setReferAnswerId(e.target.value)}
                >
                  <option value="">{lc.referral.partnerPH}</option>
                  {answers.map((ans) => (
                    <option key={ans.id} value={ans.id}>
                      {resolveBilingual(ans.title) || resolveBilingual(ans.sourceName) || ans.id}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="field" style={{ textAlign: 'start', marginBlockStart: 'var(--sp-3)' }}>
              <label className="form-label" htmlFor="refer-note">
                {lc.referral.noteLabel}
              </label>
              <textarea
                id="refer-note"
                className="form-textarea"
                rows={3}
                value={referNote}
                onChange={(e) => setReferNote(e.target.value)}
                placeholder={lc.referral.notePH}
              />
            </div>

            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setReferOpen(false)}
                disabled={referring}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                className={`btn btn-primary${referring ? ' is-loading' : ''}`}
                onClick={submitReferral}
                disabled={referring || !referAnswerId}
                aria-busy={referring || undefined}
              >
                {referring ? lc.referral.submitting : lc.referral.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
