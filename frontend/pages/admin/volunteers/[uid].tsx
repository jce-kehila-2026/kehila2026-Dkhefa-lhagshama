import AdminGate from '@/components/admin/AdminGate'
import AdminVolunteerDetailPage from '@/screens/admin/AdminVolunteerDetailPage'

export default function AdminVolunteerDetail() {
  return (
    <AdminGate>
      <AdminVolunteerDetailPage />
    </AdminGate>
  )
}
