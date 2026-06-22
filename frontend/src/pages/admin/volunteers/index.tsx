/**
 * route: /admin/volunteers (Pages Router page for the admin volunteers list).
 * thin wrapper: gates access behind AdminGate (admin-only auth/role guard) and
 * renders the AdminVolunteersPage screen, which holds the actual UI/data logic
 * (Active/All tabs, search, per-volunteer drill-down links to /admin/volunteers/[uid]).
 * all behavior lives in the two collaborators; this file just composes them.
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminVolunteersPage from '@/screens/admin/AdminVolunteersPage'

// page entry; AdminGate blocks non-admins before the screen ever mounts
export default function AdminVolunteers() {
  return (
    <AdminGate>
      <AdminVolunteersPage />
    </AdminGate>
  )
}
