import type { ReactNode } from 'react'
import { useEffect, useRef, useId } from 'react'
import { X } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useLanguage } from '@/contexts/LanguageContext'

/** Object payload this Modal renders (richer than the bare ReactNode the context types). */
interface ModalContent {
  title?: ReactNode
  content?: ReactNode
  footer?: ReactNode
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal() {
  const { modal: rawModal, closeModal } = useApp()
  const { t } = useLanguage()
  const modal = rawModal as ModalContent | null
  const boxRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<Element | null>(null)
  const titleId = useId()

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

  return (
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
            <h3 id={titleId} style={{ fontSize:'17px', fontWeight:700, color:'var(--ink)' }}>{modal.title}</h3>
            <button onClick={closeModal} className="btn btn-ghost btn-sm" style={{ padding:'4px' }} aria-label={t.common.close}>
              <X size={18} />
            </button>
          </div>
        )}
        <div className="modal-body">{modal.content}</div>
        {modal.footer && <div className="modal-footer">{modal.footer}</div>}
      </div>
    </div>
  )
}
