import VolunteerGate from '@/components/volunteer-app/VolunteerGate'
import VolunteerInsightsPage from '@/screens/volunteer-app/VolunteerInsightsPage'

export default function VolunteerHubInsights() {
  return (
    <VolunteerGate>
      <VolunteerInsightsPage />
    </VolunteerGate>
  )
}
