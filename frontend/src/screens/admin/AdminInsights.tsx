/**
 * AdminInsights — the admin "Insights" analytics screen (UC-05 reporting).
 *
 * Fetches aggregated request analytics from GET /api/admin/insights (filtered by
 * the selected time range) and renders them as a scalar KPI strip plus four
 * recharts visuals: requests-over-time (hero area), by-category + by-status
 * bars, per-volunteer workload, and beneficiary age distribution (req 24).
 * Fully bilingual/RTL: status + category ids resolve through the localized
 * lifecycle map and the admin-managed category taxonomy before reaching recharts.
 *
 * Rendered inside AdminLayout; data shape is InsightsData. Charts are client-only
 * (mounted gate) to avoid recharts SSR hydration mismatches, and honor
 * prefers-reduced-motion. Backend-optional fields (ageStats/kpis) are guarded so
 * an older backend renders gracefully rather than crashing.
 */
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
import { useReducedMotion } from 'motion/react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCategories } from '@/hooks/useCategories'
import { apiFetch } from '@/lib/apiClient'
import type { InsightsData } from '@/types'
import AdminLayout from '@/components/admin/AdminLayout'
import InsightsRangeSelect, { type InsightsRange } from '@/components/InsightsRangeSelect'
import { ErrorState, EmptyState, adminErrorMessage } from '@/components/admin/AdminUI'
import Reveal from '@/components/motion/Reveal'

// Editorial palette pulled from the design tokens — recharts needs literal
// color strings (it cannot read CSS custom properties through SVG fills), so
// these mirror tokens.css. No colors outside the brand palette are introduced.
const COLOR_INK = '#0F1E2D' // --ink
const COLOR_INK_2 = '#2C3D52' // --ink-2
const COLOR_EMBER = '#B9694E' // --ember
const COLOR_EMBER_700 = '#9C5440' // --ember-700
const COLOR_SKY = '#BFD3E6' // --sky
const COLOR_SKY_2 = '#DCE7F0' // --sky-2
const COLOR_HAIR = 'rgba(15,30,45,0.10)' // --hair
const COLOR_CURSOR = 'rgba(15,30,45,0.04)' // hairline-tint hover cursor
// Light brand fills (sky/sky-2) sit below the 3:1 non-text contrast floor on
// white (WCAG 1.4.11), so bars that use them carry a thin ink-hairline outline
// to make their boundary perceivable. Negligible on the darker ink/ember bars.
const COLOR_BAR_STROKE = 'rgba(15,30,45,0.32)'

