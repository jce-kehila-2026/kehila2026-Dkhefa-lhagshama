import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import { StatusBadge, ErrorState } from '@/components/admin/AdminUI'

const STATUSES = ['pending', 'in_progress', 'resolved', 'rejected', 'closed']

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

  const post = async (path, body) => {
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`/api/admin/requests/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      await load()
      return true
    } catch {
      setError(a.ui.loading)
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = () => {
    if (assignTo) post('assign', { volunteerId: assignTo })
  }
  const handleStatus = () => {
    if (statusVal) post('status', { status: statusVal })
  }
  const handleNote = async () => {
    const trimmed = note.trim()
    if (!trimmed) return
    const ok = await post('note', { note: trimmed })
    if (ok) setNote('')
  }

  const fmt = (ts) => {
    if (!ts) return '—'
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US')
  }

  const fullName = request
    ? [request.firstName, request.lastName].filter(Boolean).join(' ')
    : ''

  return (
    <AdminLayout title={a.reqDetail.title}>
      <Link href="/admin/requests" className="admin-back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        {a.reqDetail.back}
      </Link>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}
      {loading && <p className="admin-muted">{a.ui.loading}</p>}

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
                <dd>{request.category || '—'}</dd>
              </div>
              <div>
                <dt>{a.reqDetail.city}</dt>
                <dd>{request.city || '—'}</dd>
              </div>
              <div>
                <dt>{a.reqDetail.assignedTo}</dt>
                <dd>{request.assignedVolunteerId || a.reqDetail.unassigned}</dd>
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
                onChange={(e) => setAssignTo(e.target.value)}
              >
                <option value="">{a.reqDetail.chooseVol}</option>
                {volunteers.map((v) => (
                  <option key={v.uid} value={v.uid}>
                    {v.fullName || v.uid}
                  </option>
                ))}
              </select>
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
