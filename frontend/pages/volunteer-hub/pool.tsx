import VolunteerGate from '@/components/volunteer-app/VolunteerGate'
import VolunteerPoolPage from '@/screens/volunteer-app/VolunteerPoolPage'

export default function VolunteerHubPool() {
  return (
    <VolunteerGate>
      <VolunteerPoolPage />
    </VolunteerGate>
  )
}
