import AdminGate from '@/components/admin/AdminGate'
import AdminRequestDetailPage from '@/screens/admin/AdminRequestDetailPage'

export default function AdminRequestDetail() {
  return (
    <AdminGate>
      <AdminRequestDetailPage />
    </AdminGate>
  )
}
