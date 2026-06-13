import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Tag,
  Calendar,
  Clock,
  History,
  CheckCircle2,
  Pencil,
  LogOut,
  MessageCircle,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCategories } from '@/hooks/useCategories'
import { apiFetch, apiJson } from '@/lib/apiClient'
import { formatDate } from '@/utils/helpers'
import VolunteerLayout from '@/components/volunteer-app/VolunteerLayout'
import { ErrorState, EmptyState, StatusBadge } from '@/components/admin/AdminUI'

interface AssignedItem {
  id: string
  title?: string
  category?: string
  description?: string
  status?: string
  urgency?: string
  deadline?: string | null
  createdAt?: string
  wasPreviouslyTaken?: boolean
}

interface AssignedResponse {
  items: AssignedItem[]
}

export default function VolunteerAssignedPage() {
  const { t, lang } = useLanguage()
  const v = t.volunteerApp
  const a = v.assigned
  const statusLabels = t.lifecycle.statusLabels as Record<string, string>
  // Bilingual category labels from the admin-managed taxonomy.
  const { labelFor } = useCategories()

  const [items, setItems] = useState<AssignedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Per-card UI state.
  const [editing, setEditing] = useState<string | null>(null)
  const [dropping, setDropping] = useState<string | null>(null)
  const [editUrgency, setEditUrgency] = useState('medium')
  const [editDeadline, setEditDeadline] = useState('')
  // Free-text hand-off report; the backend dropSchema expects optional strings.
  const [report, setReport] = useState({ done: '', reached: '', stuck: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson<AssignedResponse>('/api/volunteer/assigned')
      setItems(res.items ?? [])
    } catch {
      setError(v.ui.loadError)
    } finally {
      setLoading(false)
    }
  }, [v.ui.loadError])

  useEffect(() => {
    load()
  }, [load])

  const openEdit = (item: AssignedItem) => {
    setDropping(null)
    setEditing(item.id)
    setEditUrgency(item.urgency ?? 'medium')
    setEditDeadline(item.deadline ? item.deadline.slice(0, 10) : '')
  }

  const openDrop = (item: AssignedItem) => {
    setEditing(null)
    setDropping(item.id)
    setReport({ done: '', reached: '', stuck: '' })
  }

  const saveEdit = async (id: string) => {
    setBusy(id)
    setNotice(null)
    try {
      const res = await apiFetch(`/api/volunteer/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          urgency: editUrgency,
          deadline: editDeadline || undefined,
        }),
      })
      if (!res.ok) throw new Error('patch failed')
      setNotice({ kind: 'ok', text: a.saved })
      setEditing(null)
      await load()
    } catch {
      setNotice({ kind: 'err', text: a.saveError })
    } finally {
      setBusy(null)
    }
  }

  const markDone = async (id: string) => {
    setBusy(id)
    setNotice(null)
    try {
      const res = await apiFetch(`/api/requests/${id}/done`, { method: 'POST' })
      if (!res.ok) throw new Error('done failed')
      setNotice({ kind: 'ok', text: a.doneSuccess })
      await load()
    } catch {
      setNotice({ kind: 'err', text: a.doneError })
    } finally {
      setBusy(null)
    }
  }

  const submitDrop = async (id: string) => {
    const done = report.done.trim()
    const reached = report.reached.trim()
    const stuck = report.stuck.trim()
    if (!done && !reached && !stuck) {
      setNotice({ kind: 'err', text: a.dropNeedReport })
      return
    }
    setBusy(id)
    setNotice(null)
    try {
      const res = await apiFetch(`/api/volunteer/requests/${id}/drop`, {
        method: 'POST',
        body: JSON.stringify({
          ...(done && { done }),
          ...(reached && { reached }),
          ...(stuck && { stuck }),
        }),
      })
      if (!res.ok) throw new Error('drop failed')
      setNotice({ kind: 'ok', text: a.dropSuccess })
      setDropping(null)
      await load()
    } catch {
      setNotice({ kind: 'err', text: a.dropError })
    } finally {
      setBusy(null)
    }
  }

  // Native min for the deadline picker: blocks past dates in the browser UI
  // (and surfaces the browser's own localized validity message) without
  // needing an app-level error string.
  const today = new Date().toISOString().slice(0, 10)

  const urgencyTone = (u?: string) =>
    u === 'high' ? 'badge-red' : u === 'medium' ? 'badge-amber' : 'badge-gray'

  const urgencyLabel = (u?: string) =>
    u === 'high' ? a.urgencyHigh : u === 'medium' ? a.urgencyMedium : a.urgencyLow

  const renderBody = () => {
    if (error) {
      return <ErrorState message={error} onRetry={load} retryLabel={v.ui.retry} />
    }
    if (loading) {
      return (
        <div className="volapp-card-grid" aria-busy="true">
          {[0, 1].map((i) => (
            <div className="card volapp-req-card" key={i}>
              <span className="skeleton skeleton-line" style={{ width: '60%' }} aria-hidden="true" />
              <span className="skeleton skeleton-line" style={{ width: '85%' }} aria-hidden="true" />
            </div>
          ))}
        </div>
      )
    }
    if (items.length === 0) {
      return <EmptyState title={a.empty} />
    }

    return (
      <div className="volapp-card-grid">
        {items.map((item) => {
          const isEditing = editing === item.id
          const isDropping = dropping === item.id
          const isBusy = busy === item.id
          return (
            <article key={item.id} className="card volapp-req-card">
              <div className="volapp-req-head">
                <h3 className="volapp-req-title">{item.title || labelFor(item.category)}</h3>
                {item.status && (
                  <StatusBadge
                    status={item.status}
                    label={statusLabels[item.status] ?? item.status}
                  />
                )}
              </div>

              <div className="volapp-badges">
                {item.urgency && (
                  <span className={`badge ${urgencyTone(item.urgency)}`}>
                    <Clock size={13} aria-hidden="true" />
                    {urgencyLabel(item.urgency)}
                  </span>
                )}
                {item.category && (
                  <span className="badge badge-blue">
                    <Tag size={13} aria-hidden="true" />
                    {labelFor(item.category)}
                  </span>
                )}
                {item.wasPreviouslyTaken && (
                  <span className="badge badge-amber">
                    <History size={13} aria-hidden="true" />
                    {a.previouslyTaken}
                  </span>
                )}
              </div>

              {item.description && <p className="volapp-req-desc">{item.description}</p>}

              <dl className="volapp-meta">
                <div className="volapp-meta-row">
                  <dt><Calendar size={13} aria-hidden="true" /> {a.deadline}</dt>
                  <dd className="volapp-deadline-val">
                    {item.deadline ? formatDate(item.deadline, lang) : v.ui.noDeadline}
                  </dd>
                </div>
              </dl>

              {/* ── Edit form ─────────────────────────────────── */}
              {isEditing && (
                <form
                  className="volapp-edit-form"
                  aria-label={a.editTitle}
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveEdit(item.id)
                  }}
                >
                  <h4 className="volapp-subhead">{a.editTitle}</h4>
                  <label className="form-label" htmlFor={`urg-${item.id}`}>{a.urgency}</label>
                  <select
                    id={`urg-${item.id}`}
                    name="urgency"
                    autoComplete="off"
                    className="form-select"
                    value={editUrgency}
                    onChange={(e) => setEditUrgency(e.target.value)}
                  >
                    <option value="low">{a.urgencyLow}</option>
                    <option value="medium">{a.urgencyMedium}</option>
                    <option value="high">{a.urgencyHigh}</option>
                  </select>
                  <label className="form-label" htmlFor={`dl-${item.id}`}>{a.deadline}</label>
                  <input
                    id={`dl-${item.id}`}
                    name="deadline"
                    type="date"
                    inputMode="numeric"
                    autoComplete="off"
                    min={today}
                    className="form-input"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                  />
                  <div className="volapp-card-actions">
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={isBusy}
                    >
                      {a.save}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setEditing(null)}
                    >
                      {v.ui.cancel}
                    </button>
                  </div>
                </form>
              )}

              {/* ── Drop / self-report form ───────────────────── */}
              {isDropping && (
                <form
                  className="volapp-edit-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    submitDrop(item.id)
                  }}
                >
                  <fieldset className="volapp-fieldset">
                    <legend className="volapp-subhead">{a.dropTitle}</legend>
                    <p className="volapp-panel-sub">{a.dropSubtitle}</p>
                    <label className="form-label" htmlFor={`drop-done-${item.id}`}>{a.dropDone}</label>
                    <textarea
                      id={`drop-done-${item.id}`}
                      name="done"
                      className="form-textarea"
                      rows={2}
                      maxLength={4000}
                      value={report.done}
                      onChange={(e) => setReport((r) => ({ ...r, done: e.target.value }))}
                    />
                    <label className="form-label" htmlFor={`drop-reached-${item.id}`}>{a.dropReached}</label>
                    <textarea
                      id={`drop-reached-${item.id}`}
                      name="reached"
                      className="form-textarea"
                      rows={2}
                      maxLength={4000}
                      value={report.reached}
                      onChange={(e) => setReport((r) => ({ ...r, reached: e.target.value }))}
                    />
                    <label className="form-label" htmlFor={`drop-stuck-${item.id}`}>{a.dropStuck}</label>
                    <textarea
                      id={`drop-stuck-${item.id}`}
                      name="stuck"
                      className="form-textarea"
                      rows={2}
                      maxLength={4000}
                      value={report.stuck}
                      onChange={(e) => setReport((r) => ({ ...r, stuck: e.target.value }))}
                    />
                  </fieldset>
                  <div className="volapp-card-actions">
                    <button
                      type="submit"
                      className="btn btn-danger btn-sm"
                      disabled={isBusy}
                    >
                      {a.dropSubmit}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setDropping(null)}
                    >
                      {v.ui.cancel}
                    </button>
                  </div>
                </form>
              )}

              {/* ── Default actions ───────────────────────────── */}
              {!isEditing && !isDropping && (
                <>
                  {/* Once the request is awaiting_review the "Mark done" action is
                      gone and the mutual-consent close lives in the request
                      chat. Surface that here so the volunteer is not left on a
                      card that looks stuck — they can finish the close from the
                      same surface where they marked it done. */}
                  {item.status === 'awaiting_review' && (
                    <p className="volapp-panel-sub" role="status">
                      {a.awaitingClose}
                    </p>
                  )}
                  <div className="volapp-card-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      {a.editTitle}
                    </button>
                    {item.status === 'in_progress' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isBusy}
                        onClick={() => markDone(item.id)}
                      >
                        <CheckCircle2 size={15} aria-hidden="true" />
                        {a.markDone}
                      </button>
                    )}
                    {/* Link into the request chat where the propose/approve-close
                        handshake (and the beneficiary's close proposal) lives.
                        Shown for the volunteer's actionable states; resolved via
                        ?requestId= by ChatListPage (same convention as
                        MyRequestsPage). */}
                    {(item.status === 'in_progress' || item.status === 'awaiting_review') && (
                      <Link
                        href={`/chats?requestId=${encodeURIComponent(item.id)}`}
                        className="btn btn-outline btn-sm"
                        aria-label={a.openChat}
                      >
                        <MessageCircle size={15} aria-hidden="true" />
                        {a.openChat}
                      </Link>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => openDrop(item)}
                    >
                      <LogOut size={15} aria-hidden="true" />
                      {a.drop}
                    </button>
                  </div>
                </>
              )}
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <VolunteerLayout title={a.title} subtitle={a.subtitle}>
      {notice && (
        <p
          className={`volapp-inline-msg${notice.kind === 'err' ? ' is-error' : ''}`}
          role={notice.kind === 'err' ? 'alert' : 'status'}
          aria-live={notice.kind === 'err' ? 'assertive' : 'polite'}
        >
          {notice.text}
        </p>
      )}
      {renderBody()}
    </VolunteerLayout>
  )
}
