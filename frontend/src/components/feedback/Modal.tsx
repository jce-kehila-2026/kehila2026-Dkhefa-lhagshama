import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import styles from './Modal.module.css'

/** Object payload this Modal renders (richer than the bare ReactNode the context types). */
interface ModalContent {
  title?: ReactNode
  content?: ReactNode
  footer?: ReactNode
}

export default function Modal() {
  const { modal: rawModal, closeModal } = useApp()
  const modal = rawModal as ModalContent | null

  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [modal, closeModal])

  if (!modal) return null

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal-box" role="dialog" aria-modal="true">
        {modal.title && (
          <div className="modal-header">
            <h3 className={styles.title}>{modal.title}</h3>
            <button onClick={closeModal} className={`btn btn-ghost btn-sm ${styles.closeBtn}`}>
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