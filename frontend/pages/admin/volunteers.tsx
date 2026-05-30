import AdminGate from '@/components/admin/AdminGate'
import AdminVolunteersPage from '@/screens/admin/AdminVolunteersPage'

export default function AdminVolunteers() {
  return (
    <AdminGate>
      <AdminVolunteersPage />
    </AdminGate>
  )
}
