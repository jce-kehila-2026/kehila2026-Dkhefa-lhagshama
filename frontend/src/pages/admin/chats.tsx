/**
 * /admin/chats route entry (Next.js Pages Router). Thin shell that mounts the
 * admin chat-oversight console: wraps the screen in <AdminGate> so only an
 * authenticated admin renders it (others are redirected before any content
 * shows). All chat-list/console logic lives in AdminChatsPage; this file only
 * binds the URL to the gated screen.
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminChatsPage from '@/screens/admin/AdminChatsPage'

// default page export for the /admin/chats route. AdminGate enforces admin-only
// access; AdminChatsPage is the actual oversight UI.
export default function AdminChats() {
  return (
    <AdminGate>
      <AdminChatsPage />
    </AdminGate>
  )
}
