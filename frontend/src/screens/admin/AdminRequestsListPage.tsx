import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Inbox, ChevronLeft, ChevronRight, Plus, HandHeart } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
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
  [key: string]: unknown
}

export default function AdminRequestsListPage() {
  const { t, lang, isRTL } = useLanguage()
  const a = t.admin
  const [filter, setFilter] = useState<FilterKey>('')
  const [items, setItems] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taskOpen, setTaskOpen] = useState(false)
  // When linked from the dashboard with ?claims=true, narrow the list to
  // requests that have interested volunteers (req 22 surfacing).
  const [claimsOnly, setClaimsOnly] = useState(false)

  const ManageArrow = isRTL ? ChevronLeft : ChevronRight

  // Read ?claims=true from the URL once on mount so the dashboard's
  // "requests with claimants" card lands on a pre-filtered view.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setClaimsOnly(params.get('claims') === 'true')
    const status = params.get('status')
    if (status && (STATUS_FILTERS as readonly string[]).includes(status)) {
      setFilter(status as FilterKey)
    }
  }, [])

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
      // status. The default ('') view returns active (non-archived) requests —
      // the backend excludes archived === true unless ?archived=true is sent.
      const qs =
        filter === ARCHIVED_FILTER
          ? '?archived=true'
          : filter
            ? `?status=${filter}`
            : ''
      const res = await apiJson(`/api/admin/requests${qs}`) as { items?: RequestRow[] }
      setItems(res.items || [])
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setLoading(false)
    }
  }, [filter, lang])

  useEffect(() => {
    load()
  }, [load])

  // When the claims-only view is active, narrow to requests that carry at
  // least one interested-volunteer claim (req 22).
  const visibleItems = claimsOnly ? items.filter((r) => r.hasClaims) : items

  // Live result summary: "N results" reusing the column/empty vocabulary the
  // page already ships — no new translation keys introduced.
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
        {/* ── Filter bar — a segmented control that reads as one cohesive unit ── */}
        <div
          role="group"
          aria-label={a.reqList.title}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--sp-2)',
            padding: 'var(--sp-2)',
            background: 'var(--white)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            marginBlockEnd: 'var(--sp-4)',
          }}
        >
          {[...STATUS_FILTERS, ARCHIVED_FILTER].map((s) => {
            const active = filter === s
            // The archived tab sits apart from the active-status group: a quiet
            // inline-start divider signals it's a separate bucket, not a status.
            const isArchivedTab = s === ARCHIVED_FILTER
            return (
              <button
                key={s || 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(s as FilterKey)}
                style={{
                  appearance: 'none',
                  cursor: 'pointer',
                  border: '1px solid transparent',
                  borderRadius: 'var(--radius)',
                  padding: '8px 16px',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: active ? 600 : 500,
                  lineHeight: 1.2,
                  color: active ? 'var(--white)' : 'var(--gray-600)',
                  background: active ? 'var(--ember)' : 'transparent',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  transition: `background var(--dur-2) var(--ease-out), color var(--dur-2) var(--ease-out)`,
                  WebkitTapHighlightColor: 'transparent',
                  // Set the archived tab apart from the active-status group with
                  // a hairline on its inline-start edge (auto-flips in RTL).
                  ...(isArchivedTab
                    ? {
                        marginInlineStart: 'var(--sp-1)',
                        borderInlineStartColor: 'var(--hair)',
                        borderStartStartRadius: 0,
                        borderEndStartRadius: 0,
                        paddingInlineStart: 'var(--sp-3)',
                      }
                    : null),
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--sky-3)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = active ? 'var(--shadow-sm), var(--ring)' : 'var(--ring)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = active ? 'var(--shadow-sm)' : 'none'
                }}
              >
                {filterLabel(s as FilterKey)}
              </button>
            )
          })}
        </div>
      </Reveal>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : visibleItems.length === 0 ? (
        <Reveal>
          <EmptyState icon={Inbox} title={a.reqList.empty} message={a.reqList.emptyHint} />
        </Reveal>
      ) : (
        <Reveal delay={0.05}>
          {/* ── Section header — echoes the home page's eyebrow → micro-heading
              rhythm and aligns its start edge to the table card below ── */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: 'var(--sp-2)',
              marginBlock: 'var(--sp-5) var(--sp-4)',
            }}
          >
            <h2
              style={{
                fontFamily: '"Frank Ruhl Libre", Georgia, serif',
                fontSize: 'var(--fs-h3)',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: 0,
                lineHeight: 1.2,
                textAlign: 'start',
              }}
            >
              {a.reqList.title}
            </h2>
            <p
              aria-live="polite"
              style={{
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 'var(--fs-xs)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--gray-500)',
                margin: 0,
                textAlign: 'start',
              }}
            >
              {resultSummary}
            </p>
          </div>

          {/* ── Data table — a single editorial card. The card itself owns the
              frame (hairline + radius-lg + shadow) and the horizontal scroll;
              the inner .admin-table-wrap has its globals.css chrome (border,
              radius, shadow, paper bg, 72vh cap) neutralized inline so only one
              confident object renders with no nested-corner artifact. ── */}
          <div
            style={{
              background: 'var(--white)',
              border: '1px solid var(--hair)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow)',
              overflowX: 'auto',
              overflowY: 'hidden',
            }}
          >
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
                          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{primary}</span>
                            {isAdminTask && (
                              <StatusBadge status="admin" label={a.taskForm.badge} />
                            )}
                            {r.hasClaims && (
                              <span
                                className="badge badge-ember"
                                title={a.claims.badge}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <HandHeart size={12} aria-hidden="true" />
                                {a.claims.badge}
                              </span>
                            )}
                          </span>
                        </td>
                        <td data-label={a.reqList.colCategory}>
                          <span style={{ color: r.category ? 'var(--gray-600)' : 'var(--gray-400)' }}>
                            {r.category || '·'}
                          </span>
                        </td>
                        <td data-label={a.reqList.colCity}>
                          <span style={{ color: r.city ? 'var(--gray-600)' : 'var(--gray-400)' }}>
                            {r.city || '·'}
                          </span>
                        </td>
                        <td data-label={a.reqList.colStatus}>
                          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                            <StatusBadge
                              status={r.status ?? ''}
                              label={(r.status ? (a.statusLabels as Record<string, string>)[r.status] : '') || r.status || ''}
                            />
                            {r.archived && (
                              <StatusBadge status={ARCHIVED_FILTER} label={t.lifecycle.archivedBadge} />
                            )}
                          </span>
                        </td>
                        <td data-label={a.ui.actions}>
                          <Link
                            href={`/admin/requests/${r.id}`}
                            className="btn btn-ghost btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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
