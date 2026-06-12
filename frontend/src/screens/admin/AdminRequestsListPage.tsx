import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Inbox, ChevronLeft, ChevronRight, Plus, HandHeart, X } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCategories } from '@/hooks/useCategories'
import { apiJson } from '@/lib/apiClient'
import type { CloseRequestSummary } from '@/types'
import AdminLayout from '@/components/admin/AdminLayout'
import CreateTaskDialog from '@/components/admin/CreateTaskDialog'
import Reveal from '../../components/motion/Reveal'
import {
  StatusBadge,
  EmptyState,
  ErrorState,
  TableSkeleton,
  adminErrorMessage,
} from '@/components/admin/AdminUI'

// Canonical lifecycle statuses surfaced as tabs (request-lifecycle spec). The
// leading '' is the "all active" view; 'archived' is a pseudo-filter handled
// via the ?archived=true query rather than a status value (Note 6).
const STATUS_FILTERS = [
  '',
  'pending',
  'in_progress',
  'awaiting_review',
  'closed',
  'rejected',
  'referred',
] as const
const ARCHIVED_FILTER = 'archived'
type FilterKey = (typeof STATUS_FILTERS)[number] | typeof ARCHIVED_FILTER

// The two server-side sort orders offered by GET /api/admin/requests:
// 'newest' (createdAt desc, the default) and 'priority' (urgency/deadline).
const SORT_KEYS = ['newest', 'priority'] as const
type SortKey = (typeof SORT_KEYS)[number]

// Row shape returned by GET /api/admin/requests. Loose by design: only the
// fields this list reads are declared; everything else is allowed through.
interface RequestRow {
  id: string
  firstName?: string
  lastName?: string
  title?: string
  description?: string
  category?: string
  city?: string
  status?: string
  archived?: boolean
  origin?: string
  requestType?: string
  hasClaims?: boolean
  assignedVolunteerId?: string | null
  assignedVolunteerName?: string | null
  // Compact consent-close handshake state (req 25), null when none pending.
  closeRequest?: CloseRequestSummary | null
  [key: string]: unknown
}

