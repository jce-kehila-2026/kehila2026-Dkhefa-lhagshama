import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import {
  Inbox,
  Clock,
  CheckCircle2,
  HeartHandshake,
  Users,
  UserPlus,
  ClipboardCheck,
  HandHeart,
  ShieldCheck,
  FolderCheck,
  Sparkles,
  ArrowUpRight,
  BarChart3,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import { StatCard, ErrorState, adminErrorMessage } from '@/components/admin/AdminUI'
import Reveal from '../../components/motion/Reveal'

// Shared eyebrow style — ui-monospace label that opens each section, echoing
// the marketing pages so the admin surface reads as the same product.
const eyebrowStyle: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ember)',
  display: 'block',
  marginBlockEnd: 'var(--sp-2)',
}

const sectionHeadingStyle: CSSProperties = {
  fontFamily: 'Frank Ruhl Libre, Georgia, serif',
  fontSize: 'var(--fs-h2)',
  fontWeight: 400,
  color: 'var(--ink)',
  lineHeight: 1.18,
  letterSpacing: '-0.01em',
  margin: 0,
  textWrap: 'balance',
}

interface KpiItem {
  key: string
  label: string
  tone: string
  icon: LucideIcon
  href: string
}

// An actionable "needs attention" row: a count of items that, when non-zero,
// links the admin straight to the place they handle them.
interface AttentionItem {
  key: string
  label: string
  count: number
  href: string
  icon: LucideIcon
  cta: string
}

