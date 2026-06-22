import type { ReactNode } from 'react'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useLanguage } from '@/contexts/LanguageContext'
import styles from './Toast.module.css'

/** A single transient toast notification (mirrors AppContext's toast shape). */
interface ToastItem {
  id: number
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

const ICONS: Record<ToastItem['type'], ReactNode> = {
  success: <CheckCircle size={16} />,
  error:   <AlertCircle size={16} />,
  info:    <Info size={16} />,
  warning: <AlertTriangle size={16} />,
}

export default function ToastContainer() {
  const { toasts, removeToast } = useApp()
  // Note: the map var below is also named `t` (a toast item), so the language
  // table is aliased to `tr` to keep the dismiss label localized.
  const { t: tr } = useLanguage()

  return (
    <div className="toast-container no-print" role="region" aria-live="polite">
      {(toasts as ToastItem[]).map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className={styles.icon}>{ICONS[t.type]}</span>
          <span className={styles.message}>{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className={styles.dismiss}
            aria-label={tr.common.close}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}