/**
 * Pages-Router route entry for /volunteer-hub/calendar.
 *
 * Thin wrapper only: it wires the route to the screen and enforces access. All
 * calendar UI/logic (RTL-safe month grid of deadlines + availability windows)
 * lives in VolunteerCalendarPage; the volunteer/admin access decision lives in
 * VolunteerGate. Keep this file presentation-free so the screen stays reusable.
 */
import VolunteerGate from '@/components/volunteer-app/VolunteerGate'
import VolunteerCalendarPage from '@/screens/volunteer-app/VolunteerCalendarPage'

// gate first (redirects unauthorized users), then render the calendar screen.
export default function VolunteerHubCalendar() {
  return (
    <VolunteerGate>
      <VolunteerCalendarPage />
    </VolunteerGate>
  )
}
