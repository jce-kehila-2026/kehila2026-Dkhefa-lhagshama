import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Inbox, ChevronLeft, ChevronRight, Plus, HandHeart, X, Search, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCategories } from '@/hooks/useCategories'
import { apiJson } from '@/lib/apiClient'
import type { CloseRequestSummary } from '@/types'
import AdminLayout from '@/components/admin/AdminLayout'
import CreateTaskDialog from '@/components/admin/CreateTaskDialog'
import HelpTooltip from '@/components/feedback/HelpTooltip'
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
  claimsCount?: number
  createdAt?: string | null
  assignedVolunteerId?: string | null
  assignedVolunteerName?: string | null
  // Compact consent-close handshake state (req 25), null when none pending.
  closeRequest?: CloseRequestSummary | null
  [key: string]: unknown
}

// Sort indicator caret for a column header: up/down when this is the active
// sort column, a neutral double-caret otherwise. Decorative (aria-hidden);
// the <th aria-sort> attribute carries the semantics for assistive tech.
function SortCaret({
  state,
  up: Up,
  down: Down,
  both: Both,
}: {
  state: 'ascending' | 'descending' | 'none'
  up: typeof ArrowUp
  down: typeof ArrowDown
  both: typeof ChevronsUpDown
}) {
  const Icon = state === 'ascending' ? Up : state === 'descending' ? Down : Both
  return <Icon size={13} aria-hidden="true" className="admin-reqlist-sortcaret" />
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
  // WS-5: live client-side search over the already-loaded items[].
  const [search, setSearch] = useState('')
  // WS-5: one client-side sort model. The Newest/Priority presets seed the
  // initial column+direction; a header click overrides. 'created' = Newest,
  // 'priority' is server-ordered (we keep server order when col === 'priority').
  type SortCol = 'requester' | 'category' | 'city' | 'interested' | 'status' | 'priority' | 'created'
  const [sortCol, setSortCol] = useState<SortCol>('created')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

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

  // Mirror the Newest/Priority preset into the client sort model so the table
  // reflects the chosen preset until the admin clicks a column header.
  useEffect(() => {
    if (sort === 'priority') {
      setSortCol('priority')
      setSortDir('desc')
    } else {
      setSortCol('created')
      setSortDir('desc')
    }
  }, [sort])

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

  // Label for the ?volunteerId= filter chip: every returned row is assigned to
  // that volunteer, so any row's denormalized name resolves it; uid otherwise.
  const volunteerChipName =
    items.find((r) => r.assignedVolunteerId === volunteerId)?.assignedVolunteerName ||
    volunteerId

  // Claims-only view (req 22) narrows to requests carrying interested claims.
  const claimsFiltered = claimsOnly ? items.filter((r) => r.hasClaims) : items

  // WS-5 search: case-insensitive substring over requester name, title,
  // description, city, category label, and assigned-volunteer name.
  const requesterText = (r: RequestRow): string => {
    if (r.origin === 'admin' || r.requestType === 'task' || r.requestType === 'admin_task') {
      return a.reqList.adminTaskRequester
    }
    return [r.firstName, r.lastName].filter(Boolean).join(' ')
  }
  const q = search.trim().toLowerCase()
  const searched = q
    ? claimsFiltered.filter((r) => {
        const hay = [
          requesterText(r),
          r.title,
          r.description,
          r.city,
          r.category ? labelFor(r.category) : '',
          r.assignedVolunteerName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    : claimsFiltered

  // WS-5 unified client-side sort. 'priority'/'created' keep the server order
  // (already sorted by the fetch); the column presets sort the loaded array.
  const statusLabelOf = (r: RequestRow): string =>
    (r.status ? (a.statusLabels as Record<string, string>)[r.status] : '') || r.status || ''
  const visibleItems = useMemo(() => {
    if (sortCol === 'priority' || sortCol === 'created') return searched
    const dir = sortDir === 'asc' ? 1 : -1
    const key = (r: RequestRow): string => {
      switch (sortCol) {
        case 'requester': return requesterText(r)
        case 'category':  return r.category ? labelFor(r.category) : ''
        case 'city':      return r.city || ''
        case 'interested': return r.hasClaims ? '1' : '0'
        case 'status':    return statusLabelOf(r)
        default:          return ''
      }
    }
    return [...searched].sort((x, y) =>
      key(x).localeCompare(key(y), lang === 'he' ? 'he' : 'en', { numeric: true }) * dir,
    )
    // labelFor/requesterText/statusLabelOf are stable per render; deps cover inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, sortCol, sortDir, lang])

  // Live result summary using i18n keys (WS-5).
  const resultSummary = (() => {
    const n = visibleItems.length
    if (n === 1) return `1 ${a.reqList.resultsOne}`
    return `${n} ${a.reqList.resultsMany}`
  })()

  // Toggle a column: same column flips direction, a new column starts ascending.
  const toggleSort = (col: SortCol) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return col
    })
  }
  // aria-sort value for a header (none when this isn't the active sort column).
  const ariaSortFor = (col: SortCol): 'ascending' | 'descending' | 'none' =>
    sortCol === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'

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

      {/* WS-5 search: live, client-side, over the loaded items[]. RTL-safe icon
          + inset clear button; same anatomy as the public directory search. */}
      <div className="admin-reqlist-search">
        <Search size={17} aria-hidden="true" className="admin-reqlist-search-icon" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={a.reqList.searchPlaceholder}
          aria-label={a.reqList.searchLabel}
          className="form-input admin-reqlist-search-input"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {search && (
          <button
            type="button"
            className="admin-reqlist-search-clear"
            aria-label={a.reqList.searchClear}
            onClick={() => setSearch('')}
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : visibleItems.length === 0 ? (
        <Reveal>
          {search.trim() ? (
            <div className="admin-reqlist-nomatch" role="status" aria-live="polite">
              <p className="admin-reqlist-nomatch-title">{a.reqList.noMatches}</p>
              <p>{a.reqList.noMatchesHint}</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSearch('')}
                style={{ marginBlockStart: 'var(--sp-3)' }}
              >
                {a.reqList.searchClear}
              </button>
            </div>
          ) : (
            <EmptyState icon={Inbox} title={a.reqList.empty} message={a.reqList.emptyHint} />
          )}
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
                    <th aria-sort={ariaSortFor('requester')}>
                      <button
                        type="button"
                        className="admin-reqlist-sortbtn"
                        onClick={() => toggleSort('requester')}
                        title={a.reqList.sortAria.replace('{col}', a.reqList.colRequester)}
                      >
                        {a.reqList.colRequester}
                        <SortCaret state={ariaSortFor('requester')} up={ArrowUp} down={ArrowDown} both={ChevronsUpDown} />
                      </button>
                    </th>
                    <th>{a.reqList.colTitle}</th>
                    <th aria-sort={ariaSortFor('category')}>
                      <button
                        type="button"
                        className="admin-reqlist-sortbtn"
                        onClick={() => toggleSort('category')}
                        title={a.reqList.sortAria.replace('{col}', a.reqList.colCategory)}
                      >
                        {a.reqList.colCategory}
                        <SortCaret state={ariaSortFor('category')} up={ArrowUp} down={ArrowDown} both={ChevronsUpDown} />
                      </button>
                    </th>
                    <th aria-sort={ariaSortFor('city')}>
                      <button
                        type="button"
                        className="admin-reqlist-sortbtn"
                        onClick={() => toggleSort('city')}
                        title={a.reqList.sortAria.replace('{col}', a.reqList.colCity)}
                      >
                        {a.reqList.colCity}
                        <SortCaret state={ariaSortFor('city')} up={ArrowUp} down={ArrowDown} both={ChevronsUpDown} />
                      </button>
                    </th>
                    <th>{a.reqList.colAssigned}</th>
                    <th aria-sort={ariaSortFor('interested')}>
                      <span className="admin-reqlist-sortbtn-wrap">
                        <button
                          type="button"
                          className="admin-reqlist-sortbtn"
                          onClick={() => toggleSort('interested')}
                          title={a.reqList.sortAria.replace('{col}', a.reqList.colInterested)}
                        >
                          {a.reqList.colInterested}
                          <SortCaret state={ariaSortFor('interested')} up={ArrowUp} down={ArrowDown} both={ChevronsUpDown} />
                        </button>
                        <HelpTooltip text={a.reqList.interestedHelp} label={a.reqList.interestedHelpLabel} />
                      </span>
                    </th>
                    <th aria-sort={ariaSortFor('status')}>
                      <button
                        type="button"
                        className="admin-reqlist-sortbtn"
                        onClick={() => toggleSort('status')}
                        title={a.reqList.sortAria.replace('{col}', a.reqList.colStatus)}
                      >
                        {a.reqList.colStatus}
                        <SortCaret state={ariaSortFor('status')} up={ArrowUp} down={ArrowDown} both={ChevronsUpDown} />
                      </button>
                    </th>
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
                        <td data-label={a.reqList.colRequester}>
                          {isAdminTask ? (
                            <span className="admin-reqlist-requester--task">
                              {a.reqList.adminTaskRequester}
                            </span>
                          ) : name ? (
                            <span className="admin-reqlist-requester">{name}</span>
                          ) : (
                            <span className="admin-reqlist-meta--empty">·</span>
                          )}
                        </td>
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
                        <td data-label={a.reqList.colInterested}>
                          {r.hasClaims ? (
                            <span className="admin-reqlist-interested">
                              <HandHeart size={13} aria-hidden="true" />
                              {a.reqList.interestedYes}
                              {typeof r.claimsCount === 'number' && r.claimsCount > 0 && (
                                <span className="admin-reqlist-meta"> ({r.claimsCount})</span>
                              )}
                            </span>
                          ) : (
                            <span className="admin-reqlist-interested--no">{a.reqList.interestedNo}</span>
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
