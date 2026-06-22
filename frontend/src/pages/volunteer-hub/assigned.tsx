/*
 * route: /volunteer-hub/assigned (Pages Router entry).
 * thin wrapper that gates access then renders the volunteer's "assigned to me"
 * requests screen. all data fetching + UI live in VolunteerAssignedPage; this
 * file only wires the route to the auth/role gate, like its sibling hub routes.
 * VolunteerGate enforces the signed-in + volunteer-role invariant before children mount.
 */
import VolunteerGate from '@/components/volunteer-app/VolunteerGate'
import VolunteerAssignedPage from '@/screens/volunteer-app/VolunteerAssignedPage'

// default export = the page Next.js mounts for this route; render is gate-then-screen.
export default function VolunteerHubAssigned() {
  return (
    <VolunteerGate>
      <VolunteerAssignedPage />
    </VolunteerGate>
  )
}
