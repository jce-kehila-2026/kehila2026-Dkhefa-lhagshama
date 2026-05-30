import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import { StatusBadge, ErrorState } from '@/components/admin/AdminUI'

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

export default function AdminRequestDetailPage() {
  const { t, lang } = useLanguage()
  const a = t.admin
  const router = useRouter()
  const { id } = router.query

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
      <Link href="/admin/requests" className="admin-back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {a.reqDetail.back}
      </Link>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}
      {loading && <p className="admin-muted">{a.ui.loading}</p>}

      {/* #91 — assigned volunteer was deactivated; prompt reassignment */}
      {!loading && request && isFormerVolunteer && !dismissedFormer && (
        <div className="admin-notice admin-notice-warn" role="alert">
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
        <div className="admin-detail-grid">
          <section className="card admin-detail-main">
            <div className="admin-detail-head">
              <h2 className="admin-detail-title">{fullName || request.id}</h2>
              <StatusBadge
                status={request.status}
                label={a.statusLabels[request.status] || request.status}
              />
            </div>
            <p className="admin-detail-desc">{request.description}</p>

            <dl className="admin-detail-meta">
              <div>
                <dt>{a.reqDetail.category}</dt>
                <dd>{request.category || EMPTY}</dd>
              </div>
              <div>
                <dt>{a.reqDetail.city}</dt>
                <dd>{request.city || EMPTY}</dd>
              </div>
              <div>
                <dt>{a.reqDetail.assignedTo}</dt>
                <dd>
                  {assignedLabel}
                  {isFormerVolunteer && (
                    <span className="former-tag">{a.reqDetail.formerTag}</span>
                  )}
                </dd>
              </div>
            </dl>

            <h3 className="admin-section-title">{a.reqDetail.timeline}</h3>
            {request.events && request.events.length > 0 ? (
              <ul className="admin-timeline">
                {request.events.map((ev) => (
                  <li key={ev.id} className="admin-timeline-item">
                    <span className="admin-timeline-msg">{eventLabel(ev, a)}</span>
                    <time className="admin-timeline-time">{fmt(ev.createdAt)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-muted">{a.reqDetail.noEvents}</p>
            )}
          </section>

          <aside className="card admin-detail-side">
            <div className="field">
              <label className="form-label" htmlFor="assign">
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
                <div className="admin-notice admin-notice-warn" role="status">
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

            <div className="field">
              <label className="form-label" htmlFor="status">
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

            <div className="field">
              <label className="form-label" htmlFor="note">
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
      )}
    </AdminLayout>
  )
}
