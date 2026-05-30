import { useRouter } from 'next/router'
import { useEffect } from 'react'
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
    return <div className="admin-gate-msg">{t.admin.ui.loading}</div>
  }

  if (role !== 'admin') {
    return (
      <div className="admin-gate-denied">
        <h1>{lang === 'he' ? 'גישה נדחתה' : 'Access denied'}</h1>
        <p>
          {lang === 'he'
            ? 'אין לך הרשאת מנהל לגשת לדף זה.'
            : 'You do not have admin permission to access this page.'}
        </p>
      </div>
    )
  }

  return children
}
