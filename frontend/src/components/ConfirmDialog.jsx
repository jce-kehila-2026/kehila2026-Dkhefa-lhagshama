import { useEffect, useRef, useId } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'

/**
 * Branded, accessible confirmation / notice dialog. Replaces native
 * window.confirm()/alert() so copy stays bilingual (all labels arrive via
 * props bound to t.*) and the surface matches the editorial "Sky" system.
 *
 * Behaviour:
 *  - role="dialog" + aria-modal, labelled by its title and described by its body.
 *  - Focus moves to the primary action on open; focus is trapped inside the
 *    dialog (Tab/Shift+Tab cycle); focus returns to the trigger on close.
 *  - Esc cancels, Enter confirms.
 *  - Entrance animation (scale/fade) is reduced-motion safe (CSS handles it).
 *
 * Props:
 *  - open        : boolean — render + activate the dialog.
 *  - title       : string  — heading (bilingual via t.*).
 *  - message     : string  — body copy (bilingual via t.*).
 *  - confirmLabel: string  — primary button label (e.g. t.common.confirm).
 *  - cancelLabel : string? — secondary button label (e.g. t.common.cancel).
 *                            Omit for a single-button notice (alert replacement).
 *  - variant     : 'default' | 'danger' — themes the icon + primary button.
 *  - busy        : boolean? — disables actions and shows the primary spinner.
 *  - onConfirm   : () => void
 *  - onCancel    : () => void  (also fired on Esc / backdrop / single-button OK).
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const boxRef = useRef(null)
  const confirmRef = useRef(null)
  const previouslyFocused = useRef(null)
  const titleId = useId()
  const bodyId = useId()

  // Capture the trigger, focus the primary action, restore focus on unmount.
  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement
    const raf = requestAnimationFrame(() => confirmRef.current?.focus())
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(raf)
      document.body.style.overflow = prevOverflow
      const el = previouslyFocused.current
      if (el && typeof el.focus === 'function') el.focus()
    }
  }, [open])

  // Keyboard: Esc cancels, Enter confirms, Tab is trapped within the dialog.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!busy) onCancel?.()
        return
      }
      if (e.key === 'Enter') {
        // Don't hijack Enter while typing in a field inside the dialog.
        const tag = e.target?.tagName
        if (tag === 'TEXTAREA') return
        e.preventDefault()
        if (!busy) onConfirm?.()
        return
      }
      if (e.key === 'Tab') {
        const focusables = boxRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onConfirm, onCancel])

  if (!open) return null

  const Icon = variant === 'danger' ? AlertTriangle : HelpCircle

  return (
    <div
      className="confirm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.()
      }}
    >
      <div
        ref={boxRef}
        className="confirm-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <span className={`confirm-icon confirm-icon--${variant === 'danger' ? 'danger' : 'default'}`} aria-hidden="true">
          <Icon size={22} />
        </span>
        <h2 id={titleId} className="confirm-title">{title}</h2>
        {message && <p id={bodyId} className="confirm-message">{message}</p>}
        <div className="confirm-actions">
          {cancelLabel && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onCancel?.()}
              disabled={busy}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}${busy ? ' is-loading' : ''}`}
            onClick={() => onConfirm?.()}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
