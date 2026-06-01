import { useEffect, useState, useCallback } from 'react'
import { HeartHandshake, Clock, CheckCircle2, Check, X } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import Reveal from '../../components/motion/Reveal'
import {
  StatCard,
  StatusBadge,
  EmptyState,
  ErrorState,
  TableSkeleton,
  adminErrorMessage,
} from '@/components/admin/AdminUI'

// A small two-letter monogram derived from a volunteer's display name —
// purely presentational identity cue beside the name column.
function initials(name) {
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
    } catch (err) {
      setError(adminErrorMessage(err, lang))
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => {
    load()
  }, [load])

  const act = async (id, action) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/volunteers/${id}/${action}`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw { status: res.status, error: body?.error, detail: body }
      }
      await load()
    } catch (err) {
      setError(adminErrorMessage(err, lang))
    } finally {
      setBusyId(null)
    }
  }

  const rows = tab === 'pending' ? data.pending : data.active

  return (
    <AdminLayout title={a.vol.title} subtitle={a.vol.subtitle}>
      {/* ── Summary band: live counts for each queue (sole home for the counts) ── */}
      <Reveal>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--sp-4)',
            marginBlockEnd: 'var(--sp-6)',
          }}
        >
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

      {/* ── Toolbar card holding the segmented queue tabs ────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--sp-3)',
          padding: 'var(--sp-2)',
          background: 'var(--white)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xs)',
          marginBlockEnd: 'var(--sp-5)',
        }}
      >
        <div
          className="admin-filters"
          role="tablist"
          aria-label={a.vol.title}
          style={{ marginBlockEnd: 0 }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pending'}
            className={`admin-filter-tab${tab === 'pending' ? ' is-active' : ''}`}
            onClick={() => setTab('pending')}
          >
            {a.vol.filterPending}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'active'}
            className={`admin-filter-tab${tab === 'active' ? ' is-active' : ''}`}
            onClick={() => setTab('active')}
          >
            {a.vol.filterActive}
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : rows.length === 0 ? (
        <Reveal>
          <EmptyState icon={HeartHandshake} title={a.vol.empty} message={a.vol.emptyHint} />
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
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--sp-3)',
                            minWidth: 0,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              flex: '0 0 auto',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: 'var(--sky-3)',
                              color: 'var(--ink-2)',
                              fontSize: 'var(--fs-xs)',
                              fontWeight: 700,
                              letterSpacing: '0.02em',
                              border: '1px solid var(--hair)',
                            }}
                          >
                            {initials(name)}
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: 'var(--ink)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {name}
                          </span>
                        </span>
                      </td>
                      <td data-label={a.vol.colEmail} style={{ color: 'var(--gray-600)' }}>
                        {v.email || '·'}
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
                                className="btn btn-primary btn-sm"
                                disabled={busyId === v.id}
                                onClick={() => act(v.id, 'approve')}
                              >
                                <Check size={15} aria-hidden="true" />
                                {a.vol.approve}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={busyId === v.id}
                                onClick={() => act(v.id, 'reject')}
                              >
                                <X size={15} aria-hidden="true" />
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
                  )
                })}
              </tbody>
            </table>
          </div>
        </Reveal>
      )}
    </AdminLayout>
  )
}
