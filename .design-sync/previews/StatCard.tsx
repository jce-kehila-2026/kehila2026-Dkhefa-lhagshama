import { StatCard } from 'push-for-fulfillment-frontend'
import { Users, Clock, CheckCircle2, AlertTriangle } from 'lucide-react'

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))',
  gap: 16,
  padding: 16,
  maxWidth: 540,
}

export function Dashboard() {
  return (
    <div style={grid}>
      <StatCard label="Open requests" value="128" tone="info" icon={Users} hint="+12 this week" />
      <StatCard label="Awaiting review" value="34" tone="pending" icon={Clock} />
      <StatCard label="Closed" value="892" tone="success" icon={CheckCircle2} />
      <StatCard label="Rejected" value="7" tone="danger" icon={AlertTriangle} hint="needs follow-up" />
    </div>
  )
}

export function Loading() {
  return (
    <div style={grid}>
      <StatCard label="Open requests" loading tone="info" />
      <StatCard label="Closed" loading tone="success" />
    </div>
  )
}
