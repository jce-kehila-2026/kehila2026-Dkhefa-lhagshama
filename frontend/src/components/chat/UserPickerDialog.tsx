import { useEffect, useId, useMemo, useState } from 'react'
import { MessagesSquare, UserPlus } from 'lucide-react'

import { useLanguage } from '../../contexts/LanguageContext'
import { apiJson } from '../../lib/apiClient'
import styles from './UserPickerDialog.module.css'

/**
 * Admin user picker (feedback round 2): a searchable multi-select over
 * GET /api/admin/users, used to start a direct (staff/group) chat from /chats
 * and to add participants from the chat window rail. Admin-only by data
 * source — the endpoint 403s for everyone else, so callers gate on role.
 *
 * Follows the CreateTaskDialog overlay pattern (confirm-overlay + confirm-box)
 * with simple filter input + checkbox rows (existing form classes).
 */

/** A user row as returned by GET /api/admin/users (only what we read). */
interface PickerUser {
  uid: string
  displayName?: string | null
  email?: string | null
  disabled?: boolean
}

interface UserPickerDialogProps {
  open: boolean
  /** Dialog heading (bilingual via t.*). */
  heading: string
  /** Primary action label / its busy variant. */
  confirmLabel: string
  busyLabel: string
  /** True while the parent is submitting (create chat / add people). */
  busy?: boolean
  /** Submit error from the parent, shown under the list. */
  error?: string | null
  /** Uids hidden from the list (self, existing participants). */
  excludeUids?: string[]
  /** Show the optional chat-title input (new-chat flow only). */
  withTitleField?: boolean
  onConfirm: (uids: string[], title: string) => void
  onClose: () => void
}

export default function UserPickerDialog({
  open,
  heading,
  confirmLabel,
  busyLabel,
  busy = false,
  error = null,
  excludeUids,
  withTitleField = false,
  onConfirm,
  onClose,
}: UserPickerDialogProps) {
  const { t } = useLanguage()
  const c = t.chat
  const headingId = useId()

  const [users, setUsers] = useState<PickerUser[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [minOneError, setMinOneError] = useState(false)

  // Load the user roster each time the dialog opens (fresh + simple).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setSearch('')
    setSelected([])
    setTitle('')
    setMinOneError(false)
    apiJson<{ items?: PickerUser[] }>('/api/admin/users?limit=200')
      .then((res) => {
        if (cancelled) return
        setUsers((res.items ?? []).filter((u) => u && typeof u.uid === 'string'))
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // Esc closes (matches ConfirmDialog behaviour).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  const excluded = useMemo(() => new Set(excludeUids ?? []), [excludeUids])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (excluded.has(u.uid) || u.disabled) return false
      if (!q) return true
      const name = (u.displayName ?? '').toLowerCase()
      const email = (u.email ?? '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [users, search, excluded])

  if (!open) return null

  const toggle = (uid: string) => {
    setMinOneError(false)
    setSelected((prev) =>
      prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid],
    )
  }

  const submit = () => {
    if (selected.length === 0) {
      setMinOneError(true)
      return
    }
    onConfirm(selected, title.trim())
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <div
      className="confirm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="confirm-box chat-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <span className="confirm-icon confirm-icon--default" aria-hidden="true">
          {withTitleField ? <MessagesSquare size={22} /> : <UserPlus size={22} />}
        </span>
        <h2 id={headingId} className="confirm-title">
          {heading}
        </h2>

        {withTitleField && (
          <div className={`field ${styles.fieldStart}`}>
            <label className="form-label" htmlFor={`${headingId}-title`}>
              {c.newChatTitleLabel}
            </label>
            <input
              id={`${headingId}-title`}
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={c.newChatTitlePH}
              maxLength={120}
              disabled={busy}
            />
          </div>
        )}

        <div className={`field ${styles.fieldStart}`} style={{ marginBlockStart: withTitleField ? 'var(--sp-3)' : 0 }}>
          <label className="form-label" htmlFor={`${headingId}-search`}>
            {c.newChatMembersLabel}
          </label>
          <input
            id={`${headingId}-search`}
            className="form-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={c.newChatSearchPH}
            disabled={busy || loading}
          />

          {loading ? (
            <ul className="chat-user-list" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="chat-user-option">
                  <span className={`skeleton skeleton-line ${styles.skeletonLine}`} />
                </li>
              ))}
            </ul>
          ) : loadError ? (
            <p className="chat-picker-note" role="alert">
              {c.newChatLoadError}
            </p>
          ) : visible.length === 0 ? (
            <p className="chat-picker-note">{c.newChatNoUsers}</p>
          ) : (
            <ul className="chat-user-list">
              {visible.map((u) => {
                const name = (u.displayName ?? '').trim() || u.email || u.uid
                const sub = u.displayName && u.email ? u.email : null
                return (
                  <li key={u.uid}>
                    <label className="chat-user-option">
                      <input
                        type="checkbox"
                        checked={selected.includes(u.uid)}
                        onChange={() => toggle(u.uid)}
                        disabled={busy}
                      />
                      <span className="chat-user-option__meta">
                        <span className="chat-user-option__name">{name}</span>
                        {sub && <span className="chat-user-option__sub">{sub}</span>}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {(minOneError || error) && (
          <p role="alert" className={styles.errorNote}>
            {minOneError ? c.newChatMinOne : error}
          </p>
        )}

        <div className="confirm-actions">
          <button type="button" className="btn btn-outline" onClick={close} disabled={busy}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className={`btn btn-primary${busy ? ' is-loading' : ''}`}
            onClick={submit}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
