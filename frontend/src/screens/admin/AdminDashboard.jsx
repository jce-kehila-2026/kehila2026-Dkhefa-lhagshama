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
import Reveal from '../../components/motion/Reveal'

// Shared eyebrow style — ui-monospace label that opens each section, echoing
// the marketing pages so the admin surface reads as the same product.
const eyebrowStyle = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ember)',
  display: 'block',
  marginBlockEnd: 'var(--sp-2)',
}

const sectionHeadingStyle = {
  fontFamily: 'Frank Ruhl Libre, Georgia, serif',
  fontSize: 'var(--fs-h2)',
  fontWeight: 400,
  color: 'var(--ink)',
  lineHeight: 1.18,
  letterSpacing: '-0.01em',
  margin: 0,
  textWrap: 'balance',
}

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

  const isHe = lang === 'he'

  // Metrics grouped by meaning: live caseload first (what needs attention),
  // then the community totals. Tone drives only the small status dot inside
  // StatCard, so the figures stay high-contrast.
  const caseload = [
    { key: 'openRequests', label: a.dash.s.openRequests, tone: 'amber', icon: Inbox },
    { key: 'inProgressRequests', label: a.dash.s.inProgress, tone: 'blue', icon: Clock },
    { key: 'helped', label: a.dash.s.helped, tone: 'green', icon: CheckCircle2 },
  ]
  const community = [
    { key: 'activeVolunteers', label: a.dash.s.activeVolunteers, tone: 'green', icon: HeartHandshake },
    { key: 'pendingVolunteers', label: a.dash.s.pendingVolunteers, tone: 'amber', icon: UserPlus },
    { key: 'totalUsers', label: a.dash.s.totalUsers, tone: 'default', icon: Users },
  ]

  const renderGroup = (group) => (
    <div className="stat-grid">
      {group.map((c) => (
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
  )

  // Shortcut descriptions are kept local (bilingual) so the dashboard does not
  // depend on new translation keys; falls back cleanly per language.
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

  const caseloadEyebrow = isHe ? 'תיקים פעילים' : 'Live caseload'
  const caseloadTitle = isHe ? 'מה דורש תשומת לב' : 'What needs attention'
  const communityEyebrow = isHe ? 'הקהילה' : 'Community'
  const communityTitle = isHe ? 'אנשים ברשת' : 'People in the network'

  return (
    <AdminLayout title={a.dash.title} subtitle={a.dash.subtitle}>
      {error && (
        <div style={{ marginBlockEnd: 'var(--sp-5)' }}>
          <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />
        </div>
      )}

      {/* ── LIVE CASELOAD — the metrics an admin opens this page to check ──── */}
      <Reveal>
        <section style={{ marginBlockEnd: 'var(--sp-7)' }}>
          <header
            style={{
              maxWidth: '42rem',
              marginBlockEnd: 'var(--sp-5)',
              textAlign: 'start',
            }}
          >
            <span style={eyebrowStyle}>{caseloadEyebrow}</span>
            <h2 style={sectionHeadingStyle}>{caseloadTitle}</h2>
          </header>
          {renderGroup(caseload)}
        </section>
      </Reveal>

      {/* ── COMMUNITY TOTALS — the standing health of the network ─────────── */}
      <Reveal delay={0.08}>
        <section style={{ marginBlockEnd: 'var(--sp-7)' }}>
          <header
            style={{
              maxWidth: '42rem',
              marginBlockEnd: 'var(--sp-5)',
              textAlign: 'start',
            }}
          >
            <span style={{ ...eyebrowStyle, color: 'var(--ink-2)' }}>{communityEyebrow}</span>
            <h2 style={sectionHeadingStyle}>{communityTitle}</h2>
          </header>
          {renderGroup(community)}
        </section>
      </Reveal>

      {/* ── QUICK LINKS — jump straight into the working areas ────────────── */}
      <Reveal delay={0.12}>
        <section
          className="admin-shortcuts"
          style={{
            background: 'var(--white)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            padding: 'clamp(20px, 3vw, 32px)',
            marginBlockStart: 0,
          }}
        >
          <header
            style={{
              maxWidth: '42rem',
              marginBlockEnd: 'var(--sp-5)',
              textAlign: 'start',
            }}
          >
            <span style={{ ...eyebrowStyle, color: 'var(--gray-500)' }}>
              {isHe ? 'מעבר מהיר' : 'Go to'}
            </span>
            <h2
              className="admin-section-title"
              style={{ margin: 0, fontFamily: 'Frank Ruhl Libre, Georgia, serif', fontWeight: 400, fontSize: 'var(--fs-h3)' }}
            >
              {a.dash.quickLinks}
            </h2>
          </header>

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
                  <ArrowUpRight
                    size={18}
                    aria-hidden="true"
                    className="admin-shortcut-arrow"
                  />
                </Link>
              )
            })}
          </div>
        </section>
      </Reveal>
    </AdminLayout>
  )
}
