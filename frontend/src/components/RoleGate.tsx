import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Role } from '@/types'

/**
 * Reusable hard-gate, mirroring AdminGate but for any role set. While auth
 * resolves, shows a light loading state. If not signed in, redirects to
 * `redirect` (default /login?next=<path>). If signed in but lacking an allowed
 * role, renders `fallback` if given, otherwise an access-denied card. Admin
 * always passes (admin is a role superset, via `hasRole`).
 *
 * @example <RoleGate allow={['volunteer']} redirect="/login">…</RoleGate>
 */
interface RoleGateProps {
  /** Roles permitted to view the children. Admin always passes regardless. */
  allow: Role[]
  /** Where to send signed-out users. Defaults to /login?next=<path>. */
  redirect?: string
  children: ReactNode
  /** Rendered instead of the access-denied card when signed in but disallowed. */
  fallback?: ReactNode
}

export default function RoleGate({ allow, redirect, children, fallback }: RoleGateProps) {
  const { user, loading, hasRole } = useAuth()
  const { t, lang } = useLanguage()
  const router = useRouter()

  useEffect(() => {
    if (loading || user) return
    // Grace window before redirecting on (loading=false, user=null): Firebase
    // can briefly emit a null user during a token refresh before re-emitting
    // the signed-in user, and redirecting on that transient null bounced
    // authenticated users to /login mid-flow. The timer is cancelled the moment
    // the user reappears, so an established session never navigates away.
    const handle = setTimeout(() => {
      const target =
        redirect ?? `/login?next=${encodeURIComponent(router.asPath || '/')}`
      router.replace(target)
    }, 600)
    return () => clearTimeout(handle)
  }, [loading, user, router, redirect])

  if (loading || !user) {
    return (
      <div className="admin-gate-msg" role="status" aria-live="polite">
        <span className="skeleton skeleton-title" style={{ width: '14rem' }} aria-hidden="true" />
        <span className="sr-only">{t.admin.ui.loading}</span>
      </div>
    )
  }

  const allowed = allow.some((r) => hasRole(r))
  if (!allowed) {
    if (fallback !== undefined) return <>{fallback}</>
    return (
      <div className="admin-gate-denied" role="alert">
        <span className="admin-gate-icon" aria-hidden="true">
          <ShieldAlert size={28} />
        </span>
        <h1>{lang === 'he' ? 'גישה נדחתה' : 'Access denied'}</h1>
        <p>
          {lang === 'he'
            ? 'אין לך הרשאה לגשת לדף זה.'
            : 'You do not have permission to access this page.'}
        </p>
        <Link href="/" className="btn btn-outline btn-sm">
          {lang === 'he' ? 'חזרה לאתר' : 'Back to site'}
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
