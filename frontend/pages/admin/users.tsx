import AdminGate from '@/components/admin/AdminGate'
import AdminUsersPage from '@/screens/admin/AdminUsersPage'

export default function AdminUsers() {
  return (
    <AdminGate>
      <AdminUsersPage />
    </AdminGate>
  )
}
