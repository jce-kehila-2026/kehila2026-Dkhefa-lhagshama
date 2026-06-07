import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
import type { VolunteerInsights } from '@/types'
import VolunteerLayout from '@/components/volunteer-app/VolunteerLayout'
import { ErrorState, EmptyState } from '@/components/admin/AdminUI'

// Editorial palette pulled from tokens.css — recharts needs literal color
// strings (it cannot read CSS custom properties through SVG fills).
const COLOR_INK_2 = '#2C3D52'
const COLOR_EMBER = '#B9694E'
const COLOR_SKY = '#BFD3E6'
const COLOR_HAIR = 'rgba(15,30,45,0.10)'

const STATUS_COLORS: Record<string, string> = {
  pending: '#C9923E',
  in_progress: '#5B7FA6',
  awaiting_review: COLOR_EMBER,
  closed: COLOR_INK_2,
  rejected: '#A24B3B',
  referred: '#6E8C5A',
}

function makeTooltip(valueLabel: string) {
  const TooltipContent = (props: TooltipContentProps) => {
    const { active, payload, label } = props
    if (!active || !payload || payload.length === 0) return null
    const value = payload[0]?.value
    return (
      <div className="insights-tooltip" role="presentation">
        {label != null && <span className="insights-tooltip-label">{label as ReactNode}</span>}
        <span className="insights-tooltip-value">
          {value} <span className="insights-tooltip-unit">{valueLabel}</span>
        </span>
      </div>
    )
  }
  return TooltipContent
}

export default function VolunteerInsightsPage() {
  const { t, lang, isRTL } = useLanguage()
  const v = t.volunteerApp
  const ins = v.insights
  const lifecycle = t.lifecycle

  const [data, setData] = useState<VolunteerInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Gate charts behind a mounted flag to avoid SSR hydration warnings.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson<VolunteerInsights>('/api/volunteer/insights')
      setData(res)
    } catch {
      setError(ins.loadError)
    } finally {
      setLoading(false)
    }
  }, [ins.loadError])

  useEffect(() => {
    load()
  }, [load])

  const statusLabel = (status: string): string => {
    const labels = lifecycle.statusLabels as Record<string, string>
    return labels[status] ?? status
  }

  const byStatusData = useMemo(
    () =>
      (data?.byStatus ?? []).map((d) => ({
        ...d,
        label: statusLabel(d.status),
        fill: STATUS_COLORS[d.status] ?? COLOR_INK_2,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, lang],
  )

  const hasData = useMemo(() => {
    if (!data) return false
    return (
      data.overTime.length > 0 ||
      data.byCategory.length > 0 ||
      data.byStatus.length > 0 ||
      data.avgResolutionDays != null ||
      data.currentLoad > 0
    )
  }, [data])

  const yAxisOrientation = isRTL ? 'right' : 'left'
  const axisTick = { fill: COLOR_INK_2, fontSize: 12 }
  const CountTooltip = useMemo(() => makeTooltip(ins.requestsUnit), [ins.requestsUnit])

  const renderBody = () => {
    if (error) {
      return <ErrorState message={error} onRetry={load} retryLabel={v.ui.retry} />
    }
    if (loading || !mounted) {
      return (
        <div className="insights-grid" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div className="insights-card" key={i}>
              <span className="skeleton skeleton-line insights-skeleton-title" aria-hidden="true" />
              <span className="skeleton insights-skeleton-chart" aria-hidden="true" />
            </div>
          ))}
        </div>
      )
    }
    if (!hasData) {
      return <EmptyState title={ins.empty} />
    }

    return (
      <div className="insights-grid">
        {/* ── OVER TIME (area) ──────────────────────────────── */}
        <section className="insights-card insights-card--wide" aria-label={ins.overTime}>
          <h2 className="insights-card-title">{ins.overTime}</h2>
          {data!.overTime.length > 0 ? (
            <div className="insights-chart" dir="ltr">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data!.overTime} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id="volInsOverTime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLOR_EMBER} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={COLOR_EMBER} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLOR_HAIR} vertical={false} />
                  <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={{ stroke: COLOR_HAIR }} />
                  <YAxis
                    orientation={yAxisOrientation}
                    allowDecimals={false}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip cursor={{ stroke: COLOR_HAIR }} content={CountTooltip} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={COLOR_EMBER}
                    strokeWidth={2}
                    fill="url(#volInsOverTime)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="insights-nodata">{ins.noData}</p>
          )}
        </section>

        {/* ── CURRENT LOAD + AVG RESOLUTION (stats) ─────────── */}
        <section className="insights-card insights-card--stat" aria-label={ins.currentLoad}>
          <h2 className="insights-card-title">{ins.currentLoad}</h2>
          <p className="insights-stat">
            <span className="insights-stat-value">{data!.currentLoad}</span>
            <span className="insights-stat-unit">{ins.requestsUnit}</span>
          </p>
        </section>

        <section className="insights-card insights-card--stat" aria-label={ins.avgResolution}>
          <h2 className="insights-card-title">{ins.avgResolution}</h2>
          {data!.avgResolutionDays != null ? (
            <p className="insights-stat">
              <span className="insights-stat-value">{data!.avgResolutionDays}</span>
              <span className="insights-stat-unit">{ins.days(data!.avgResolutionDays)}</span>
            </p>
          ) : (
            <p className="insights-nodata">{ins.noData}</p>
          )}
        </section>

        {/* ── BY CATEGORY (bar) ─────────────────────────────── */}
        <section className="insights-card" aria-label={ins.byCategory}>
          <h2 className="insights-card-title">{ins.byCategory}</h2>
          {data!.byCategory.length > 0 ? (
            <div className="insights-chart" dir="ltr">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data!.byCategory} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke={COLOR_HAIR} vertical={false} />
                  <XAxis dataKey="category" tick={axisTick} tickLine={false} axisLine={{ stroke: COLOR_HAIR }} interval={0} />
                  <YAxis
                    orientation={yAxisOrientation}
                    allowDecimals={false}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip cursor={{ fill: 'rgba(15,30,45,0.04)' }} content={CountTooltip} />
                  <Bar dataKey="count" fill={COLOR_SKY} radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="insights-nodata">{ins.noData}</p>
          )}
        </section>

        {/* ── BY STATUS (bar, per-status color) ─────────────── */}
        <section className="insights-card" aria-label={ins.byStatus}>
          <h2 className="insights-card-title">{ins.byStatus}</h2>
          {byStatusData.length > 0 ? (
            <div className="insights-chart" dir="ltr">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byStatusData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke={COLOR_HAIR} vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: COLOR_HAIR }} interval={0} />
                  <YAxis
                    orientation={yAxisOrientation}
                    allowDecimals={false}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip cursor={{ fill: 'rgba(15,30,45,0.04)' }} content={CountTooltip} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {byStatusData.map((entry) => (
                      <Cell key={entry.status} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="insights-nodata">{ins.noData}</p>
          )}
        </section>
      </div>
    )
  }

  return (
    <VolunteerLayout title={ins.title} subtitle={ins.subtitle}>
      {renderBody()}
    </VolunteerLayout>
  )
}
