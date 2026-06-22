/**
 * route: /admin/requests (UC-05 admin case management)
 * thin Pages-Router entry that wraps the admin requests list screen in <AdminGate>,
 * so the route is unreachable until the admin-role auth check passes (gate handles
 * redirect/loading). all list logic — search, filters, sort, requester/volunteer
 * columns — lives in AdminRequestsListPage; this file only composes gate + screen.
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminRequestsListPage from '@/screens/admin/AdminRequestsListPage'

// page component for the route; renders the list only behind the admin gate.
export default function AdminRequests() {
  return (
    <AdminGate>
      <AdminRequestsListPage />
    </AdminGate>
  )
}
