import { useEffect, useState, useCallback } from 'react'
import { Users, ShieldCheck, UserCheck, UserX, Lock } from 'lucide-react'
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

const ROLES = ['beneficiary', 'businessOwner', 'volunteer', 'admin']

// A platform user row as returned by GET /api/admin/users. Loose by design —
// only the fields this screen reads are declared.
interface AdminUserRow {
  uid: string
  role?: string
  displayName?: string
  email?: string
  disabled?: boolean
  [key: string]: unknown
}

// Initials for the identity avatar — first glyphs of up to two words, falling
// back to the leading character of an email/uid. Locale-aware via the active
// language so Hebrew names render their own letters.
function initials(label: string | undefined | null): string {
  const s = String(label || '').trim()
  if (!s) return '?'
  const parts = s.replace(/[._-]+/g, ' ').split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return s.slice(0, 2).toUpperCase()
}

export default function AdminUsersPage() {
  const { t, lang } = useLanguage()
  const a = t.admin
  const [items, setItems] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson('/api/admin/users') as { items?: AdminUserRow[] }
      setItems(res.items || [])
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => {
    load()
  }, [load])

  const changeRole = async (uid: string, role: string) => {
    setBusyId(uid)
    setError(null)
    try {
      const res = role === 'beneficiary'
        ? await apiFetch(`/api/admin/users/${uid}/demote`, { method: 'POST' })
        : await apiFetch(`/api/admin/users/${uid}/promote`, {
            method: 'POST',
            body: JSON.stringify({ role }),
          })
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

  const toggleDisabled = async (uid: string, disabled: boolean | undefined) => {
    setBusyId(uid)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/users/${uid}/${disabled ? 'enable' : 'disable'}`, {
        method: 'POST',
      })
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

  // At-a-glance counts derived from the loaded set — reuses existing labels,
  // no new copy keys. Numbers only, so it stays language-neutral.
  const total = items.length
  const adminCount = items.filter((u) => (u.role || 'beneficiary') === 'admin').length
  const activeCount = items.filter((u) => !u.disabled).length
  const disabledCount = items.filter((u) => u.disabled).length

  return (
    <AdminLayout title={a.userMgmt.title} subtitle={a.userMgmt.subtitle}>
      {/* ── Summary strip — a calm metric row before the table ────────── */}
      {!loading && !error && items.length > 0 && (
        <Reveal>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--sp-4)',
              marginBlockEnd: 'var(--sp-6)',
            }}
          >
            <StatCard label={a.userMgmt.title} value={total} icon={Users} />
            <StatCard label={a.roleLabels.admin} value={adminCount} tone="ember" icon={ShieldCheck} />
            <StatCard label={a.userMgmt.stateActive} value={activeCount} tone="green" icon={UserCheck} />
            <StatCard label={a.userMgmt.stateDisabled} value={disabledCount} tone="default" icon={UserX} />
          </div>
        </Reveal>
      )}

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title={a.userMgmt.empty} />
      ) : (
        <Reveal delay={0.05}>
          <div
            className="card"
            style={{
              padding: 0,
              overflow: 'hidden',
              border: '1px solid var(--hair)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="admin-table-wrap" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
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
                    const name = u.displayName || u.email || u.uid
                    const sub = u.displayName && u.email ? u.email : null
                    const busy = busyId === u.uid
                    // req 23 — admin accounts are protected: the demote (role
                    // select) and disable controls are removed in favor of a
                    // lock indicator. The backend enforces this too (403
                    // cannot_modify_admin); this is the matching UI guard.
                    const isProtected = role === 'admin'
                    return (
                      <tr key={u.uid} style={busy ? { opacity: 0.55, transition: 'opacity var(--dur-2) var(--ease-out)' } : undefined}>
                        <td data-label={a.userMgmt.colName}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-3)', minWidth: 0, flex: 1, maxWidth: '100%' }}>
                            <span
                              aria-hidden="true"
                              style={{
                                flex: '0 0 auto',
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                background: role === 'admin' ? 'var(--ember-soft)' : 'var(--sky-3)',
                                color: role === 'admin' ? 'var(--ember-700)' : 'var(--ink-2)',
                                border: '1px solid var(--hair)',
                                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                letterSpacing: '0.02em',
                              }}
                            >
                              {initials(name)}
                            </span>
                            <span style={{ display: 'inline-flex', flexDirection: 'column', minWidth: 0, textAlign: 'start' }}>
                              <span style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {name}
                              </span>
                              {sub && (
                                <span
                                  style={{
                                    fontSize: 'var(--fs-xs)',
                                    color: 'var(--gray-500)',
                                    lineHeight: 1.3,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {sub}
                                </span>
                              )}
                            </span>
                          </span>
                        </td>
                        <td data-label={a.userMgmt.colRole}>
                          <StatusBadge status={role} label={(a.roleLabels as Record<string, string>)[role] || role} />
                        </td>
                        <td data-label={a.userMgmt.colState}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 'var(--sp-2)',
                              color: u.disabled ? 'var(--gray-500)' : 'var(--success)',
                              fontWeight: 500,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                flex: '0 0 auto',
                                background: u.disabled ? 'var(--gray-400)' : 'var(--success)',
                              }}
                            />
                            {u.disabled ? a.userMgmt.stateDisabled : a.userMgmt.stateActive}
                          </span>
                        </td>
                        <td data-label={a.ui.actions}>
                          {isProtected ? (
                            <span
                              className="admin-protected"
                              title={a.protectedRow.tooltip}
                            >
                              <Lock size={14} aria-hidden="true" />
                              {a.protectedRow.label}
                            </span>
                          ) : (
                            <div className="admin-row-actions">
                              <select
                                className="form-select admin-inline-select"
                                value={role}
                                disabled={busy}
                                onChange={(e) => changeRole(u.uid, e.target.value)}
                                aria-label={a.userMgmt.colRole}
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {(a.roleLabels as Record<string, string>)[r]}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={busy}
                                onClick={() => toggleDisabled(u.uid, u.disabled)}
                                aria-label={`${u.disabled ? a.userMgmt.enable : a.userMgmt.disable} — ${name}`}
                              >
                                {u.disabled
                                  ? <UserCheck size={14} aria-hidden="true" />
                                  : <UserX size={14} aria-hidden="true" />}
                                {u.disabled ? a.userMgmt.enable : a.userMgmt.disable}
                              </button>
                            </div>
                          )}
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
