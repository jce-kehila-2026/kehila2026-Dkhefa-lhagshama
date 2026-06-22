/**
 * volunteer-hub home route (/volunteer-hub) — landing screen of the volunteer hub.
 * thin page shell: wraps the dashboard screen in VolunteerGate, which enforces
 * auth + the volunteer role and redirects anyone who is not an active volunteer.
 * all real ui/state lives in VolunteerDashboard; this file only wires the route.
 */
import VolunteerGate from '@/components/volunteer-app/VolunteerGate'
import VolunteerDashboard from '@/screens/volunteer-app/VolunteerDashboard'

// next.js page entry for /volunteer-hub; gate guards access, dashboard renders the hub
export default function VolunteerHubHome() {
  return (
    <VolunteerGate>
      <VolunteerDashboard />
    </VolunteerGate>
  )
}
