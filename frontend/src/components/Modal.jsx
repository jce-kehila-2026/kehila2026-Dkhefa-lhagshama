import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../contexts/AppContext'

export default function Modal() {
  const { modal, closeModal } = useApp()

  useEffect(() => {
    if (!modal) return
    const onKey = (e) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [modal, closeModal])

  if (!modal) return null

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal-box" role="dialog" aria-modal="true">
        {modal.title && (
          <div className="modal-header">
            <h3 style={{ fontSize:'17px', fontWeight:700, color:'var(--navy)' }}>{modal.title}</h3>
            <button onClick={closeModal} className="btn btn-ghost btn-sm" style={{ padding:'4px' }}>
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