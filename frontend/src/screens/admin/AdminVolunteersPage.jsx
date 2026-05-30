import { useEffect, useState, useCallback } from 'react'
import { HeartHandshake } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import {
  StatusBadge,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from '@/components/admin/AdminUI'

export default function AdminVolunteersPage() {
  const { t } = useLanguage()
  const a = t.admin
  const [tab, setTab] = useState('pending') // 'pending' | 'active'
  const [data, setData] = useState({ pending: [], active: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson('/api/admin/volunteers')
      setData({ pending: res.pending || [], active: res.active || [] })
    } catch {
      setError(a.ui.loading)
    } finally {
      setLoading(false)
    }
  }, [a.ui.loading])

  useEffect(() => {
    load()
  }, [load])

  const act = async (id, action) => {
    setBusyId(id)
    setError(null)
    try {
      await apiFetch(`/api/admin/volunteers/${id}/${action}`, { method: 'POST' })
      await load()
    } catch {
      setError(a.ui.loading)
    } finally {
      setBusyId(null)
    }
  }

  const rows = tab === 'pending' ? data.pending : data.active

  return (
    <AdminLayout title={a.vol.title} subtitle={a.vol.subtitle}>
      <div className="admin-filters" role="tablist" aria-label={a.vol.title}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'pending'}
          className={`admin-filter-tab${tab === 'pending' ? ' is-active' : ''}`}
          onClick={() => setTab('pending')}
        >
          {a.vol.filterPending}
          {data.pending.length > 0 ? ` (${data.pending.length})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          className={`admin-filter-tab${tab === 'active' ? ' is-active' : ''}`}
          onClick={() => setTab('active')}
        >
          {a.vol.filterActive}
          {data.active.length > 0 ? ` (${data.active.length})` : ''}
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon={HeartHandshake} title={a.vol.empty} message={a.vol.emptyHint} />
      ) : (
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
              {rows.map((v) => (
                <tr key={v.id}>
                  <td data-label={a.vol.colName}>{v.fullName || v.uid}</td>
                  <td data-label={a.vol.colEmail}>{v.email || '—'}</td>
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
                            className="btn btn-primary btn-sm"
                            disabled={busyId === v.id}
                            onClick={() => act(v.id, 'approve')}
                          >
                            {a.vol.approve}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busyId === v.id}
                            onClick={() => act(v.id, 'reject')}
                          >
                            {a.vol.reject}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === v.id}
                          onClick={() => act(v.uid, 'deactivate')}
                        >
                          {a.vol.deactivate}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
