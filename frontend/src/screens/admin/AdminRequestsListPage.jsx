import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Inbox, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import Reveal from '../../components/motion/Reveal'
import {
  StatusBadge,
  EmptyState,
  ErrorState,
  TableSkeleton,
  adminErrorMessage,
} from '@/components/admin/AdminUI'

const STATUS_FILTERS = ['', 'pending', 'in_progress', 'resolved', 'rejected', 'closed']

export default function AdminRequestsListPage() {
  const { t, lang, isRTL } = useLanguage()
  const a = t.admin
  const [status, setStatus] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const ManageArrow = isRTL ? ChevronLeft : ChevronRight

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = status ? `?status=${status}` : ''
      const res = await apiJson(`/api/admin/requests${qs}`)
      setItems(res.items || [])
    } catch (err) {
      setError(adminErrorMessage(err, lang))
    } finally {
      setLoading(false)
    }
  }, [status, lang])

  useEffect(() => {
    load()
  }, [load])

  // Live result summary: "N results" reusing the column/empty vocabulary the
  // page already ships — no new translation keys introduced.
  const resultSummary = (() => {
    const n = items.length
    if (lang === 'he') return `${n} ${n === 1 ? 'בקשה' : 'בקשות'}`
    return `${n} ${n === 1 ? 'request' : 'requests'}`
  })()

  return (
    <AdminLayout title={a.reqList.title} subtitle={a.reqList.subtitle}>
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
          {STATUS_FILTERS.map((s) => {
            const active = status === s
            return (
              <button
                key={s || 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(s)}
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
                {s ? a.statusLabels[s] : a.reqList.filterAll}
              </button>
            )
          })}
        </div>
      </Reveal>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : items.length === 0 ? (
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
                  {items.map((r) => {
                    const name = [r.firstName, r.lastName].filter(Boolean).join(' ')
                    const primary = name || (r.description ? r.description.slice(0, 40) : r.id)
                    return (
                      <tr key={r.id}>
                        <td data-label={a.reqList.colTitle}>
                          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{primary}</span>
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
                          <StatusBadge status={r.status} label={a.statusLabels[r.status] || r.status} />
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
