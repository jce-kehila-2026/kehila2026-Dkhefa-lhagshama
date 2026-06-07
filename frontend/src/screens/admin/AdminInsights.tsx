import { useEffect, useMemo, useState } from 'react'
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
import { apiFetch } from '@/lib/apiClient'
import type { InsightsData } from '@/types'
import AdminLayout from '@/components/admin/AdminLayout'
import { ErrorState, EmptyState, adminErrorMessage } from '@/components/admin/AdminUI'

// Editorial palette pulled from the design tokens — recharts needs literal
// color strings (it cannot read CSS custom properties through SVG fills), so
// these mirror tokens.css. No new colors are introduced.
const COLOR_INK = '#0F1E2D'
const COLOR_INK_2 = '#2C3D52'
const COLOR_EMBER = '#B9694E'
const COLOR_SKY = '#BFD3E6'
const COLOR_HAIR = 'rgba(15,30,45,0.10)'

// One color per status so the by-status chart reads consistently. Falls back
// to ink-2 for any status not in the map.
const STATUS_COLORS: Record<string, string> = {
  pending: '#C9923E',
  in_progress: '#5B7FA6',
  awaiting_review: COLOR_EMBER,
  closed: COLOR_INK_2,
  rejected: '#A24B3B',
  referred: '#6E8C5A',
}

// A localized recharts tooltip styled to match the editorial surface. recharts
// hands its `content` render prop the full TooltipContentProps bag; we read only
// active/label/payload and close over the unit label per chart.
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

