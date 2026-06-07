import VolunteerGate from '@/components/volunteer-app/VolunteerGate'
import VolunteerDashboard from '@/screens/volunteer-app/VolunteerDashboard'

export default function VolunteerHubHome() {
  return (
    <VolunteerGate>
      <VolunteerDashboard />
    </VolunteerGate>
  )
}
