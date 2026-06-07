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

  // ── KPI row — the live numbers an admin opens this page to scan. ──────────
  const kpis: KpiItem[] = [
    { key: 'openRequests', label: a.dash.s.openRequests, tone: 'amber', icon: Inbox },
    { key: 'inProgressRequests', label: a.dash.s.inProgress, tone: 'blue', icon: Clock },
    { key: 'helped', label: a.dash.s.helped, tone: 'green', icon: CheckCircle2 },
    { key: 'activeVolunteers', label: a.dash.s.activeVolunteers, tone: 'green', icon: HeartHandshake },
  ]

  // ── Needs attention — actionable queues, each links to its working area. ──
  const attention: AttentionItem[] = [
    {
      key: 'unassigned',
      label: ops.items.unassigned,
      count: n('openRequests'),
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
      key: 'pendingVol',
      label: ops.items.pendingVol,
      count: n('pendingVolunteers'),
      href: '/admin/volunteers',
      icon: UserPlus,
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
      key: 'pendingCategory',
      label: ops.items.pendingCategory,
      count: n('pendingCategoryRequests'),
      href: '/admin/volunteers',
      icon: ShieldCheck,
      cta: ops.review,
    },
  ]

  // Only items with at least one outstanding entry are surfaced; when nothing
  // is open the section shows a calm "all clear" message.
  const liveAttention = attention.filter((item) => item.count > 0)

  // Compact insights strip — a few headline community totals that link to the
  // full charts. Kept numeric + label so it stays language-neutral per tile.
  const insightTiles: KpiItem[] = [
    { key: 'totalUsers', label: a.dash.s.totalUsers, tone: 'default', icon: Users },
    { key: 'activeVolunteers', label: a.dash.s.activeVolunteers, tone: 'green', icon: HeartHandshake },
    { key: 'helped', label: a.dash.s.helped, tone: 'green', icon: CheckCircle2 },
  ]

  const Arrow = ArrowUpRight

  return (
    <AdminLayout title={a.dash.title} subtitle={a.dash.subtitle}>
      {error && (
        <div style={{ marginBlockEnd: 'var(--sp-5)' }}>
          <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />
        </div>
      )}

      {/* ── TOP KPI ROW ──────────────────────────────────────────────────── */}
      <Reveal>
        <section style={{ marginBlockEnd: 'var(--sp-7)' }}>
          <header style={{ maxWidth: '42rem', marginBlockEnd: 'var(--sp-5)', textAlign: 'start' }}>
            <span style={eyebrowStyle}>{ops.kpiEyebrow}</span>
            <h2 style={sectionHeadingStyle}>{ops.kpiTitle}</h2>
          </header>
          <div className="stat-grid">
            {kpis.map((c) => (
              <StatCard
                key={c.key + c.label}
                label={c.label}
                value={n(c.key)}
                loading={loading}
                tone={c.tone}
                icon={c.icon}
              />
            ))}
          </div>
        </section>
      </Reveal>

      {/* ── NEEDS ATTENTION — actionable queues ──────────────────────────── */}
      <Reveal delay={0.06}>
        <section
          style={{
            background: 'var(--white)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            padding: 'clamp(20px, 3vw, 32px)',
            marginBlockEnd: 'var(--sp-7)',
          }}
        >
          <header style={{ maxWidth: '42rem', marginBlockEnd: 'var(--sp-5)', textAlign: 'start' }}>
            <span style={{ ...eyebrowStyle, color: 'var(--ember)' }}>{ops.attentionEyebrow}</span>
            <h2 style={{ ...sectionHeadingStyle, fontSize: 'var(--fs-h3)' }}>{ops.attentionTitle}</h2>
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

      {/* ── INSIGHTS STRIP — headline totals + a link to the full charts ──── */}
      <Reveal delay={0.1}>
        <section
          style={{
            background: 'var(--white)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            padding: 'clamp(20px, 3vw, 32px)',
          }}
        >
          <header
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 'var(--sp-3)',
              marginBlockEnd: 'var(--sp-5)',
            }}
          >
            <div style={{ textAlign: 'start' }}>
              <span style={{ ...eyebrowStyle, color: 'var(--gray-500)' }}>{ops.insightsEyebrow}</span>
              <h2 style={{ ...sectionHeadingStyle, fontSize: 'var(--fs-h3)' }}>{ops.insightsTitle}</h2>
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
            {insightTiles.map((c) => (
              <StatCard
                key={c.key + c.label}
                label={c.label}
                value={n(c.key)}
                loading={loading}
                tone={c.tone}
                icon={c.icon}
              />
            ))}
          </div>
        </section>
      </Reveal>
    </AdminLayout>
  )
}
