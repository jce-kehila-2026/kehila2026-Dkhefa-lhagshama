/**
 * AuthedGate — client-side route guard for pages any SIGNED-IN user may view,
 * regardless of role (e.g. the /chats group: beneficiaries, volunteers and
 * admins all use chat). Mirrors AdminGate/VolunteerGate so the /chats routes get
 * the same consistent treatment as the rest of the app (audit Prompt 4): a
 * signed-out user is redirected to /login?next=<path> instead of briefly seeing
 * the screen render and then erroring, and the access decision is synchronous so
 * there is no flash of content before the redirect.
 */
import type { ReactNode } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useRouteGuard } from '@/hooks/useRouteGuard'
import GateLoading from '@/components/gates/GateLoading'

// Every role is permitted — the gate only enforces "is signed in". A signed-out
// user is redirected to login; a signed-in user of ANY role passes.
export default function AuthedGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  const status = useRouteGuard({
    allow: ['beneficiary', 'volunteer', 'admin'],
  })
  if (status !== 'allowed') return <GateLoading label={t.common.loading} />
  return <>{children}</>
}
