import { useEffect, useState, useCallback } from 'react'
import { Users } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import {
  StatusBadge,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from '@/components/admin/AdminUI'

const ROLES = ['beneficiary', 'businessOwner', 'volunteer', 'admin']

export default function AdminUsersPage() {
  const { t } = useLanguage()
  const a = t.admin
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson('/api/admin/users')
      setItems(res.items || [])
    } catch {
      setError(a.ui.loading)
    } finally {
      setLoading(false)
    }
  }, [a.ui.loading])

  useEffect(() => {
    load()
  }, [load])

  const changeRole = async (uid, role) => {
    setBusyId(uid)
    setError(null)
    try {
      if (role === 'beneficiary') {
        await apiFetch(`/api/admin/users/${uid}/demote`, { method: 'POST' })
      } else {
        await apiFetch(`/api/admin/users/${uid}/promote`, {
          method: 'POST',
          body: JSON.stringify({ role }),
        })
      }
      await load()
    } catch {
      setError(a.ui.loading)
    } finally {
      setBusyId(null)
    }
  }

  const toggleDisabled = async (uid, disabled) => {
    setBusyId(uid)
    setError(null)
    try {
      await apiFetch(`/api/admin/users/${uid}/${disabled ? 'enable' : 'disable'}`, {
        method: 'POST',
      })
      await load()
    } catch {
      setError(a.ui.loading)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout title={a.userMgmt.title} subtitle={a.userMgmt.subtitle}>
      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title={a.userMgmt.empty} />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>{a.userMgmt.colName}</th>
                <th>{a.userMgmt.colRole}</th>
                <th>{a.userMgmt.colState}</th>
                <th className="admin-table-actions-col">{a.ui.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => {
                const role = u.role || 'beneficiary'
                return (
                  <tr key={u.uid}>
                    <td data-label={a.userMgmt.colName}>
                      {u.displayName || u.email || u.uid}
                    </td>
                    <td data-label={a.userMgmt.colRole}>
                      <StatusBadge status={role} label={a.roleLabels[role] || role} />
                    </td>
                    <td data-label={a.userMgmt.colState}>
                      {u.disabled ? a.userMgmt.stateDisabled : a.userMgmt.stateActive}
                    </td>
                    <td data-label={a.ui.actions}>
                      <div className="admin-row-actions">
                        <select
                          className="form-select admin-inline-select"
                          value={role}
                          disabled={busyId === u.uid}
                          onChange={(e) => changeRole(u.uid, e.target.value)}
                          aria-label={a.userMgmt.colRole}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {a.roleLabels[r]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === u.uid}
                          onClick={() => toggleDisabled(u.uid, u.disabled)}
                        >
                          {u.disabled ? a.userMgmt.enable : a.userMgmt.disable}
                        </button>
                      </div>
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
