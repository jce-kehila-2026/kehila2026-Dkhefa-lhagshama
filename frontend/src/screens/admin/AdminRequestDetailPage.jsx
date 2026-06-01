import { useEffect, useState, useCallback, useMemo } from 'react'
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
  RefreshCw,
  StickyNote,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import { StatusBadge, ErrorState } from '@/components/admin/AdminUI'
import Reveal from '../../components/motion/Reveal'

const STATUSES = ['pending', 'in_progress', 'resolved', 'rejected', 'closed']

// Normalize a language token to a comparable lowercase code (e.g. 'Hebrew' →
// 'he' is out of scope; we compare the raw stored codes like 'he'/'am'/'en').
function normLang(v) {
  return String(v ?? '').trim().toLowerCase()
}

function eventLabel(ev, a) {
  switch (ev.type) {
    case 'assigned':
      return `${a.reqDetail.assign}: ${ev.details && ev.details.volunteerId ? ev.details.volunteerId : ''}`
    case 'status_changed':
      return `${a.reqDetail.changeStatus}: ${
        (ev.details && a.statusLabels[ev.details.to]) || (ev.details && ev.details.to) || ''
      }`
    case 'note_added':
      return (ev.details && ev.details.note) || a.reqDetail.addNote
    default:
      return ev.type
  }
}

// A meta cell in the request summary: a labelled value with a quiet icon.
// Declared at module scope (not inside render) so it never remounts.
function MetaCell({ icon: Icon, label, children }) {
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
const EYEBROW = {
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

export default function AdminRequestDetailPage() {
  const { t, lang, isRTL } = useLanguage()
  const a = t.admin
  const router = useRouter()
  const { id } = router.query
  const BackArrow = isRTL ? ArrowRight : ArrowLeft

  const [request, setRequest] = useState(null)
  const [volunteers, setVolunteers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [assignTo, setAssignTo] = useState('')
  const [statusVal, setStatusVal] = useState('pending')
  const [note, setNote] = useState('')
  const [dismissedFormer, setDismissedFormer] = useState(false)
  const [dismissedLangWarn, setDismissedLangWarn] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [reqData, volData] = await Promise.all([
        apiJson(`/api/admin/requests/${id}`),
        apiJson('/api/admin/volunteers'),
      ])
      setRequest(reqData)
      setStatusVal(reqData.status || 'pending')
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
  const post = async (path, body, onError) => {
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/requests/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let payload = null
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
  // #92 — surface forward-only / concurrent-update failures clearly.
  const handleStatus = () => {
    if (!statusVal) return
    post('status', { status: statusVal }, (status, payload) => {
      if (status === 409) {
        // invalid_transition (backward move) vs concurrent_update (stale write)
        return payload && payload.error === 'invalid_transition'
          ? a.reqDetail.statusBackwardError
          : a.reqDetail.statusConflictError
      }
      return a.reqDetail.statusGenericError
    })
  }
  const handleNote = async () => {
    const trimmed = note.trim()
    if (!trimmed) return
    const ok = await post('note', { note: trimmed })
    if (ok) setNote('')
  }

  const EMPTY = '·' // middle dot placeholder for missing values

  const fmt = (ts) => {
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
                <StatusBadge
                  status={request.status}
                  label={a.statusLabels[request.status] || request.status}
                />
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
                  {request.category || EMPTY}
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
                  onClick={handleAssign}
                >
                  {a.reqDetail.assignBtn}
                </button>
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
                  htmlFor="status"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
                >
                  <RefreshCw size={15} aria-hidden="true" style={{ color: 'var(--ember)' }} />
                  {a.reqDetail.changeStatus}
                </label>
                <select
                  id="status"
                  className="form-select"
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {a.statusLabels[s]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline admin-side-btn"
                  disabled={saving}
                  onClick={handleStatus}
                >
                  {a.reqDetail.updateStatus}
                </button>
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
    </AdminLayout>
  )
}
