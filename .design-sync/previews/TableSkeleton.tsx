import { TableSkeleton } from 'push-for-fulfillment-frontend'

export function RequestsTable() {
  return (
    <div style={{ padding: 16, maxWidth: 640 }}>
      <TableSkeleton rows={6} cols={5} />
    </div>
  )
}

export function Compact() {
  return (
    <div style={{ padding: 16, maxWidth: 420 }}>
      <TableSkeleton rows={3} cols={3} />
    </div>
  )
}

export function Default() {
  return (
    <div style={{ padding: 16, maxWidth: 560 }}>
      <TableSkeleton />
    </div>
  )
}
