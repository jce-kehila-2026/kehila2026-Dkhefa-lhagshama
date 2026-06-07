import VolunteerGate from '@/components/volunteer-app/VolunteerGate'
import VolunteerAssignedPage from '@/screens/volunteer-app/VolunteerAssignedPage'

export default function VolunteerHubAssigned() {
  return (
    <VolunteerGate>
      <VolunteerAssignedPage />
    </VolunteerGate>
  )
}
