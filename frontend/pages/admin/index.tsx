import AdminGate from '@/components/admin/AdminGate'
import AdminDashboard from '@/screens/admin/AdminDashboard'

export default function AdminHome() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  )
}
