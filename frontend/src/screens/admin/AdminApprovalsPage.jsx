import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useApp } from '@/contexts/AppContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import { EmptyState, ErrorState, TableSkeleton, adminErrorMessage } from '@/components/admin/AdminUI'

const ENTITY_FILTERS = ['all', 'businesses', 'organizations', 'answers']

// Distinct badge tone per entity type so the queue is scannable at a glance.
const ENTITY_TONE = {
  businesses: 'badge-amber',
  organizations: 'badge-blue',
  answers: 'badge-green',
}

/**
 * Approval queue rendered inside the admin shell. Reuses the existing
 * /api/admin/pending + approve|reject|request-changes endpoints (UC-05).
 */
export default function AdminApprovalsPage() {
  const { t, lang } = useLanguage()
  const a = t.admin
  const { toast } = useApp()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson('/api/admin/pending')
      setItems(res.items || [])
    } catch (err) {
      setError(adminErrorMessage(err, lang))
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => {
    load()
  }, [load])

  const act = async (item, action) => {
    setBusyId(item.id)
    try {
      const endpoint = action.replace('_', '-')
      const res = await apiFetch(`/api/admin/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ entityType: item.entityType, entityId: item.id }),
      })
      if (!res.ok) throw new Error('action_failed')
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast(a.approvals.actionSuccess, 'success')
    } catch {
      toast(a.approvals.actionError, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const counts = {
    all: items.length,
    businesses: items.filter((i) => i.entityType === 'businesses').length,
    organizations: items.filter((i) => i.entityType === 'organizations').length,
    answers: items.filter((i) => i.entityType === 'answers').length,
  }
  const filtered = filter === 'all' ? items : items.filter((i) => i.entityType === filter)
  const labels = {
    all: a.approvals.entityAll,
    businesses: a.approvals.entityBusinesses,
    organizations: a.approvals.entityOrganizations,
    answers: a.approvals.entityAnswers,
  }

  return (
    <AdminLayout title={a.approvals.title} subtitle={a.approvals.subtitle}>
      <div className="admin-filters" role="tablist" aria-label={a.approvals.title}>
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`admin-filter-tab${filter === f ? ' is-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {labels[f]}
            {counts[f] > 0 ? ` (${counts[f]})` : ''}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckCircle} title={a.approvals.empty} />
      ) : (
        <div className="admin-approval-list">
          {filtered.map((item) => (
            <div key={item.id} className="card admin-approval-card">
              <div className="admin-approval-info">
                <span className={`badge ${ENTITY_TONE[item.entityType] || 'badge-gray'}`}>
                  <span className="badge-dot" aria-hidden="true" />
                  {labels[item.entityType] || item.entityType}
                </span>
                <h3 className="admin-approval-name">
                  {item.name || item.title || item.id}
                </h3>
              </div>
              <div className="admin-row-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busyId === item.id}
                  onClick={() => act(item, 'approve')}
                >
                  <CheckCircle size={14} aria-hidden="true" />
                  {a.table.approve}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === item.id}
                  onClick={() => act(item, 'request_changes')}
                >
                  <MessageSquare size={14} aria-hidden="true" />
                  {a.approvals.requestChanges}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === item.id}
                  onClick={() => act(item, 'reject')}
                >
                  <XCircle size={14} aria-hidden="true" />
                  {a.table.reject}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
