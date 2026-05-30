import AdminGate from '@/components/admin/AdminGate'
import AdminApprovalsPage from '@/screens/admin/AdminApprovalsPage'

export default function AdminApprovals() {
  return (
    <AdminGate>
      <AdminApprovalsPage />
    </AdminGate>
  )
}
