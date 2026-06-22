/*
 * InsightsRangeSelect — shared time-range picker for the insights dashboards
 * (admin + volunteer-hub). renders a segmented row of preset buttons plus an
 * optional custom from/to date window; it is fully controlled (no internal
 * state) so the parent owns the selected range and the custom dates and decides
 * how to query. labels come from the shared HE/EN translations, so the control
 * is bilingual/RTL-safe by reading t.common.insightsRange.
 */
import { useLanguage } from '@/contexts/LanguageContext'

// preset keys + the 'custom' sentinel; exported so dashboards share one source of truth for the range options.
export const INSIGHTS_RANGES = ['7d', '30d', '90d', '12m', 'all', 'custom'] as const
export type InsightsRange = (typeof INSIGHTS_RANGES)[number]

export default function InsightsRangeSelect({
  value,
  onChange,
  from,
  to,
  onDates,
}: {
  value: InsightsRange
  onChange: (r: InsightsRange) => void
  from: string
  to: string
  onDates: (from: string, to: string) => void
}) {
  // controlled component: value/onChange drive the preset selection; from/to/onDates drive the custom window.
  const { t } = useLanguage()
  const r = t.common.insightsRange
  // map each range key to its localized button label.
  const LABELS: Record<InsightsRange, string> = {
    '7d': r.d7,
    '30d': r.d30,
    '90d': r.d90,
    '12m': r.m12,
    all: r.all,
    custom: r.custom,
  }
  return (
    <div className="insights-range-wrap">
      <div className="insights-range" role="group" aria-label={r.label}>
        {INSIGHTS_RANGES.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`insights-range-opt${value === opt ? ' is-active' : ''}`}
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
          >
            {LABELS[opt]}
          </button>
        ))}
      </div>
      {/* custom from/to window only shown for the 'custom' preset */}
      {value === 'custom' && (
        <div className="insights-range-custom">
          <label className="insights-range-date">
            <span>{r.from}</span>
            <input
              type="date"
              className="form-input"
              value={from}
              max={to || undefined} // keep from <= to; undefined when to is empty so the picker stays open
              onChange={(e) => onDates(e.target.value, to)}
            />
          </label>
          <label className="insights-range-date">
            <span>{r.to}</span>
            <input
              type="date"
              className="form-input"
              value={to}
              min={from || undefined} // keep to >= from; undefined when from is empty
              onChange={(e) => onDates(from, e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  )
}