export default function AdminDashboard() {
  const { t, lang, isRTL } = useLanguage()
  const a = t.admin
  const ops = a.dashOps
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiJson('/api/admin/stats') as Record<string, number>
      setStats(data)
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const n = (key: string): number => (stats ? stats[key] ?? 0 : 0)

  // ── KPI strip — every number links to its filtered list (WS-4). ──────────
  const kpis: KpiItem[] = [
    { key: 'openRequests', label: a.dash.s.openRequests, tone: 'amber', icon: Inbox, href: '/admin/requests?status=pending' },
    { key: 'inProgressRequests', label: a.dash.s.inProgress, tone: 'blue', icon: Clock, href: '/admin/requests?status=in_progress' },
    { key: 'awaitingReviewRequests', label: a.dash.s.awaitingReview, tone: 'amber', icon: ClipboardCheck, href: '/admin/requests?status=awaiting_review' },
    { key: 'closedRequests', label: a.dash.s.helped, tone: 'green', icon: CheckCircle2, href: '/admin/requests?status=closed' },
    { key: 'activeVolunteers', label: a.dash.s.activeVolunteers, tone: 'green', icon: HeartHandshake, href: '/admin/volunteers?tab=active' },
    { key: 'totalUsers', label: a.dash.s.usersLink, tone: 'default', icon: Users, href: '/admin/users' },
  ]

  // ── Needs attention — actionable queues, each links to its working area. ──
  const attention: AttentionItem[] = [
    {
      key: 'unassigned',
      label: ops.items.unassigned,
      count: n('unassignedRequests'),
      href: '/admin/requests?status=pending',
      icon: Inbox,
      cta: ops.open,
    },
    {
      key: 'awaitingReview',
      label: ops.items.awaitingReview,
      count: n('awaitingReviewRequests'),
      href: '/admin/requests?status=awaiting_review',
      icon: ClipboardCheck,
      cta: ops.review,
    },
    {
      key: 'withClaims',
      label: ops.items.withClaims,
      count: n('requestsWithClaims'),
      href: '/admin/requests?claims=true',
      icon: HandHeart,
      cta: ops.review,
    },
    {
      key: 'pendingVol',
      label: ops.items.pendingVol,
      count: n('pendingVolunteers'),
      href: '/admin/volunteers?tab=pending',
      icon: UserPlus,
      cta: ops.review,
    },
    {
      key: 'pendingCategory',
      label: ops.items.pendingCategory,
      count: n('pendingCategoryRequests'),
      href: '/admin/volunteers?tab=pending',
      icon: ShieldCheck,
      cta: ops.review,
    },
    {
      key: 'pendingDirectory',
      label: ops.items.pendingDirectory,
      count: n('pendingDirectory'),
      href: '/admin/directory',
      icon: FolderCheck,
      cta: ops.review,
    },
    {
      key: 'todayNew',
      label: ops.items.todayNew,
      count: n('todayNewRequests'),
      href: '/admin/requests?status=pending',
      icon: Sparkles,
      cta: ops.view,
    },
  ]

  // Only items with at least one outstanding entry are surfaced; when nothing
  // is open the section shows a calm "all clear" message.
  const liveAttention = attention.filter((item) => item.count > 0)

  const Arrow = ArrowUpRight

  return (
    <AdminLayout title={a.dash.title} subtitle={a.dash.subtitle}>
      {error && (
        <div style={{ marginBlockEnd: 'var(--sp-5)' }}>
          <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />
        </div>
      )}

      {/* ── NEEDS ATTENTION — actionable queue, first and bold ──────────────── */}
      <Reveal>
        <section
          style={{
            background: 'var(--white)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            padding: 'clamp(20px, 3vw, 32px)',
            marginBlockEnd: 'var(--sp-6)',
          }}
        >
          <header style={{ maxWidth: '42rem', marginBlockEnd: 'var(--sp-5)', textAlign: 'start' }}>
            <span style={{ ...eyebrowStyle, color: 'var(--ember)' }}>{ops.attentionEyebrow}</span>
            <h2 style={sectionHeadingStyle}>{ops.attentionTitle}</h2>
          </header>

          {loading ? (
            <div className="admin-attention-grid">
              {[0, 1, 2].map((i) => (
                <div key={i} className="admin-attention-card" aria-hidden="true">
                  <span className="skeleton skeleton-line" style={{ width: '60%' }} />
                  <span className="skeleton skeleton-stat" style={{ marginBlockStart: 'var(--sp-3)' }} />
                </div>
              ))}
            </div>
          ) : liveAttention.length === 0 ? (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-4)',
                borderRadius: 'var(--radius)',
                border: '1px dashed var(--gray-300)',
                background: 'var(--paper)',
                color: 'var(--gray-600)',
              }}
            >
              <CheckCircle2 size={18} aria-hidden="true" style={{ color: 'var(--success)' }} />
              <span>{ops.attentionEmpty}</span>
            </div>
          ) : (
            <div className="admin-attention-grid">
              {liveAttention.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.key} href={item.href} className="admin-attention-card">
                    <span className="admin-attention-head">
                      <span className="admin-attention-icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <Arrow
                        size={16}
                        aria-hidden="true"
                        className="admin-attention-arrow"
                        style={isRTL ? { transform: 'scaleX(-1)' } : undefined}
                      />
                    </span>
                    <span className="admin-attention-count">{item.count}</span>
                    <span className="admin-attention-label">{item.label}</span>
                    <span className="admin-attention-cta">{item.cta}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </Reveal>

      {/* ── KPI STRIP — compact, every number links to its list ─────────────── */}
      <Reveal delay={0.06}>
        <section style={{ marginBlockEnd: 'var(--sp-5)' }}>
          <header
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 'var(--sp-3)',
              marginBlockEnd: 'var(--sp-4)',
            }}
          >
            <div style={{ textAlign: 'start' }}>
              <span style={{ ...eyebrowStyle, color: 'var(--gray-500)' }}>{ops.kpiEyebrow}</span>
              <h2 style={{ ...sectionHeadingStyle, fontSize: 'var(--fs-h3)' }}>{ops.kpiStripTitle}</h2>
            </div>
            <Link
              href="/admin/insights"
              className="btn btn-ghost btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <BarChart3 size={15} aria-hidden="true" />
              {ops.viewInsights}
            </Link>
          </header>
          <div className="stat-grid">
            {kpis.map((c) => (
              <StatCard
                key={c.key + c.label}
                label={c.label}
                value={n(c.key)}
                loading={loading}
                tone={c.tone}
                href={c.href}
              />
            ))}
          </div>
        </section>
      </Reveal>
    </AdminLayout>
  )
}
