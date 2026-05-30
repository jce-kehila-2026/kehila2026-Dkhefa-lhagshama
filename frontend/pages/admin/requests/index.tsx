import AdminGate from '@/components/admin/AdminGate'
import AdminRequestsListPage from '@/screens/admin/AdminRequestsListPage'

export default function AdminRequests() {
  return (
    <AdminGate>
      <AdminRequestsListPage />
    </AdminGate>
  )
}
