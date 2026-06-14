import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useApp } from '@/contexts/AppContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { roleHome } from '@/utils/roleHome'

/**
 * Role gate for /admin/* pages. While auth resolves, shows a light loading
 * state. If not signed in, redirects to /login?next=<path>. If signed in but
 * not an admin, redirects to the user's role-home with a toast. Otherwise
 * renders children.
 */
interface AdminGateProps {
  children: ReactNode
}

export default function AdminGate({ children }: AdminGateProps) {
  const { user, role, loading } = useAuth()
  const { t } = useLanguage()
  const { toast } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (loading || user) return
    // Don't redirect on the *first* (loading=false, user=null) tick. Firebase
    // can briefly emit a null user mid token-refresh before re-emitting the
    // signed-in user; firing router.replace('/login') on that transient null
    // spuriously bounced authenticated admins off /admin/* (observed losing the
    // edit dialog while typing in the directory search). Wait a short grace
    // window — if the user is still null when it elapses, they really are
    // signed out and we redirect. The timer is cleared the moment a user
    // reappears (effect deps change), so an authenticated session never
    // navigates away.
    const handle = setTimeout(() => {
      const next = encodeURIComponent(router.asPath || '/admin')
      router.replace(`/login?next=${next}`)
    }, 600)
    return () => clearTimeout(handle)
  }, [loading, user, router])

  // Signed in but NOT an admin → don't dead-end on an access-denied card.
  // Send them to their own role-home (admin→/admin, volunteer→/volunteer-hub,
  // else /requests) and explain with a toast. Role resolves slightly after
  // `user`, so wait until role is non-null before deciding (avoids bouncing an
  // admin during the brief window where user is set but role is still null).
  useEffect(() => {
    if (loading || !user || role === null) return
    if (role === 'admin') return
    toast(t.admin.ui.roleMismatchToast, 'info')
    router.replace(roleHome(role))
  }, [loading, user, role, router, toast, t])

  if (loading || !user) {
    return (
      <div className="admin-gate-msg" role="status" aria-live="polite">
        <span className="skeleton skeleton-title" style={{ width: '14rem' }} aria-hidden="true" />
        <span className="sr-only">{t.admin.ui.loading}</span>
      </div>
    )
  }

  if (role !== 'admin') {
    // The effect above is redirecting to this user's role-home. Render the
    // neutral loading state for the single frame until router.replace lands,
    // so a non-admin never sees a dead-end card.
    return (
      <div className="admin-gate-msg" role="status" aria-live="polite">
        <span className="skeleton skeleton-title" style={{ width: '14rem' }} aria-hidden="true" />
        <span className="sr-only">{t.admin.ui.loading}</span>
      </div>
    )
  }

  return children
}
