import AdminGate from '@/components/admin/AdminGate'
import AdminChatsPage from '@/screens/admin/AdminChatsPage'

export default function AdminChats() {
  return (
    <AdminGate>
      <AdminChatsPage />
    </AdminGate>
  )
}
