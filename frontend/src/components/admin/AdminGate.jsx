import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'

/**
 * Role gate for /admin/* pages. While auth resolves, shows a light loading
 * state. If not signed in, redirects to /login?next=<path>. If signed in but
 * not an admin, shows an access-denied card. Otherwise renders children.
 */
export default function AdminGate({ children }) {
  const { user, role, loading } = useAuth()
  const { t, lang } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      const next = encodeURIComponent(router.asPath || '/admin')
      router.replace(`/login?next=${next}`)
    }
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="admin-gate-msg" role="status" aria-live="polite">
        <span className="skeleton skeleton-title" style={{ width: '14rem' }} aria-hidden="true" />
        <span className="sr-only">{t.admin.ui.loading}</span>
      </div>
    )
  }

  if (role !== 'admin') {
    return (
      <div className="admin-gate-denied" role="alert">
        <span className="admin-gate-icon" aria-hidden="true">
          <ShieldAlert size={28} />
        </span>
        <h1>{lang === 'he' ? 'גישה נדחתה' : 'Access denied'}</h1>
        <p>
          {lang === 'he'
            ? 'אין לך הרשאת מנהל לגשת לדף זה.'
            : 'You do not have admin permission to access this page.'}
        </p>
        <Link href="/" className="btn btn-outline btn-sm">
          {lang === 'he' ? 'חזרה לאתר' : 'Back to site'}
        </Link>
      </div>
    )
  }

  return children
}
