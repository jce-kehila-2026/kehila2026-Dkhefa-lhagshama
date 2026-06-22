import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
import type { AvailabilityWindow, VolunteerMe } from '@/types'
import styles from './AvailabilityEditor.module.css'

interface AvailabilityEditorProps {
  me: VolunteerMe | null
  onSaved: (updated: VolunteerMe) => void
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function validWindow(w: AvailabilityWindow): boolean {
  if (w.day < 0 || w.day > 6) return false
  if (!HHMM.test(w.start) || !HHMM.test(w.end)) return false
  const [sh, sm] = w.start.split(':').map(Number)
  const [eh, em] = w.end.split(':').map(Number)
  return eh * 60 + em > sh * 60 + sm
}

export default function AvailabilityEditor({ me, onSaved }: AvailabilityEditorProps) {
  const { t } = useLanguage()
  const v = t.volunteerApp
  const c = v.calendar

  const [windows, setWindows] = useState<AvailabilityWindow[]>([])
  const [availableAgainOn, setAvailableAgainOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Hydrate local editor state whenever the parent's `me` changes.
  useEffect(() => {
    if (!me) return
    setWindows(me.availabilityWindows ?? [])
    setAvailableAgainOn(me.availableAgainOn ?? '')
  }, [me])

  const isUnavailable = me?.workStatus === 'unavailable'

  const addWindow = () =>
    setWindows((ws) => [...ws, { day: 0, start: '09:00', end: '17:00' }])

  const removeWindow = (idx: number) =>
    setWindows((ws) => ws.filter((_, i) => i !== idx))

  const patchWindow = (idx: number, patch: Partial<AvailabilityWindow>) =>
    setWindows((ws) => ws.map((w, i) => (i === idx ? { ...w, ...patch } : w)))

  const today = new Date().toISOString().slice(0, 10)

  const saveWindows = async () => {
    const bad = windows.find((w) => !validWindow(w))
    if (bad) {
      setMsg({ kind: 'err', text: c.invalidWindow })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const updated = await apiJson<VolunteerMe>('/api/volunteer/me', {
        method: 'PATCH',
        body: JSON.stringify({ availabilityWindows: windows }),
      })
      onSaved(updated)
      setMsg({ kind: 'ok', text: c.windowsSaved })
    } catch {
      setMsg({ kind: 'err', text: c.windowsError })
    } finally {
      setBusy(false)
    }
  }

  const saveReturnDate = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const updated = await apiJson<VolunteerMe>('/api/volunteer/me', {
        method: 'PATCH',
        body: JSON.stringify({
          workStatus: 'unavailable',
          availableAgainOn: availableAgainOn || null,
        }),
      })
      onSaved(updated)
      setMsg({ kind: 'ok', text: c.windowsSaved })
    } catch {
      setMsg({ kind: 'err', text: c.windowsError })
    } finally {
      setBusy(false)
    }
  }

  const days = c.days as readonly string[]

  return (
    <section className="card volapp-panel">
      <h2 className="volapp-panel-title">{c.availabilityTitle}</h2>
      <p className="volapp-panel-sub">{c.availabilitySub}</p>

      {windows.length === 0 ? (
        <p className="volapp-muted">{c.noWindows}</p>
      ) : (
        <div>
          {windows.map((w, idx) => (
            <div className="volapp-win-row" key={idx}>
              <div className="volapp-win-field">
                <label className="form-label" htmlFor={`win-day-${idx}`}>{c.day}</label>
                <select
                  id={`win-day-${idx}`}
                  className="form-select"
                  value={w.day}
                  onChange={(e) => patchWindow(idx, { day: Number(e.target.value) })}
                >
                  {days.map((label, di) => (
                    <option key={di} value={di}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="volapp-win-field">
                <label className="form-label" htmlFor={`win-start-${idx}`}>{c.startTime}</label>
                <input
                  id={`win-start-${idx}`}
                  type="time"
                  className="form-input"
                  value={w.start}
                  onChange={(e) => patchWindow(idx, { start: e.target.value })}
                />
              </div>
              <div className="volapp-win-field">
                <label className="form-label" htmlFor={`win-end-${idx}`}>{c.endTime}</label>
                <input
                  id={`win-end-${idx}`}
                  type="time"
                  className="form-input"
                  value={w.end}
                  onChange={(e) => patchWindow(idx, { end: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm volapp-win-remove"
                onClick={() => removeWindow(idx)}
                aria-label={c.removeWindow}
              >
                <Trash2 size={15} aria-hidden="true" />
                {c.removeWindow}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="volapp-avail-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={addWindow}>
          <Plus size={15} aria-hidden="true" />
          {c.addWindow}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={saveWindows}
        >
          {c.save}
        </button>
      </div>

      {/* ── Unavailable → return date ──────────────────────────── */}
      {isUnavailable && (
        <div className={styles.returnSection}>
          <h3 className="volapp-subhead">{c.unavailableTitle}</h3>
          <label className="form-label" htmlFor="avail-again">{c.availableAgainLabel}</label>
          <input
            id="avail-again"
            type="date"
            className="form-input"
            min={today}
            value={availableAgainOn}
            onChange={(e) => setAvailableAgainOn(e.target.value)}
          />
          <p className={`volapp-muted ${styles.againHint}`}>{c.availableAgainHint}</p>
          <div className="volapp-avail-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveReturnDate}>
              {c.save}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p
          className={`volapp-inline-msg${msg.kind === 'err' ? ' is-error' : ''}`}
          role={msg.kind === 'err' ? 'alert' : 'status'}
        >
          {msg.text}
        </p>
      )}
    </section>
  )
}
