import { Clock3, History } from 'lucide-react'
import type { Translations } from '@/contexts/LanguageContext'
import { EYEBROW } from './types'
import type { ActiveVolunteer, RequestDetail } from './types'
import { eventLabel } from './helpers'

interface RequestTimelineProps {
  request: RequestDetail
  a: Translations['admin']
  volunteers: ActiveVolunteer[]
  fmt: (ts: string | number | Date | undefined) => string
}

// The request audit/timeline rail. Pure presentation lifted from the screen's
// main <section>.
export default function RequestTimeline({ request, a, volunteers, fmt }: RequestTimelineProps) {
  return (
    <div
      style={{
        margin: 'var(--sp-6) 0 0',
        paddingBlockStart: 'var(--sp-5)',
        borderBlockStart: '1px solid var(--hair)',
      }}
    >
      <span style={{ ...EYEBROW, color: 'var(--ink-2)' }}>
        <History size={14} aria-hidden="true" />
        {a.reqDetail.timeline}
      </span>

      {request.events && request.events.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            margin: 'var(--sp-4) 0 0',
            padding: 0,
            position: 'relative',
          }}
        >
          {request.events.map((ev, i, arr) => (
            <li
              key={ev.id}
              style={{
                display: 'flex',
                gap: 'var(--sp-3)',
                paddingBlockEnd: i < arr.length - 1 ? 'var(--sp-4)' : 0,
              }}
            >
              {/*
                Marker + connector rail. The dot must sit on the FIRST
                line of the event label even when the note wraps to
                several lines and even at the larger HE serif metrics.
                Rather than hardcoding pixel offsets tied to one font's
                cap height, we give this column a line box that matches
                the label's line-height (1.45em) and center the dot in
                it. The rail then starts right below the dot and runs to
                the next item, derived from the same line-height — no
                magic numbers, and it re-balances if the label wraps.
              */}
              <span
                aria-hidden="true"
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  width: '14px',
                  // line box of the first label line — keeps the dot
                  // vertically centered on that line, not the whole
                  // (possibly multi-line) label.
                  height: 'calc(var(--fs-body) * 1.45)',
                }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: i === 0 ? 'var(--ember)' : 'var(--white)',
                    border: `2px solid ${i === 0 ? 'var(--ember)' : 'var(--gray-300)'}`,
                    boxShadow: i === 0 ? 'var(--ring)' : 'none',
                    zIndex: 1,
                  }}
                />
                {i < arr.length - 1 && (
                  <span
                    style={{
                      position: 'absolute',
                      // start just past the centered dot (half the line
                      // box + half the dot) and extend through the row's
                      // bottom padding to meet the next marker.
                      insetBlockStart: 'calc(50% + 7px)',
                      insetBlockEnd: 'calc(var(--sp-4) * -1)',
                      width: '2px',
                      background: 'var(--hair)',
                    }}
                  />
                )}
              </span>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px var(--sp-3)',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 }}>
                  {eventLabel(ev, a, volunteers)}
                </span>
                <time
                  style={{
                    color: 'var(--gray-500)',
                    fontSize: 'var(--fs-sm)',
                    whiteSpace: 'nowrap',
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(ev.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
            margin: 'var(--sp-4) 0 0',
            padding: 'var(--sp-4)',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--gray-300)',
            background: 'var(--paper)',
            color: 'var(--gray-500)',
          }}
        >
          <Clock3 size={18} aria-hidden="true" />
          <span>{a.reqDetail.noEvents}</span>
        </div>
      )}
    </div>
  )
}
