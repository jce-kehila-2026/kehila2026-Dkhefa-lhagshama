import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'

/**
 * Role gate for /volunteer-hub/* pages. While auth resolves, shows a light
 * loading state. If not signed in, redirects to /login?next=<path>. If signed
 * in but not a volunteer or admin, shows an access-denied card. Otherwise
 * renders children. Mirrors AdminGate but allows `volunteer` OR `admin`.
 */
interface VolunteerGateProps {
  children: ReactNode
}

export default function VolunteerGate({ children }: VolunteerGateProps) {
  const { user, role, loading } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const v = t.volunteerApp

  useEffect(() => {
    if (loading || user) return
    // Grace window before redirecting on (loading=false, user=null): Firebase
    // can briefly emit a null user during a token refresh before re-emitting
    // the signed-in user; redirecting on that transient null bounced
    // authenticated volunteers to /login mid-flow. Cancelled the moment the
    // user reappears, so an established session never navigates away.
    const handle = setTimeout(() => {
      const next = encodeURIComponent(router.asPath || '/volunteer-hub')
      router.replace(`/login?next=${next}`)
    }, 600)
    return () => clearTimeout(handle)
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="admin-gate-msg" role="status" aria-live="polite">
        <span className="skeleton skeleton-title" style={{ width: '14rem' }} aria-hidden="true" />
        <span className="sr-only">{v.ui.loading}</span>
      </div>
    )
  }

  const allowed = role === 'volunteer' || role === 'admin'
  if (!allowed) {
    return (
      <div className="admin-gate-denied" role="alert">
        <span className="admin-gate-icon" aria-hidden="true">
          <ShieldAlert size={28} />
        </span>
        <h1>{v.ui.accessDeniedTitle}</h1>
        <p>{v.ui.accessDeniedBody}</p>
        <Link href="/" className="btn btn-outline btn-sm">
          {v.ui.backToSite}
        </Link>
      </div>
    )
  }

  return children
}
