import { EmptyState } from 'push-for-fulfillment-frontend'
import { Inbox, Search } from 'lucide-react'

export function NoRequests() {
  return (
    <div style={{ padding: 16, maxWidth: 480 }}>
      <EmptyState
        title="No requests yet"
        message="When beneficiaries submit requests, they'll appear here for triage."
        icon={Inbox}
      />
    </div>
  )
}

export function NoResults() {
  return (
    <div style={{ padding: 16, maxWidth: 480 }}>
      <EmptyState
        title="No matches found"
        message="Try adjusting your filters or search terms."
        icon={Search}
      />
    </div>
  )
}