export default function AdminRequestsListPage() {
  const { t, lang, isRTL } = useLanguage()
  const a = t.admin
  // Bilingual category labels from the admin-managed taxonomy.
  const { labelFor } = useCategories()
  const [filter, setFilter] = useState<FilterKey>('')
  const [items, setItems] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taskOpen, setTaskOpen] = useState(false)
  // When linked from the dashboard with ?claims=true, narrow the list to
  // requests that have interested volunteers (req 22 surfacing).
  const [claimsOnly, setClaimsOnly] = useState(false)
  // Server-side sort order: newest (default) or priority (urgency/deadline).
  const [sort, setSort] = useState<SortKey>('newest')
  // ?volunteerId= deep link (e.g. from the volunteers roster): narrow the list
  // to one volunteer's assigned requests, server-side.
  const [volunteerId, setVolunteerId] = useState('')

  const ManageArrow = isRTL ? ChevronLeft : ChevronRight

  // Read ?claims=true from the URL once on mount so the dashboard's
  // "requests with claimants" card lands on a pre-filtered view.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setClaimsOnly(params.get('claims') === 'true')
    const status = params.get('status')
    if (status && ([...STATUS_FILTERS, ARCHIVED_FILTER] as readonly string[]).includes(status)) {
      setFilter(status as FilterKey)
    }
    if (params.get('sort') === 'priority') setSort('priority')
    const vid = params.get('volunteerId')
    if (vid) setVolunteerId(vid)
  }, [])

  // Reflect the active filter in the URL so the view is bookmarkable, shareable,
  // and survives a refresh. replaceState (not push) keeps history clean per click.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams()
    if (filter) params.set('status', filter)
    if (claimsOnly) params.set('claims', 'true')
    if (sort === 'priority') params.set('sort', 'priority')
    if (volunteerId) params.set('volunteerId', volunteerId)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [filter, claimsOnly, sort, volunteerId])

  // Resolve the human label for a filter tab. Active statuses use the canonical
  // admin status labels; the archived tab + "all" use their dedicated keys.
  const filterLabel = (key: FilterKey): string => {
    if (key === '') return a.reqList.filterAll
    if (key === ARCHIVED_FILTER) return t.lifecycle.archivedLabel
    return (a.statusLabels as Record<string, string>)[key] || key
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // The archived tab pulls the archived bucket; status tabs filter by
      // status. The default ('') view returns active (non-archived) requests:
      // the backend excludes archived === true unless ?archived=true is sent.
      // sort + volunteerId ride along on every view.
      const params = new URLSearchParams()
      if (filter === ARCHIVED_FILTER) params.set('archived', 'true')
      else if (filter) params.set('status', filter)
      if (sort === 'priority') params.set('sort', 'priority')
      if (volunteerId) params.set('volunteerId', volunteerId)
      const qs = params.toString()
      const res = await apiJson(`/api/admin/requests${qs ? `?${qs}` : ''}`) as { items?: RequestRow[] }
      setItems(res.items || [])
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setLoading(false)
    }
  }, [filter, sort, volunteerId, lang])

  useEffect(() => {
    load()
  }, [load])

  // When the claims-only view is active, narrow to requests that carry at
  // least one interested-volunteer claim (req 22).
  const visibleItems = claimsOnly ? items.filter((r) => r.hasClaims) : items

  // Label for the ?volunteerId= filter chip: every returned row is assigned to
  // that volunteer, so any row's denormalized name resolves it; uid otherwise.
  const volunteerChipName =
    items.find((r) => r.assignedVolunteerId === volunteerId)?.assignedVolunteerName ||
    volunteerId

  // Live result summary: "N results" reusing the column/empty vocabulary the
  // page already ships (no new translation keys introduced).
  const resultSummary = (() => {
    const n = visibleItems.length
    if (lang === 'he') return `${n} ${n === 1 ? 'בקשה' : 'בקשות'}`
    return `${n} ${n === 1 ? 'request' : 'requests'}`
  })()

  return (
    <AdminLayout
      title={a.reqList.title}
      subtitle={a.reqList.subtitle}
      actions={
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setTaskOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} aria-hidden="true" />
          {a.taskForm.create}
        </button>
      }
    >
      <CreateTaskDialog
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        onCreated={() => {
          setTaskOpen(false)
          load()
        }}
      />
      <Reveal>
        {/* Filter bar: a segmented control that reads as one cohesive unit.
            Hover/focus/active are all CSS-driven (.admin-reqlist-tab) so touch
            devices skip the hover fill and reduced-motion is honoured. */}
        <div role="group" aria-label={a.reqList.title} className="admin-reqlist-filters">
          {[...STATUS_FILTERS, ARCHIVED_FILTER].map((s) => {
            const active = filter === s
            // The archived tab sits apart from the active-status group: a quiet
            // inline-start hairline signals it is a separate bucket, not a status.
            const isArchivedTab = s === ARCHIVED_FILTER
            const tabClass = [
              'admin-reqlist-tab',
              active ? 'is-active' : '',
              isArchivedTab ? 'admin-reqlist-tab--archived' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={s || 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(s as FilterKey)}
                className={tabClass}
              >
                {filterLabel(s as FilterKey)}
              </button>
            )
          })}
          {/* Sort toggle: same tab anatomy, parked at the bar's inline-end
              behind its own hairline so it reads as a separate control. */}
          <div role="group" aria-label={a.reqList.sortLabel} className="admin-reqlist-sort">
            {SORT_KEYS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={sort === s}
                onClick={() => setSort(s)}
                className={`admin-reqlist-tab${sort === s ? ' is-active' : ''}`}
              >
                {s === 'newest' ? a.reqList.sortNewest : a.reqList.sortPriority}
              </button>
            ))}
          </div>
        </div>

        {/* ?volunteerId= deep-link chip: names the active volunteer filter and
            offers one tap to drop back to the full list. */}
        {volunteerId && (
          <div className="admin-reqlist-volchip">
            <span className="admin-reqlist-volchip-label">
              {a.reqList.volunteerFilter}: {volunteerChipName}
            </span>
            <button
              type="button"
              className="admin-reqlist-volchip-clear"
              aria-label={a.reqList.volunteerFilterClear}
              onClick={() => setVolunteerId('')}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        )}
      </Reveal>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : visibleItems.length === 0 ? (
        <Reveal>
          <EmptyState icon={Inbox} title={a.reqList.empty} message={a.reqList.emptyHint} />
        </Reveal>
      ) : (
        <Reveal delay={0.05}>
          {/* Section header: serif title + live mono result count, baseline
              aligned, start edge matching the table card below. */}
          <div className="admin-reqlist-head">
            <h2 className="admin-reqlist-title">{a.reqList.title}</h2>
            <p aria-live="polite" className="admin-reqlist-count">
              {resultSummary}
            </p>
          </div>

          {/* Data table: a single editorial card that owns the frame and the
              horizontal scroll. The inner .admin-table-wrap globals.css chrome
              (border, radius, shadow, paper bg, height cap) is neutralised
              inline so only one confident object renders, no nested corners. */}
          <div className="admin-reqlist-table-card">
            <div
              className="admin-table-wrap"
              style={{
                border: 'none',
                borderRadius: 0,
                boxShadow: 'none',
                background: 'transparent',
                overflow: 'visible',
                maxHeight: 'none',
              }}
            >
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>{a.reqList.colTitle}</th>
                    <th>{a.reqList.colCategory}</th>
                    <th>{a.reqList.colCity}</th>
                    <th>{a.reqList.colAssigned}</th>
                    <th>{a.reqList.colStatus}</th>
                    <th className="admin-table-actions-col">{a.ui.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((r) => {
                    const name = [r.firstName, r.lastName].filter(Boolean).join(' ')
                    // Admin task requests carry a `title` and no beneficiary
                    // name; fall back to the description, then the id.
                    const primary =
                      r.title || name || (r.description ? r.description.slice(0, 40) : r.id)
                    const isAdminTask =
                      r.origin === 'admin' || r.requestType === 'task' || r.requestType === 'admin_task'
                    return (
                      <tr key={r.id}>
                        <td data-label={a.reqList.colTitle}>
                          <span className="admin-reqlist-cell">
                            <span className="admin-reqlist-primary">{primary}</span>
                            {isAdminTask && (
                              <StatusBadge status="admin" label={a.taskForm.badge} />
                            )}
                            {r.hasClaims && (
                              <span className="badge badge-ember admin-reqlist-claims" title={a.claims.badge}>
                                <HandHeart size={12} aria-hidden="true" />
                                {a.claims.badge}
                              </span>
                            )}
                          </span>
                        </td>
                        <td data-label={a.reqList.colCategory}>
                          <span className={r.category ? 'admin-reqlist-meta' : 'admin-reqlist-meta--empty'}>
                            {r.category ? labelFor(r.category) : '·'}
                          </span>
                        </td>
                        <td data-label={a.reqList.colCity}>
                          <span className={r.city ? 'admin-reqlist-meta' : 'admin-reqlist-meta--empty'}>
                            {r.city || '·'}
                          </span>
                        </td>
                        <td data-label={a.reqList.colAssigned}>
                          {/* An assignee links to the volunteer drill-down
                              (/admin/volunteers/[uid]). */}
                          {r.assignedVolunteerId ? (
                            <Link
                              href={`/admin/volunteers/${r.assignedVolunteerId}`}
                              className="admin-reqlist-vollink"
                            >
                              {r.assignedVolunteerName ? (
                                <span className="admin-reqlist-meta">{r.assignedVolunteerName}</span>
                              ) : (
                                // Pre-denormalization rows carry only the uid:
                                // CSS-truncate it, full uid in the title attr.
                                <span
                                  className="admin-reqlist-meta admin-reqlist-uid"
                                  title={r.assignedVolunteerId}
                                >
                                  {r.assignedVolunteerId}
                                </span>
                              )}
                            </Link>
                          ) : r.assignedVolunteerName ? (
                            // Name without a uid (defensive): nothing to link to.
                            <span className="admin-reqlist-meta">{r.assignedVolunteerName}</span>
                          ) : (
                            <span className="admin-reqlist-meta--empty">·</span>
                          )}
                        </td>
                        <td data-label={a.reqList.colStatus}>
                          <span className="admin-reqlist-cell">
                            <StatusBadge
                              status={r.status ?? ''}
                              label={(r.status ? (a.statusLabels as Record<string, string>)[r.status] : '') || r.status || ''}
                            />
                            {r.archived && (
                              <StatusBadge status={ARCHIVED_FILTER} label={t.lifecycle.archivedBadge} />
                            )}
                            {/* req 25 — a pending consent-close handshake: one
                                side proposed and awaits the other (title names
                                the proposer; amber via the awaiting tone). */}
                            {r.closeRequest && (
                              <span
                                title={
                                  r.closeRequest.proposedRole === 'beneficiary'
                                    ? a.reqList.closeProposedByBeneficiary
                                    : a.reqList.closeProposedByVolunteer
                                }
                              >
                                <StatusBadge status="awaiting_review" label={a.reqList.closeBadge} />
                              </span>
                            )}
                          </span>
                        </td>
                        <td data-label={a.ui.actions}>
                          <Link
                            href={`/admin/requests/${r.id}`}
                            className="btn btn-ghost btn-sm admin-reqlist-manage"
                          >
                            {a.reqList.manage}
                            <ManageArrow size={15} aria-hidden="true" />
                          </Link>
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
    </AdminLayout>
  )
}
