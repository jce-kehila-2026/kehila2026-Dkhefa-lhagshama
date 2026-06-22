/*
 * route: /admin/users (Next.js Pages Router).
 * thin entry point for the admin users-management screen. it owns nothing itself:
 * wraps the actual UI (AdminUsersPage) in AdminGate, which enforces admin auth/role
 * before any of the screen renders. all list/search/role logic lives in AdminUsersPage.
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminUsersPage from '@/screens/admin/AdminUsersPage'

// page component for the route; renders the gated admin users screen.
export default function AdminUsers() {
  return (
    <AdminGate>
      <AdminUsersPage />
    </AdminGate>
  )
}
