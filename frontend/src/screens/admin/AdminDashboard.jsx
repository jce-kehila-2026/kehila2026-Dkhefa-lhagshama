import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Inbox,
  Clock,
  CheckCircle2,
  HeartHandshake,
  UserPlus,
  Users,
  ArrowUpRight,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import { StatCard, ErrorState, adminErrorMessage } from '@/components/admin/AdminUI'

export default function AdminDashboard() {
  const { t, lang } = useLanguage()
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
    } catch (err) {
      setError(adminErrorMessage(err, lang))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tone + icon per metric: a small status dot beside the label gives meaning
  // (open work = amber, resolved = green) without a hero-metric color fill.
  const cards = [
    { key: 'openRequests', label: a.dash.s.openRequests, tone: 'amber', icon: Inbox },
    { key: 'inProgressRequests', label: a.dash.s.inProgress, tone: 'blue', icon: Clock },
    { key: 'helped', label: a.dash.s.helped, tone: 'green', icon: CheckCircle2 },
    { key: 'activeVolunteers', label: a.dash.s.activeVolunteers, tone: 'green', icon: HeartHandshake },
    { key: 'pendingVolunteers', label: a.dash.s.pendingVolunteers, tone: 'amber', icon: UserPlus },
    { key: 'totalUsers', label: a.dash.s.totalUsers, tone: 'default', icon: Users },
  ]

  // Shortcut descriptions are kept local (bilingual) so the dashboard does not
  // depend on new translation keys; falls back cleanly per language.
  const isHe = lang === 'he'
  const shortcuts = [
    {
      href: '/admin/requests',
      label: a.nav.requests,
      desc: isHe ? 'צפייה וטיפול בבקשות נכנסות' : 'Review and handle incoming requests',
      icon: Inbox,
    },
    {
      href: '/admin/volunteers',
      label: a.nav.volunteers,
      desc: isHe ? 'אישור וניהול מתנדבים' : 'Approve and manage volunteers',
      icon: HeartHandshake,
    },
    {
      href: '/admin/users',
      label: a.nav.users,
      desc: isHe ? 'ניהול תפקידים והרשאות משתמשים' : 'Manage user roles and access',
      icon: Users,
    },
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
            tone={c.tone}
            icon={c.icon}
          />
        ))}
      </div>

      <section className="admin-shortcuts">
        <h2 className="admin-section-title">{a.dash.quickLinks}</h2>
        <div className="admin-shortcut-rows">
          {shortcuts.map((s) => {
            const Icon = s.icon
            return (
              <Link key={s.href} href={s.href} className="admin-shortcut-row">
                <span className="admin-shortcut-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="admin-shortcut-text">
                  <span className="admin-shortcut-title">{s.label}</span>
                  {s.desc && <span className="admin-shortcut-desc">{s.desc}</span>}
                </span>
                <ArrowUpRight size={18} aria-hidden="true" className="admin-shortcut-arrow" />
              </Link>
            )
          })}
        </div>
      </section>
    </AdminLayout>
  )
}
