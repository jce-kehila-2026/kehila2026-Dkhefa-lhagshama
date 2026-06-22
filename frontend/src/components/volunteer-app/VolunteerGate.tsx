import type { ReactNode } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useRouteGuard } from '@/hooks/useRouteGuard'
import GateLoading from '@/components/gates/GateLoading'

/**
 * Route guard for /volunteer-hub/* pages: volunteer (or admin, via the hasRole
 * superset). Signed-out users go to /login?next=<path>; signed-in users who are
 * neither volunteer nor admin are bounced to their own role-home with a toast.
 * The access decision is synchronous (see {@link useRouteGuard}).
 */
export default function VolunteerGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  const v = t.volunteerApp
  // admin is not listed here on purpose: hasRole treats admin as a superset of
  // volunteer inside useRouteGuard, so 'volunteer' already admits admins too.
  const status = useRouteGuard({
    allow: ['volunteer'],
    roleMismatchToast: v.ui.roleMismatchToast,
  })
  // covers both the transient 'pending' (auth resolving) and 'denied' (redirect
  // already kicked off) states; render the loader so children never flash for
  // unauthorized users while the redirect runs.
  if (status !== 'allowed') return <GateLoading label={v.ui.loading} />
  return <>{children}</>
}
