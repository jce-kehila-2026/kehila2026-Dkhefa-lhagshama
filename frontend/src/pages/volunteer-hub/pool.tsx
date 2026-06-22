/**
 * Route: /volunteer-hub/pool (Next.js Pages Router page).
 *
 * Thin route shell only: wraps the open-requests "pool" screen in VolunteerGate
 * so the page is reachable solely by volunteers (or admins, the superset). All
 * data-fetching, claim/unclaim, and UI live in VolunteerPoolPage; the gate owns
 * the auth redirect (signed-out -> /login, wrong-role -> role-home with toast).
 */
import VolunteerGate from '@/components/volunteer-app/VolunteerGate'
import VolunteerPoolPage from '@/screens/volunteer-app/VolunteerPoolPage'

export default function VolunteerHubPool() {
  return (
    <VolunteerGate>
      <VolunteerPoolPage />
    </VolunteerGate>
  )
}
