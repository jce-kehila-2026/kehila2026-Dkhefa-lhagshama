/**
 * AdminVolunteersPage — admin console screen for the volunteer roster (UC-05).
 *
 * Loads GET /api/admin/volunteers once and renders three things off that one
 * payload: live queue counts, a category-permission approval list (req 15),
 * and a tabbed table that switches between the Active roster and the Pending
 * application queue. Admins approve/reject applications, deactivate active
 * volunteers, and grant/deny per-category permissions from here; Active rows
 * drill into /admin/volunteers/[uid]. Client-side search + a ?tab= deep-link
 * (WS-9) refine the view. Bilingual (HE/EN) via useLanguage; category labels
 * come from the admin-managed taxonomy (useCategories).
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { HeartHandshake, Clock, CheckCircle2, Check, X, Search } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCategories } from '@/hooks/useCategories'
import { apiJson, apiFetch } from '@/lib/apiClient'
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
import styles from './AdminVolunteersPage.module.css'

// A volunteer row as returned by GET /api/admin/volunteers (pending/active).
// Loose by design — only the fields this screen reads are declared.
interface VolunteerRow {
  id: string
  uid?: string
  fullName?: string
  email?: string
  [key: string]: unknown
}

type VolunteerTab = 'pending' | 'active'

// A pending category-permission request (req 15), flattened across volunteers.
interface CatReqRow {
  uid: string
  fullName?: string | null
  category: string
  note?: string
  requestedAt?: string | null
}

// A small two-letter monogram derived from a volunteer's display name —
// purely presentational identity cue beside the name column.
function initials(name: string | undefined | null): string {
  if (!name) return '·'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  const first = parts[0][0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : ''
  return (first + last).toUpperCase()
}

export default function AdminVolunteersPage() {
  const { t, lang } = useLanguage()
  const a = t.admin
  // Bilingual category labels from the admin-managed taxonomy (permission badge).
  const { labelFor } = useCategories()
  const [tab, setTab] = useState<VolunteerTab>('active') // 'pending' | 'active' — WS-9 defaults to Active
  const [data, setData] = useState<{ pending: VolunteerRow[]; active: VolunteerRow[]; categoryRequests: CatReqRow[] }>({ pending: [], active: [], categoryRequests: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyCat, setBusyCat] = useState<string | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<{ uid?: string; name: string } | null>(null)
  const [query, setQuery] = useState('') // WS-9 client-side search (name + email)

  // WS-9 — honour a ?tab=active|pending deep-link (e.g. the dashboard KPI
  // "active volunteers" link). Runs once on mount; invalid values are ignored
  // so the Active default stands.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('tab')
    if (param === 'pending' || param === 'active') setTab(param)
  }, [])

  // Fetch the full roster payload (pending + active + categoryRequests) in one
  // call; re-bound on lang so error messages localize. All mutations call this
  // again to refresh rather than patching local state.
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson('/api/admin/volunteers') as { pending?: VolunteerRow[]; active?: VolunteerRow[]; categoryRequests?: CatReqRow[] }
      setData({ pending: res.pending || [], active: res.active || [], categoryRequests: res.categoryRequests || [] })
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setLoading(false)
    }
  }, [lang])

  // Approve / reject a volunteer's category-permission request (req 15).
  const actCategory = async (uid: string, category: string, action: 'approve' | 'reject') => {
    const key = `${uid}:${category}`
    setBusyCat(key)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/volunteers/${uid}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw { status: res.status, error: body?.error, detail: body }
      }
      await load()
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setBusyCat(null)
    }
  }

  useEffect(() => {
    load()
  }, [load])

  // Apply a roster lifecycle action via POST /api/admin/volunteers/:id/:action
  // (approve | reject on pending docs, keyed by row id; deactivate on active
  // rows, keyed by uid). busyId disables that row's buttons while in flight.
  const act = async (id: string | undefined, action: string) => {
    setBusyId(id ?? null)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/volunteers/${id}/${action}`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw { status: res.status, error: body?.error, detail: body }
      }
      await load()
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setBusyId(null)
    }
  }

  // Visible rows: pick the active tab's list, then narrow by the search box
  // (name/uid + email, case-insensitive). Empty query short-circuits to the
  // full list so we don't allocate a new array every render.
  const baseRows = tab === 'pending' ? data.pending : data.active
  const q = query.trim().toLowerCase()
  const rows = useMemo(() => {
    if (!q) return baseRows
    return baseRows.filter((v) => {
      const name = String(v.fullName || v.uid || '').toLowerCase()
      const email = String(v.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [baseRows, q])

  return (
    <AdminLayout title={a.vol.title} subtitle={a.vol.subtitle}>
      {/* ── Summary band: live counts for each queue (sole home for the counts) ── */}
      <Reveal>
        <div className="admin-vol-summary">
          <StatCard
            label={a.vol.filterPending}
            value={data.pending.length}
            loading={loading}
            tone="amber"
            icon={Clock}
          />
          <StatCard
            label={a.vol.filterActive}
            value={data.active.length}
            loading={loading}
            tone="green"
            icon={CheckCircle2}
          />
        </div>
      </Reveal>

      {/* ── Category permission requests (req 15) ───────────────────────────── */}
      {data.categoryRequests.length > 0 && (
        <Reveal>
          <div className="admin-vol-catreq">
            <h2 className="admin-vol-catreq-title">{a.catReq.heading}</h2>
            <p className="admin-vol-catreq-sub">{a.catReq.subtitle}</p>
            <div className="admin-vol-catreq-list">
              {data.categoryRequests.map((c) => {
                const key = `${c.uid}:${c.category}`
                const who = c.fullName || c.uid
                return (
                  <div key={key} className="admin-vol-catreq-item">
                    <span className="admin-vol-catreq-name">{who}</span>
                    <span className="badge badge-ember">{labelFor(c.category)}</span>
                    {c.note && (
                      <span className="admin-vol-catreq-note">“{c.note}”</span>
                    )}
                    <div className="admin-row-actions admin-vol-catreq-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm admin-vol-action"
                        disabled={busyCat === key}
                        aria-label={`${a.vol.approve}: ${who}, ${labelFor(c.category)}`}
                        onClick={() => actCategory(c.uid, c.category, 'approve')}
                      >
                        <Check size={15} aria-hidden="true" />
                        {a.vol.approve}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm admin-vol-action"
                        disabled={busyCat === key}
                        aria-label={`${a.vol.reject}: ${who}, ${labelFor(c.category)}`}
                        onClick={() => actCategory(c.uid, c.category, 'reject')}
                      >
                        <X size={15} aria-hidden="true" />
                        {a.vol.reject}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Reveal>
      )}

      {/* ── Toolbar card holding the segmented queue tabs ────────────────────── */}
      <div className={styles.toolbar}>
        <div
          className={`admin-filters ${styles.tabs}`}
          role="tablist"
          aria-label={a.vol.title}
        >
          <button
            type="button"
            role="tab"
            id="admin-vol-tab-pending"
            aria-controls="admin-vol-panel"
            aria-selected={tab === 'pending'}
            className={`admin-filter-tab${tab === 'pending' ? ' is-active' : ''}`}
            onClick={() => setTab('pending')}
          >
            {a.vol.filterPending}
          </button>
          <button
            type="button"
            role="tab"
            id="admin-vol-tab-active"
            aria-controls="admin-vol-panel"
            aria-selected={tab === 'active'}
            className={`admin-filter-tab${tab === 'active' ? ' is-active' : ''}`}
            onClick={() => setTab('active')}
          >
            {a.vol.filterActive}
          </button>
        </div>
        <div className={`admin-search ${styles.search}`}>
          <Search size={16} aria-hidden="true" className="admin-search-icon" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={a.vol.searchPlaceholder}
            aria-label={a.vol.searchPlaceholder}
            className="form-input admin-search-input"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {query && (
            <button
              type="button"
              className="admin-search-clear"
              aria-label={t.common.cancel}
              onClick={() => setQuery('')}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      <div
        id="admin-vol-panel"
        role="tabpanel"
        aria-labelledby={tab === 'active' ? 'admin-vol-tab-active' : 'admin-vol-tab-pending'}
      >
        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : rows.length === 0 ? (
          <Reveal>
            <EmptyState
              icon={q ? Search : HeartHandshake}
              title={q ? a.vol.noMatches : a.vol.empty}
              message={q ? undefined : a.vol.emptyHint}
            />
          </Reveal>
        ) : (
          <Reveal>
            <div className="admin-table-wrap">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>{a.vol.colName}</th>
                    <th>{a.vol.colEmail}</th>
                    <th>{a.vol.colStatus}</th>
                    <th className="admin-table-actions-col">{a.ui.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => {
                    const name = v.fullName || v.uid
                    return (
                      <tr key={v.id}>
                        <td data-label={a.vol.colName}>
                          {/* Active roster rows drill into the volunteer's
                              profile; pending applications have no roster doc
                              yet, so their name stays a plain cell. The link
                              wraps only the name cell — row action buttons
                              keep working independently. */}
                          {tab === 'active' && v.uid ? (
                            <Link
                              href={`/admin/volunteers/${v.uid}`}
                              className="admin-vol-identity admin-vol-identity--link"
                            >
                              <span className="admin-vol-avatar" aria-hidden="true">
                                {initials(name)}
                              </span>
                              <span className="admin-vol-name">{name}</span>
                            </Link>
                          ) : (
                            <span className="admin-vol-identity">
                              <span className="admin-vol-avatar" aria-hidden="true">
                                {initials(name)}
                              </span>
                              <span className="admin-vol-name">{name}</span>
                            </span>
                          )}
                        </td>
                        <td
                          data-label={a.vol.colEmail}
                          className={`admin-vol-email${v.email ? '' : ' admin-vol-email--empty'}`}
                        >
                          {v.email || '-'}
                        </td>
                        <td data-label={a.vol.colStatus}>
                          <StatusBadge
                            status={tab === 'active' ? 'active' : 'pending'}
                            label={tab === 'active' ? a.volStatus.active : a.volStatus.pending}
                          />
                        </td>
                        <td data-label={a.ui.actions}>
                          <div className="admin-row-actions">
                            {tab === 'pending' ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm admin-vol-action"
                                  disabled={busyId === v.id}
                                  aria-label={`${a.vol.approve}: ${name}`}
                                  onClick={() => act(v.id, 'approve')}
                                >
                                  <Check size={15} aria-hidden="true" />
                                  {a.vol.approve}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm admin-vol-action"
                                  disabled={busyId === v.id}
                                  aria-label={`${a.vol.reject}: ${name}`}
                                  onClick={() => act(v.id, 'reject')}
                                >
                                  <X size={15} aria-hidden="true" />
                                  {a.vol.reject}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm admin-vol-action"
                                disabled={busyId === v.id}
                                aria-label={`${a.vol.deactivate}: ${name}`}
                                onClick={() => setConfirmDeactivate({ uid: v.uid, name: name ?? '' })}
                              >
                                {a.vol.deactivate}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Reveal>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDeactivate}
        variant="danger"
        title={a.vol.deactivateConfirmTitle}
        message={confirmDeactivate ? `${confirmDeactivate.name}: ${a.vol.deactivateConfirmBody}` : a.vol.deactivateConfirmBody}
        confirmLabel={a.vol.deactivate}
        cancelLabel={t.common.cancel}
        busy={busyId === confirmDeactivate?.uid}
        onConfirm={() => {
          const target = confirmDeactivate
          if (target) act(target.uid, 'deactivate').then(() => setConfirmDeactivate(null))
        }}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </AdminLayout>
  )
}
