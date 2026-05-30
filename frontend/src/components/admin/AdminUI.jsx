import { Inbox } from 'lucide-react'

export function StatCard({ label, value, loading }) {
  return (
    <div className="stat-card">
      <span className="stat-card-label">{label}</span>
      {loading ? (
        <span className="skeleton skeleton-stat" aria-hidden="true" />
      ) : (
        <span className="stat-card-value">{value}</span>
      )}
    </div>
  )
}

export function EmptyState({ title, message, icon: Icon = Inbox }) {
  return (
    <div className="admin-empty" role="status">
      <Icon size={40} aria-hidden="true" className="admin-empty-icon" />
      <p className="admin-empty-title">{title}</p>
      {message && <p className="admin-empty-message">{message}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry, retryLabel }) {
  return (
    <div className="admin-error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

const STATUS_TONE = {
  pending: 'badge-amber',
  in_progress: 'badge-blue',
  resolved: 'badge-green',
  closed: 'badge-gray',
  rejected: 'badge-red',
  active: 'badge-green',
  inactive: 'badge-gray',
  admin: 'badge-ember',
  volunteer: 'badge-blue',
  businessOwner: 'badge-amber',
  beneficiary: 'badge-gray',
}

export function StatusBadge({ status, label }) {
  const tone = STATUS_TONE[status] || 'badge-gray'
  return <span className={`badge ${tone}`}>{label || status}</span>
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="admin-table-wrap" aria-hidden="true">
      <table className="admin-data-table">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((__, c) => (
                <td key={c}>
                  <span className="skeleton skeleton-line" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