// One color per status so the by-status chart reads consistently. Every value
// is a brand token from the ember/ink/sky ramps (no rainbow defaults), and each
// stays clearly visible as a filled bar on the white card surface. Falls back
// to ink-2 for any status not in the map.
const STATUS_COLORS: Record<string, string> = {
  pending: COLOR_SKY,
  in_progress: COLOR_INK_2,
  awaiting_review: COLOR_EMBER,
  closed: COLOR_INK,
  rejected: COLOR_EMBER_700,
  referred: COLOR_SKY_2,
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
  const kpi = t.insights.kpi
  const sections = t.insights.sections
  // Bilingual category labels from the admin-managed taxonomy (chart axis).
  const { labelFor } = useCategories()

  // Honor prefers-reduced-motion: recharts animates bars/areas on mount by
  // default, so we disable that growth tween when the user opts out. Charts
  // still render instantly at their final values.
  const reduceMotion = useReducedMotion()
  const animateCharts = !reduceMotion

  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Recharts renders raw SVG with measured dimensions, which diverges between
  // the server and client and triggers hydration warnings. Gate the charts
  // behind a mounted flag so they only render in the browser.
  const [mounted, setMounted] = useState(false)
  const [range, setRange] = useState<InsightsRange>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  useEffect(() => {
    setMounted(true)
  }, [])

  // fetch + map the insights payload for the current range/dates into state.
  // re-runnable as the ErrorState retry handler and on every range change.
  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      // custom range sends explicit from/to (omitting the query entirely when
      // neither bound is set yet); presets send the ?range=<preset> shorthand.
      const params =
        range === 'custom' ? (from || to ? `?from=${from}&to=${to}` : '') : `?range=${range}`
      const res = await apiFetch('/api/admin/insights' + params)
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
  }, [range, from, to])

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

  // Mirror the statusLabel approach for categories: ids resolve through the
  // admin-managed taxonomy (labelFor) before the data reaches recharts, so
  // the axis shows bilingual labels instead of raw stored keys.
  const byCategoryData = useMemo(
    () =>
      (data?.byCategory ?? []).map((d) => ({
        ...d,
        label: labelFor(d.category),
      })),
    [data, labelFor],
  )

  // true if any series/scalar has something to show; gates the whole body
  // between the EmptyState and the charts so an all-zero payload reads as empty.
  const hasData = useMemo(() => {
    if (!data) return false
    return (
      data.overTime.length > 0 ||
      data.byCategory.length > 0 ||
      data.byStatus.length > 0 ||
      data.perVolunteer.length > 0 ||
      data.avgResolutionDays != null ||
      data.ageStats?.averageAge != null ||
      (data.ageStats?.buckets?.length ?? 0) > 0 ||
      (data.kpis?.totalRequests ?? 0) > 0
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

  // WS-10 — scalar KPI strip values. Each falls back to the localized en-dash
  // placeholder when the backend has nothing to report yet.
  const k = data?.kpis ?? null
  const kpiItems: { key: string; label: string; value: string; lead?: boolean }[] = [
    { key: 'total', label: kpi.total, value: k ? String(k.totalRequests) : kpi.noValue, lead: true },
    { key: 'open', label: kpi.open, value: k ? String(k.openRequests) : kpi.noValue },
    { key: 'closedThisMonth', label: kpi.closedThisMonth, value: k ? String(k.closedThisMonth) : kpi.noValue },
    {
      key: 'closureRate',
      label: kpi.closureRate,
      value: k && k.closureRate != null ? ins.closureRatePct(k.closureRate) : kpi.noValue,
    },
    {
      key: 'avgResolution',
      label: kpi.avgResolution,
      value: data?.avgResolutionDays != null ? ins.avgResolutionDays(data.avgResolutionDays) : kpi.noValue,
    },
    {
      key: 'avgAge',
      label: kpi.avgAge,
      value: averageAge != null ? `${averageAge} ${age.avgUnit}` : kpi.noValue,
    },
  ]

  // body state machine: error → skeleton (loading or pre-mount) → empty → charts.
  const renderBody = () => {
    if (error) {
      return <ErrorState message={error} onRetry={load} retryLabel={t.admin.ui.retry} />
    }
    if (loading || !mounted) {
      return (
        <div className="admin-insights" aria-busy="true">
          <div className="insights-kpi-strip">
            {[0, 1, 2, 3].map((i) => (
              <div className="insights-kpi" key={i}>
                <span className="skeleton skeleton-line insights-skeleton-title" aria-hidden="true" />
                <span className="skeleton skeleton-line insights-skeleton-title" aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="insights-grid">
            {[0, 1, 2, 3].map((i) => (
              <div className="insights-card" key={i}>
                <span className="skeleton skeleton-line insights-skeleton-title" aria-hidden="true" />
                <span className="skeleton insights-skeleton-chart" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (!hasData) {
      return <EmptyState title={ins.empty} />
    }

    return (
      // One motivated entrance: the whole insights view fades + rises once after
      // data loads. Reveal renders static under prefers-reduced-motion.
      <Reveal className="admin-insights" y={16}>
        {/* ── KPI STRIP (compact scalar numbers, no big single-number cards) ── */}
        <section className="insights-kpi-strip" aria-label={kpi.eyebrow}>
          {kpiItems.map((item) => (
            <div
              className={item.lead ? 'insights-kpi insights-kpi--lead' : 'insights-kpi'}
              key={item.key}
            >
              <span className="insights-kpi-label">{item.label}</span>
              <span className="insights-kpi-value">{item.value}</span>
            </div>
          ))}
        </section>

        {/* ── VOLUME & THROUGHPUT — hero over-time chart, promoted first ───── */}
        <section className="insights-section" aria-label={sections.volume}>
          <h2 className="insights-section-title">{sections.volume}</h2>
          <div className="insights-card insights-card--hero" aria-label={ins.charts.overTime}>
            <h3 className="insights-card-title">{ins.charts.overTime}</h3>
            {data!.overTime.length > 0 ? (
              <div className="insights-chart" dir="ltr" role="img" aria-label={ins.charts.overTime}>
                <ResponsiveContainer width="100%" height={320}>
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
                    <Tooltip cursor={{ stroke: COLOR_HAIR }} content={CountTooltip} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={COLOR_EMBER}
                      strokeWidth={2}
                      fill="url(#insightsOverTime)"
                      isAnimationActive={animateCharts}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="insights-nodata">{ins.axis.noData}</p>
            )}
          </div>
        </section>

        {/* ── BREAKDOWN — category + status bars, two-up ──────────────────── */}
        <section className="insights-section" aria-label={sections.breakdown}>
          <h2 className="insights-section-title">{sections.breakdown}</h2>
          <div className="insights-grid">
            <div className="insights-card" aria-label={ins.charts.byCategory}>
              <h3 className="insights-card-title">{ins.charts.byCategory}</h3>
              {data!.byCategory.length > 0 ? (
                <div className="insights-chart" dir="ltr" role="img" aria-label={ins.charts.byCategory}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={byCategoryData} layout="vertical" margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                      <CartesianGrid stroke={COLOR_HAIR} horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={{ stroke: COLOR_HAIR }} />
                      <YAxis type="category" dataKey="label" orientation={yAxisOrientation} tick={axisTick} tickLine={false} axisLine={false} width={120} interval={0} />
                      <Tooltip cursor={{ fill: COLOR_CURSOR }} content={CountTooltip} />
                      <Bar dataKey="count" fill={COLOR_SKY} stroke={COLOR_BAR_STROKE} strokeWidth={1} radius={[0, 4, 4, 0]} maxBarSize={26} isAnimationActive={animateCharts} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="insights-nodata">{ins.axis.noData}</p>
              )}
            </div>

            <div className="insights-card" aria-label={ins.charts.byStatus}>
              <h3 className="insights-card-title">{ins.charts.byStatus}</h3>
              {byStatusData.length > 0 ? (
                <div className="insights-chart" dir="ltr" role="img" aria-label={ins.charts.byStatus}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={byStatusData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                      <CartesianGrid stroke={COLOR_HAIR} vertical={false} />
                      <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: COLOR_HAIR }} interval={0} />
                      <YAxis orientation={yAxisOrientation} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={36} />
                      <Tooltip cursor={{ fill: COLOR_CURSOR }} content={CountTooltip} />
                      <Bar dataKey="count" stroke={COLOR_BAR_STROKE} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={animateCharts}>
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
            </div>
          </div>
        </section>

        {/* ── PEOPLE — per-volunteer workload ─────────────────────────────── */}
        <section className="insights-section" aria-label={sections.people}>
          <h2 className="insights-section-title">{sections.people}</h2>
          <div className="insights-card" aria-label={ins.charts.volunteerWorkload}>
            <h3 className="insights-card-title">{ins.charts.volunteerWorkload}</h3>
            {data!.perVolunteer.length > 0 ? (
              <div className="insights-chart" dir="ltr" role="img" aria-label={ins.charts.volunteerWorkload}>
                <ResponsiveContainer width="100%" height={Math.max(160, data!.perVolunteer.length * 44)}>
                  <BarChart data={data!.perVolunteer} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke={COLOR_HAIR} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={{ stroke: COLOR_HAIR }} />
                    <YAxis type="category" dataKey="name" orientation={yAxisOrientation} tick={axisTick} tickLine={false} axisLine={false} width={120} />
                    <Tooltip cursor={{ fill: COLOR_CURSOR }} content={CountTooltip} />
                    <Bar dataKey="count" fill={COLOR_INK} radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={animateCharts} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="insights-nodata">{ins.axis.noData}</p>
            )}
          </div>
        </section>

        {/* ── BENEFICIARIES — age distribution (req 24) ───────────────────── */}
        <section className="insights-section" aria-label={sections.beneficiaries}>
          <h2 className="insights-section-title">{sections.beneficiaries}</h2>
          <div className="insights-card" aria-label={age.distribution}>
            <h3 className="insights-card-title">{age.distribution}</h3>
            {ageBuckets.length > 0 ? (
              <div className="insights-chart" dir="ltr" role="img" aria-label={age.distribution}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ageBuckets} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke={COLOR_HAIR} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: COLOR_HAIR }} interval={0} />
                    <YAxis orientation={yAxisOrientation} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={36} />
                    <Tooltip cursor={{ fill: COLOR_CURSOR }} content={PeopleTooltip} />
                    <Bar dataKey="count" fill={COLOR_EMBER} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={animateCharts} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="insights-nodata">{age.noAge}</p>
            )}
          </div>
        </section>
      </Reveal>
    )
  }

  return (
    <AdminLayout title={ins.pageTitle} subtitle={ins.pageSubtitle}>
      <InsightsRangeSelect
        value={range}
        onChange={setRange}
        from={from}
        to={to}
        onDates={(f, t) => {
          setFrom(f)
          setTo(t)
        }}
      />
      {renderBody()}
    </AdminLayout>
  )
}
