import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import { StatCard, ErrorState } from '@/components/admin/AdminUI'

export default function AdminDashboard() {
  const { t } = useLanguage()
  const a = t.admin
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiJson('/api/admin/stats')
      setStats(data)
    } catch {
      setError(a.ui.loading)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cards = [
    { key: 'openRequests', label: a.dash.s.openRequests },
    { key: 'inProgressRequests', label: a.dash.s.inProgress },
    { key: 'helped', label: a.dash.s.helped },
    { key: 'activeVolunteers', label: a.dash.s.activeVolunteers },
    { key: 'pendingVolunteers', label: a.dash.s.pendingVolunteers },
    { key: 'totalUsers', label: a.dash.s.totalUsers },
  ]

  return (
    <AdminLayout title={a.dash.title} subtitle={a.dash.subtitle}>
      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      <div className="stat-grid">
        {cards.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            value={stats ? stats[c.key] ?? 0 : 0}
            loading={loading}
          />
        ))}
      </div>

      <section>
        <h2 className="admin-section-title">{a.dash.quickLinks}</h2>
        <div className="admin-quicklinks-grid">
          <Link href="/admin/requests" className="card admin-quicklink">
            {a.nav.requests}
          </Link>
          <Link href="/admin/volunteers" className="card admin-quicklink">
            {a.nav.volunteers}
          </Link>
          <Link href="/admin/users" className="card admin-quicklink">
            {a.nav.users}
          </Link>
        </div>
      </section>
    </AdminLayout>
  )
}
