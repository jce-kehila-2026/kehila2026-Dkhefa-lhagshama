import type { ReactNode } from 'react'
import type { TooltipContentProps } from 'recharts'

// Editorial palette pulled from tokens.css — recharts needs literal color
// strings (it cannot read CSS custom properties through SVG fills). Shared by
// the admin and volunteer insights dashboards so both stay on the brand ramp.
export const COLOR_INK = '#0F1E2D' // --ink
export const COLOR_INK_2 = '#2C3D52' // --ink-2
export const COLOR_EMBER = '#B9694E' // --ember
export const COLOR_EMBER_700 = '#9C5440' // --ember-700
export const COLOR_SKY = '#BFD3E6' // --sky
export const COLOR_SKY_2 = '#DCE7F0' // --sky-2
export const COLOR_HAIR = 'rgba(15,30,45,0.10)' // --hair

// One color per status so the by-status chart reads consistently. Falls back
// to ink-2 for any status not in the map.
export const STATUS_COLORS: Record<string, string> = {
  pending: COLOR_SKY,
  in_progress: COLOR_INK_2,
  awaiting_review: COLOR_EMBER,
  closed: COLOR_INK,
  rejected: COLOR_EMBER_700,
  referred: COLOR_SKY_2,
}

// A localized recharts tooltip styled to match the editorial surface; closes
// over the unit label per chart.
export function makeTooltip(valueLabel: string) {
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
