/*
 * route: /admin/requests/[id] (Next.js pages router, dynamic segment = request id).
 * thin wrapper: gates the screen behind AdminGate (admin-claim auth + redirect),
 * then renders AdminRequestDetailPage which reads the id from the router and owns
 * all the data fetching / UI for a single request (UC-05 admin case management).
 * keep logic out of here; this file only wires the gate to the screen.
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminRequestDetailPage from '@/screens/admin/AdminRequestDetailPage'

// page entry for the admin request-detail route; AdminGate blocks non-admins before the screen mounts.
export default function AdminRequestDetail() {
  return (
    <AdminGate>
      <AdminRequestDetailPage />
    </AdminGate>
  )
}
