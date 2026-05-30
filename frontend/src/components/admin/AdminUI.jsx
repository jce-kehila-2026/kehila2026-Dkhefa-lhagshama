import { Inbox, AlertCircle } from 'lucide-react'

// Maps a thrown apiJson error to a clear, localized message. A 401/403 means
// the signed-in user has no admin custom claim — surface a dedicated message
// (and how to grant access) instead of a generic blank/loading state.
export function adminErrorMessage(err, lang) {
  const status = err?.status
  if (status === 401 || status === 403) {
    return lang === 'he'
      ? 'נדרשת הרשאת מנהל. התחבר/י עם חשבון מנהל (או הרץ npm run set-admin -- <email> בשרת והתחבר/י מחדש).'
      : 'Admin access required. Sign in with an admin account (or run `npm run set-admin -- <email>` on the backend, then sign out and back in).'
  }
  return lang === 'he'
    ? 'טעינת הנתונים נכשלה. נסה/י שוב.'
    : 'Failed to load data. Please try again.'
}

// StatCard — compact dashboard metric. `tone` drives only a small status dot
// next to the label (shape + position cue, never a full color fill), which
// keeps the number high-contrast and avoids the gradient hero-metric cliche.
export function StatCard({ label, value, loading, tone = 'default', hint, icon: Icon }) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-card-head">
        <span className="stat-card-label">{label}</span>
        {Icon ? <Icon size={18} aria-hidden="true" className="stat-card-icon" /> : null}
      </div>
      {loading ? (
        <span className="skeleton skeleton-stat" aria-hidden="true" />
      ) : (
        <span className="stat-card-value">{value}</span>
      )}
      {hint && !loading ? <span className="stat-card-hint">{hint}</span> : null}
    </div>
  )
}

export function EmptyState({ title, message, icon: Icon = Inbox }) {
  return (
    <div className="admin-empty" role="status">
      <span className="admin-empty-badge" aria-hidden="true">
        <Icon size={26} />
      </span>
      <p className="admin-empty-title">{title}</p>
      {message && <p className="admin-empty-message">{message}</p>}
    </div>
  )
}

export function ErrorState({ message, onRetry, retryLabel }) {
  return (
    <div className="admin-error" role="alert">
      <span className="admin-error-text">
        <AlertCircle size={18} aria-hidden="true" />
        <span>{message}</span>
      </span>
      {onRetry && (
        <button type="button" className="btn btn-danger btn-sm" onClick={onRetry}>
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

// A leading dot gives a non-color secondary cue (shape + position), so status
// is never communicated by hue alone — helps color-vision-deficient users.
export function StatusBadge({ status, label }) {
  const tone = STATUS_TONE[status] || 'badge-gray'
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" aria-hidden="true" />
      {label || status}
    </span>
  )
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
