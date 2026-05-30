import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import {
  StatusBadge,
  EmptyState,
  ErrorState,
  TableSkeleton,
  adminErrorMessage,
} from '@/components/admin/AdminUI'

const STATUS_FILTERS = ['', 'pending', 'in_progress', 'resolved', 'rejected', 'closed']

export default function AdminRequestsListPage() {
  const { t, lang } = useLanguage()
  const a = t.admin
  const [status, setStatus] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  return (
    <AdminLayout title={a.reqList.title} subtitle={a.reqList.subtitle}>
      <div className="admin-filters" role="tablist" aria-label={a.reqList.title}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            role="tab"
            aria-selected={status === s}
            className={`admin-filter-tab${status === s ? ' is-active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s ? a.statusLabels[s] : a.reqList.filterAll}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : items.length === 0 ? (
        <EmptyState icon={Inbox} title={a.reqList.empty} message={a.reqList.emptyHint} />
      ) : (
        <div className="admin-table-wrap">
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
                return (
                  <tr key={r.id}>
                    <td data-label={a.reqList.colTitle}>
                      {name || (r.description ? r.description.slice(0, 40) : r.id)}
                    </td>
                    <td data-label={a.reqList.colCategory}>{r.category || '·'}</td>
                    <td data-label={a.reqList.colCity}>{r.city || '·'}</td>
                    <td data-label={a.reqList.colStatus}>
                      <StatusBadge status={r.status} label={a.statusLabels[r.status] || r.status} />
                    </td>
                    <td data-label={a.ui.actions}>
                      <Link href={`/admin/requests/${r.id}`} className="btn btn-ghost btn-sm">
                        {a.reqList.manage}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
