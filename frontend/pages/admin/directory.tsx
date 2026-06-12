import AdminGate from '@/components/admin/AdminGate'
import AdminDirectoryPage from '@/screens/admin/AdminDirectoryPage'

export default function AdminDirectory() {
  return (
    <AdminGate>
      <AdminDirectoryPage />
    </AdminGate>
  )
}