export default function AdminInsights() {
  const { t, lang, isRTL } = useLanguage()
  const ins = t.insights
  const lifecycle = t.lifecycle
  const age = t.admin.ageInsights

  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Recharts renders raw SVG with measured dimensions, which diverges between
  // the server and client and triggers hydration warnings. Gate the charts
  // behind a mounted flag so they only render in the browser.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/admin/insights')
      if (!res.ok) {
        const err = { status: res.status }
        throw err
      }
      const json = (await res.json()) as InsightsData
      setData(json)
    } catch (err) {
      const status = (err as { status?: number } | null)?.status
      // 401/403 → admin-access message; everything else → insights load error.
      setError(
        status === 401 || status === 403
          ? adminErrorMessage(err as { status?: number }, lang)
          : ins.loadError,
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Translate the raw status key into the localized lifecycle label for the
  // by-status chart axis + tooltip.
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
      data.perVolunteer.length > 0 ||
      data.avgResolutionDays != null ||
      data.ageStats?.averageAge != null ||
      (data.ageStats?.buckets?.length ?? 0) > 0
    )
  }, [data])

  // req 24 — age distribution buckets. Guarded so an absent ageStats payload
  // (older backend) renders nothing rather than crashing.
  const ageBuckets = data?.ageStats?.buckets ?? []
  const averageAge = data?.ageStats?.averageAge ?? null

  // Charts read most naturally LTR even in RTL UIs (time flows left→right),
  // but axis ticks and the y-axis side flip so Hebrew labels sit on the start.
  const yAxisOrientation = isRTL ? 'right' : 'left'
  const axisTick = { fill: COLOR_INK_2, fontSize: 12 }

  // All request charts count requests, so a single "Requests" unit tooltip is
  // reused; the age chart counts beneficiaries, so it gets its own unit.
  const CountTooltip = useMemo(() => makeTooltip(ins.axis.count), [ins.axis.count])
  const PeopleTooltip = useMemo(() => makeTooltip(age.peopleUnit), [age.peopleUnit])

  const renderBody = () => {
    if (error) {
      return <ErrorState message={error} onRetry={load} retryLabel={t.admin.ui.retry} />
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
        {/* ── REQUESTS OVER TIME (area) ─────────────────────────── */}
        <section className="insights-card insights-card--wide" aria-label={ins.charts.overTime}>
          <h2 className="insights-card-title">{ins.charts.overTime}</h2>
          {data!.overTime.length > 0 ? (
            <div className="insights-chart" dir="ltr">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data!.overTime} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id="insightsOverTime" x1="0" y1="0" x2="0" y2="1">
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
                  <Tooltip
                    cursor={{ stroke: COLOR_HAIR }}
                    content={CountTooltip}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={COLOR_EMBER}
                    strokeWidth={2}
                    fill="url(#insightsOverTime)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="insights-nodata">{ins.axis.noData}</p>
          )}
        </section>

        {/* ── AVERAGE RESOLUTION TIME (stat) ────────────────────── */}
        <section className="insights-card insights-card--stat" aria-label={ins.charts.avgResolution}>
          <h2 className="insights-card-title">{ins.charts.avgResolution}</h2>
          {data!.avgResolutionDays != null ? (
            <p className="insights-stat">
              <span className="insights-stat-value">{data!.avgResolutionDays}</span>
              <span className="insights-stat-unit">
                {ins.avgResolutionDays(data!.avgResolutionDays)}
              </span>
            </p>
          ) : (
            <p className="insights-nodata">{ins.axis.noData}</p>
          )}
        </section>

        {/* ── REQUESTS BY CATEGORY (bar) ────────────────────────── */}
        <section className="insights-card" aria-label={ins.charts.byCategory}>
          <h2 className="insights-card-title">{ins.charts.byCategory}</h2>
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
                  <Tooltip
                    cursor={{ fill: 'rgba(15,30,45,0.04)' }}
                    content={CountTooltip}
                  />
                  <Bar dataKey="count" fill={COLOR_SKY} radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="insights-nodata">{ins.axis.noData}</p>
          )}
        </section>

        {/* ── REQUESTS BY STATUS (bar, per-status color) ────────── */}
        <section className="insights-card" aria-label={ins.charts.byStatus}>
          <h2 className="insights-card-title">{ins.charts.byStatus}</h2>
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
                  <Tooltip
                    cursor={{ fill: 'rgba(15,30,45,0.04)' }}
                    content={CountTooltip}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {byStatusData.map((entry) => (
                      <Cell key={entry.status} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="insights-nodata">{ins.axis.noData}</p>
          )}
        </section>

        {/* ── PER-VOLUNTEER WORKLOAD (horizontal bar) ───────────── */}
        <section className="insights-card insights-card--wide" aria-label={ins.charts.volunteerWorkload}>
          <h2 className="insights-card-title">{ins.charts.volunteerWorkload}</h2>
          {data!.perVolunteer.length > 0 ? (
            <div className="insights-chart" dir="ltr">
              <ResponsiveContainer width="100%" height={Math.max(160, data!.perVolunteer.length * 44)}>
                <BarChart
                  data={data!.perVolunteer}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                >
                  <CartesianGrid stroke={COLOR_HAIR} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={{ stroke: COLOR_HAIR }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    orientation={yAxisOrientation}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(15,30,45,0.04)' }}
                    content={CountTooltip}
                  />
                  <Bar dataKey="count" fill={COLOR_INK} radius={[0, 4, 4, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="insights-nodata">{ins.axis.noData}</p>
          )}
        </section>

        {/* ── AVERAGE BENEFICIARY AGE (stat) — req 24 ───────────── */}
        <section className="insights-card insights-card--stat" aria-label={age.avgLabel}>
          <h2 className="insights-card-title">{age.avgLabel}</h2>
          {averageAge != null ? (
            <p className="insights-stat">
              <span className="insights-stat-value">{averageAge}</span>
              <span className="insights-stat-unit">{age.avgUnit}</span>
            </p>
          ) : (
            <p className="insights-nodata">{age.noAge}</p>
          )}
        </section>

        {/* ── AGE DISTRIBUTION (bar) — req 24 ───────────────────── */}
        <section className="insights-card" aria-label={age.distribution}>
          <h2 className="insights-card-title">{age.distribution}</h2>
          {ageBuckets.length > 0 ? (
            <div className="insights-chart" dir="ltr">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={ageBuckets} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
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
                  <Tooltip
                    cursor={{ fill: 'rgba(15,30,45,0.04)' }}
                    content={PeopleTooltip}
                  />
                  <Bar dataKey="count" fill={COLOR_EMBER} radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="insights-nodata">{age.noAge}</p>
          )}
        </section>
      </div>
    )
  }

  return (
    <AdminLayout title={ins.pageTitle} subtitle={ins.pageSubtitle}>
      {renderBody()}
    </AdminLayout>
  )
}
