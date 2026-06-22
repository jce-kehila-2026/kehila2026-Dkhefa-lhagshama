/**
 * VolunteerCalendarPage — the /volunteer-hub/calendar screen.
 *
 * Renders a volunteer's month at a glance: a 6x7 grid overlaying their assigned
 * requests' deadlines (per day) and their recurring weekly working-hours windows
 * (per weekday), plus a text deadlines list, a work-status toggle, and the
 * recurring-availability editor. Data comes from two backend reads on mount:
 * GET /api/volunteer/me (windows + status) and /api/volunteer/assigned (deadlines).
 * Fully bilingual/RTL-aware; chevrons mirror in RTL so "previous" always points
 * to the reading-start. `me` is the shared source of truth that the status and
 * availability child controls write back through.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCategories } from '@/hooks/useCategories'
import { apiJson } from '@/lib/apiClient'
import { formatDate } from '@/utils/helpers'
import type { VolunteerMe } from '@/types'
import VolunteerLayout from '@/components/volunteer-app/VolunteerLayout'
import { ErrorState } from '@/components/admin/AdminUI'
import AvailabilityEditor from '@/components/volunteer-app/AvailabilityEditor'
import WorkStatusControl from '@/components/volunteer-app/WorkStatusControl'
import styles from './VolunteerCalendarPage.module.css'

// one assigned request as returned by /api/volunteer/assigned; only deadline +
// the labels needed to render a calendar entry are used here.
interface AssignedItem {
  id: string
  displayId?: string | null
  firstName?: string | null
  title?: string
  category?: string
  deadline?: string | null
}

// shape of /api/volunteer/assigned.
interface AssignedResponse {
  items: AssignedItem[]
}

export default function VolunteerCalendarPage() {
  const { t, lang, isRTL } = useLanguage()
  const v = t.volunteerApp
  const c = v.calendar
  const { labelFor } = useCategories()
  // Mirror the chevrons in RTL so "previous" always points to the start of the
  // reading direction (matches Pagination's pattern).
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft
  const NextIcon = isRTL ? ChevronLeft : ChevronRight

  const [me, setMe] = useState<VolunteerMe | null>(null)
  const [assigned, setAssigned] = useState<AssignedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Month cursor: first day of the month being shown.
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // fetch profile (windows/status) + assigned deadlines together; any failure
  // surfaces the shared load-error and the ErrorState offers a retry.
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [meData, assignedData] = await Promise.all([
        apiJson<VolunteerMe>('/api/volunteer/me'),
        apiJson<AssignedResponse>('/api/volunteer/assigned'),
      ])
      setMe(meData)
      setAssigned(assignedData.items ?? [])
    } catch {
      setError(v.ui.loadError)
    } finally {
      setLoading(false)
    }
  }, [v.ui.loadError])

  useEffect(() => {
    load()
  }, [load])

  // Deadlines keyed by YYYY-MM-DD for O(1) day lookups in the grid.
  const deadlinesByDay = useMemo(() => {
    const map = new Map<string, AssignedItem[]>()
    for (const item of assigned) {
      if (!item.deadline) continue
      const key = item.deadline.slice(0, 10)
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return map
  }, [assigned])

  // Map weekday index (0-6) → that day's working-hours windows, so the grid can
  // render the actual time ranges inside each cell (not just a highlight).
  const windowsByDow = useMemo(() => {
    const map = new Map<number, Array<{ start: string; end: string }>>()
    for (const w of me?.availabilityWindows ?? []) {
      const arr = map.get(w.day) ?? []
      arr.push({ start: w.start, end: w.end })
      map.set(w.day, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.start.localeCompare(b.start))
    return map
  }, [me])

  // Build the 6x7 grid cells (leading pad days + the month's days).
  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstDow = new Date(year, month, 1).getDay() // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out: { date: Date | null }[] = []
    for (let i = 0; i < firstDow; i += 1) out.push({ date: null })
    for (let d = 1; d <= daysInMonth; d += 1) out.push({ date: new Date(year, month, d) })
    while (out.length % 7 !== 0) out.push({ date: null })
    return out
  }, [cursor])

  const todayKey = new Date().toISOString().slice(0, 10)
  const monthLabel = cursor.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    month: 'long',
    year: 'numeric',
  })

  const shiftMonth = (delta: number) =>
    setCursor((cur) => new Date(cur.getFullYear(), cur.getMonth() + delta, 1))

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  return (
    <VolunteerLayout title={c.title} subtitle={c.subtitle}>
      {error && (
        <div className={styles.errorWrap}>
          <ErrorState message={error} onRetry={load} retryLabel={v.ui.retry} />
        </div>
      )}

      {/* ── Month calendar ─────────────────────────────────────── */}
      <section className="card volapp-panel" aria-busy={loading}>
        <div className="volapp-cal-toolbar">
          <h2 className="volapp-cal-month">{monthLabel}</h2>
          <div className="volapp-cal-nav">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              aria-label={c.monthsBack}
              onClick={() => shiftMonth(-1)}
            >
              <PrevIcon size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              aria-label={c.monthsFwd}
              onClick={() => shiftMonth(1)}
            >
              <NextIcon size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="volapp-cal-grid" role="grid" aria-label={c.title}>
          {(c.days as readonly string[]).map((dow) => (
            <div key={dow} className="volapp-cal-dow" role="columnheader">
              {dow}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell.date) {
              return <div key={`pad-${i}`} className="volapp-cal-cell volapp-cal-cell--pad" aria-hidden="true" />
            }
            const key = dayKey(cell.date)
            const isToday = key === todayKey
            const windows = windowsByDow.get(cell.date.getDay()) ?? []
            const isAvail = windows.length > 0
            const dls = deadlinesByDay.get(key) ?? []
            return (
              <div
                key={key}
                role="gridcell"
                className={`volapp-cal-cell${isToday ? ' volapp-cal-cell--today' : ''}${isAvail ? ' volapp-cal-cell--available' : ''}`}
              >
                <span className="volapp-cal-daynum">{cell.date.getDate()}</span>
                {windows.map((w, wi) => (
                  <span key={`w-${wi}`} className="volapp-cal-hours">
                    {w.start}–{w.end}
                  </span>
                ))}
                {dls.map((dl) => {
                  // Lead with the requester's name (the volunteer asked to see
                  // who, not just the category); category stays in the tooltip.
                  const label = dl.firstName || dl.title || labelFor(dl.category)
                  return (
                    <Link
                      key={dl.id}
                      href={`/volunteer-hub/assigned#req-${encodeURIComponent(dl.id)}`}
                      className="volapp-cal-deadline"
                      title={`${label} · ${labelFor(dl.category)}`}
                      aria-label={`${c.openRequest}: ${label}`}
                    >
                      {label}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="volapp-cal-legend">
          <span className="volapp-cal-legend-item">
            <span className="volapp-cal-swatch volapp-cal-swatch--deadline" aria-hidden="true" />
            {c.legendDeadline}
          </span>
          <span className="volapp-cal-legend-item">
            <span className="volapp-cal-swatch volapp-cal-swatch--available" aria-hidden="true" />
            {c.legendAvailable}
          </span>
        </div>
      </section>

      {/* ── Deadlines list (text fallback / detail) ───────────── */}
      <section className="card volapp-panel">
        <h2 className="volapp-panel-title">{c.deadlinesTitle}</h2>
        {assigned.filter((a) => a.deadline).length > 0 ? (
          <dl className="volapp-meta">
            {assigned
              .filter((a) => a.deadline)
              .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
              .map((a) => (
                <div className="volapp-meta-row" key={a.id}>
                  <dt>
                    <CalendarClock size={13} aria-hidden="true" />{' '}
                    <Link
                      href={`/volunteer-hub/assigned#req-${encodeURIComponent(a.id)}`}
                      className="volapp-cal-deadline-link"
                    >
                      {a.firstName || a.title || labelFor(a.category)}
                    </Link>
                  </dt>
                  <dd className="volapp-deadline-val">{formatDate(a.deadline as string, lang)}</dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="volapp-muted">{c.noDeadlines}</p>
        )}
      </section>

      {/* ── Work status ───────────────────────────────────────── */}
      <section className="card volapp-panel">
        <h2 className="volapp-panel-title">{t.volunteerApp.dash.hero.availabilityLabel}</h2>
        <WorkStatusControl me={me} onChange={setMe} />
      </section>

      {/* ── Availability editor ───────────────────────────────── */}
      <AvailabilityEditor me={me} onSaved={(updated) => setMe(updated)} />
    </VolunteerLayout>
  )
}
