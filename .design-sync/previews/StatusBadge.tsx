import { StatusBadge } from 'push-for-fulfillment-frontend'

export function RequestLifecycle() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16 }}>
      <StatusBadge status="pending" label="Pending" />
      <StatusBadge status="in_progress" label="In progress" />
      <StatusBadge status="awaiting_review" label="Awaiting review" />
      <StatusBadge status="closed" label="Closed" />
      <StatusBadge status="rejected" label="Rejected" />
      <StatusBadge status="referred" label="Referred" />
    </div>
  )
}

export function Roles() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16 }}>
      <StatusBadge status="admin" label="Admin" />
      <StatusBadge status="volunteer" label="Volunteer" />
      <StatusBadge status="businessOwner" label="Business owner" />
      <StatusBadge status="beneficiary" label="Beneficiary" />
    </div>
  )
}
