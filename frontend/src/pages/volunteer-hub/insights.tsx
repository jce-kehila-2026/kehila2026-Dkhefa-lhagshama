/**
 * Route: /volunteer-hub/insights (Next.js Pages Router).
 *
 * Thin page wrapper for the volunteer impact/insights screen. Its only job is
 * to enforce access via <VolunteerGate> (auth + volunteer-role guard, redirects
 * unauthorized users) and then render the real screen, <VolunteerInsightsPage>,
 * which holds all data-fetching and chart/KPI rendering. Mirrors the other
 * volunteer-hub routes (index, calendar) so the gate is applied consistently.
 */
import VolunteerGate from '@/components/volunteer-app/VolunteerGate'
import VolunteerInsightsPage from '@/screens/volunteer-app/VolunteerInsightsPage'

export default function VolunteerHubInsights() {
  return (
    <VolunteerGate>
      <VolunteerInsightsPage />
    </VolunteerGate>
  )
}
