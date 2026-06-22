/**
 * AdminChatsPage — the /admin/chats oversight console (feedback round 2).
 *
 * Lists every conversation on the platform (request-bound chats + direct staff
 * chats) in one admin-only table, fed by GET /api/admin/chats. Per row an admin
 * can OPEN the chat read-only (/chats/:id) and pause/resume it via a confirmed
 * PATCH /api/admin/chats/:id { active }. Collaborates with AdminLayout (shell),
 * the shared AdminUI primitives (cards/badges/states), ConfirmDialog (gated
 * toggle), and i18n through t.admin.chats. Renders inside pages/admin/chats.tsx.
 *
 * Invariant: resume can be refused by the backend (409 request_terminal) when
 * the linked request has ended, so the UI surfaces that as a distinct reason.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { MessagesSquare, MessageCircle, ExternalLink, PauseCircle, PlayCircle } from 'lucide-react'

import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import { formatDate } from '@/utils/helpers'
import { formatRequestRef } from '@/lib/requestRef'
import AdminLayout from '@/components/admin/AdminLayout'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import Reveal from '../../components/motion/Reveal'
import {
  StatCard,
  StatusBadge,
  EmptyState,
  ErrorState,
  TableSkeleton,
  adminErrorMessage,
} from '@/components/admin/AdminUI'
import type { ChatKind } from '@/types'
import styles from './AdminChatsPage.module.css'

// A chat row as returned by GET /api/admin/chats (only what this screen reads).
interface AdminChatRow {
  id: string
  kind: ChatKind
  title: string | null
  requestId: string | null
  requestDisplayId: string | null
  active: boolean
  lastMessageAt: string | null
  createdAt: string | null
  participants: { uid: string; displayName: string }[]
}

/** Truncated participant names: first three, then a "+N" overflow tag. */
function participantSummary(row: AdminChatRow): string {
  const names = row.participants.map(
    (p) => (p.displayName && p.displayName.trim()) || p.uid.slice(0, 6),
  )
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`
}

/** Friendly reference for a request-bound row (WS-3); '' for direct chats. */
function requestRef(row: AdminChatRow): string {
  return row.requestId
    ? formatRequestRef({ displayId: row.requestDisplayId, id: row.requestId })
    : ''
}

/**
 * Default-exported screen for /admin/chats. Owns the row list + load/error/busy
 * state, derives the summary metrics, and routes the pause/resume action through
 * ConfirmDialog. Opening a chat is read-only here; an admin joins as a
 * participant from the chat window itself before they can post.
 */
export default function AdminChatsPage() {
  const { t, lang } = useLanguage()
  const a = t.admin
  const cc = a.chats

  const [items, setItems] = useState<AdminChatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // The pause/resume toggle goes through a branded confirm dialog.
  const [confirmTarget, setConfirmTarget] = useState<AdminChatRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = (await apiJson('/api/admin/chats')) as { items?: AdminChatRow[] }
      setItems(res.items || [])
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => {
    load()
  }, [load])

  const toggleActive = async (row: AdminChatRow) => {
    setBusyId(row.id)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/chats/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !row.active }),
      })
      if (!res.ok) {
        // A 409 'request_terminal' means resume was blocked because the linked
        // request has ended (closed/rejected/referred). Show a dedicated reason
        // instead of the generic toggle-error so the admin understands why and
        // does not retry blindly.
        if (res.status === 409) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          setError(body?.error === 'request_terminal' ? cc.resumeTerminalError : cc.toggleError)
          return
        }
        setError(cc.toggleError)
        return
      }
      await load()
    } catch {
      setError(cc.toggleError)
    } finally {
      setBusyId(null)
      setConfirmTarget(null)
    }
  }

  // Summary-strip metrics, derived from the loaded rows (no separate request).
  const total = items.length
  const activeCount = items.filter((r) => r.active).length
  const pausedCount = items.filter((r) => !r.active).length
  const directCount = items.filter((r) => r.kind === 'direct').length

  // Human label for the confirm dialog: prefer an explicit title, else the
  // request ref for request chats, else the participant summary for direct ones.
  const confirmName =
    confirmTarget?.title ||
    (confirmTarget?.requestId
      ? `${cc.kindRequest} ${requestRef(confirmTarget)}`
      : confirmTarget
        ? participantSummary(confirmTarget)
        : '')

  return (
    <AdminLayout title={cc.title} subtitle={cc.subtitle}>
      {/* ── Summary strip — a calm metric row before the table ────────── */}
      {!loading && !error && items.length > 0 && (
        <Reveal>
          <div className={styles.summaryStrip}>
            <StatCard label={cc.title} value={total} icon={MessagesSquare} />
            <StatCard label={cc.statusActive} value={activeCount} tone="green" icon={MessageCircle} />
            <StatCard label={cc.statusPaused} value={pausedCount} tone="default" icon={PauseCircle} />
            <StatCard label={cc.kindDirect} value={directCount} tone="blue" icon={MessagesSquare} />
          </div>
        </Reveal>
      )}

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : items.length === 0 ? (
        <EmptyState icon={MessagesSquare} title={cc.empty} message={cc.emptyHint} />
      ) : (
        <Reveal delay={0.05}>
          <div className={`card ${styles.tableCard}`}>
            <div className={`admin-table-wrap ${styles.tableWrap}`}>
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>{cc.colKind}</th>
                    <th>{cc.colTitle}</th>
                    <th>{cc.colParticipants}</th>
                    <th>{cc.colLastMessage}</th>
                    <th>{cc.colStatus}</th>
                    <th className="admin-table-actions-col">{a.ui.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const busy = busyId === row.id
                    return (
                      <tr
                        key={row.id}
                        aria-busy={busy || undefined}
                        className={styles.row}
                        style={{ opacity: busy ? 0.55 : 1 }}
                      >
                        <td data-label={cc.colKind}>
                          <span className={`badge ${row.kind === 'direct' ? 'badge-ember' : 'badge-blue'}`}>
                            <span className="badge-dot" aria-hidden="true" />
                            {row.kind === 'direct' ? cc.kindDirect : cc.kindRequest}
                          </span>
                        </td>
                        <td data-label={cc.colTitle}>
                          {row.kind === 'request' && row.requestId ? (
                            // Deep link into the request the chat belongs to.
                            <Link
                              href={`/admin/requests/${row.requestId}`}
                              className="admin-chat-reqlink"
                            >
                              {requestRef(row)}
                            </Link>
                          ) : (
                            <span>{row.title || cc.untitled}</span>
                          )}
                        </td>
                        <td data-label={cc.colParticipants}>
                          <span className="admin-chat-people" title={participantSummary(row)}>
                            {participantSummary(row)}
                          </span>
                        </td>
                        <td data-label={cc.colLastMessage}>
                          {row.lastMessageAt ? formatDate(row.lastMessageAt, lang) : '-'}
                        </td>
                        <td data-label={cc.colStatus}>
                          <StatusBadge
                            status={row.active ? 'active' : 'inactive'}
                            label={row.active ? cc.statusActive : cc.statusPaused}
                          />
                        </td>
                        <td data-label={a.ui.actions}>
                          <div className="admin-row-actions">
                            <Link href={`/chats/${row.id}`} className="btn btn-ghost btn-sm">
                              <ExternalLink size={14} aria-hidden="true" />
                              {cc.open}
                            </Link>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={busy}
                              onClick={() => setConfirmTarget(row)}
                              aria-label={`${row.active ? cc.pause : cc.resume}: ${row.title || requestRef(row) || row.id}`}
                            >
                              {row.active ? (
                                <PauseCircle size={14} aria-hidden="true" />
                              ) : (
                                <PlayCircle size={14} aria-hidden="true" />
                              )}
                              {row.active ? cc.pause : cc.resume}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        variant={confirmTarget?.active ? 'danger' : 'default'}
        title={confirmTarget?.active ? cc.pauseConfirmTitle : cc.resumeConfirmTitle}
        message={
          confirmName
            ? `${confirmName}: ${confirmTarget?.active ? cc.pauseConfirmBody : cc.resumeConfirmBody}`
            : confirmTarget?.active
              ? cc.pauseConfirmBody
              : cc.resumeConfirmBody
        }
        confirmLabel={confirmTarget?.active ? cc.pause : cc.resume}
        cancelLabel={t.common.cancel}
        busy={!!confirmTarget && busyId === confirmTarget.id}
        onConfirm={() => {
          if (confirmTarget) toggleActive(confirmTarget)
        }}
        onCancel={() => {
          if (!busyId) setConfirmTarget(null)
        }}
      />
    </AdminLayout>
  )
}
