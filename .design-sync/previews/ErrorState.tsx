import { ErrorState } from 'push-for-fulfillment-frontend'

export function WithRetry() {
  return (
    <div style={{ padding: 16, maxWidth: 520 }}>
      <ErrorState
        message="Couldn't load the volunteer roster. Check your connection and try again."
        retryLabel="Retry"
        onRetry={() => {}}
      />
    </div>
  )
}

export function PermissionDenied() {
  return (
    <div style={{ padding: 16, maxWidth: 520 }}>
      <ErrorState message="Admin access required. Sign in with an admin account to view requests." />
    </div>
  )
}

export function SaveFailed() {
  return (
    <div style={{ padding: 16, maxWidth: 520 }}>
      <ErrorState
        message="Failed to assign this request to Dana Levi. Please try again."
        retryLabel="Try again"
        onRetry={() => {}}
      />
    </div>
  )
}
