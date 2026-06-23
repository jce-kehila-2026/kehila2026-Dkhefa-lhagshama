/*
 * Modal.tsx — the app's single global modal surface.
 * Renders whatever `modal` payload AppContext currently holds (set via openModal/closeModal),
 * portaled to document.body so it escapes parent stacking/overflow. There is exactly one of
 * these mounted app-wide; any feature opens a dialog by pushing content into context, not by
 * rendering its own modal. Closes on overlay click or Escape, and locks body scroll while open.
 * Visual chrome uses global `modal-*` classes; only title/close-button get module-scoped styles.
 */
import type { ReactNode } from 'react'
import { useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useLanguage } from '@/contexts/LanguageContext'
import styles from './Modal.module.css'

/** Object payload this Modal renders (richer than the bare ReactNode the context types). */
interface ModalContent {
  title?: ReactNode
  content?: ReactNode
  footer?: ReactNode
}

// All natively focusable descendants — used to autofocus the first control and to trap Tab.
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// global modal host; reads the active payload from AppContext and renders nothing when none is set.
export default function Modal() {
  const { modal: rawModal, closeModal } = useApp()
  const { t } = useLanguage()
  // context types modal as a bare ReactNode; we actually pass a {title,content,footer} object.
  const modal = rawModal as ModalContent | null
  const boxRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<Element | null>(null)
  const titleId = useId()

  // While open: Escape closes, Tab is trapped within the box, focus moves to the first control on
  // open and is restored to the opener on close, and body scroll is locked. Cleanup restores all
  // of it, so the effect re-runs on every modal change (open/close/swap) and never leaves a stuck
  // overflow:hidden or a lost focus anchor.
  useEffect(() => {
    if (!modal) return
    previouslyFocused.current = document.activeElement
    const raf = requestAnimationFrame(() => {
      const focusables = boxRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      ;(focusables && focusables.length ? focusables[0] : boxRef.current)?.focus()
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal()
        return
      }
      if (e.key === 'Tab') {
        const focusables = boxRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
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
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      const el = previouslyFocused.current as HTMLElement | null
      if (el && typeof el.focus === 'function') el.focus()
    }
  }, [modal, closeModal])

  if (!modal) return null

  return createPortal(
    // close only on a true backdrop click (target === overlay), not on clicks bubbling from the box.
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div
        ref={boxRef}
        className="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby={modal.title ? titleId : undefined}
        tabIndex={-1}
      >
        {modal.title && (
          <div className="modal-header">
            <h3 id={titleId} className={styles.title}>{modal.title}</h3>
            <button onClick={closeModal} className={`btn btn-ghost btn-sm ${styles.closeBtn}`} aria-label={t.common.close}>
              <X size={18} />
            </button>
          </div>
        )}
        <div className="modal-body">{modal.content}</div>
        {modal.footer && <div className="modal-footer">{modal.footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
