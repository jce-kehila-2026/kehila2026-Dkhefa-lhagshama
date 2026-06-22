/**
 * Pages Router route for the per-volunteer admin drill-down: /admin/volunteers/[uid].
 * Thin wrapper that just composes auth + screen; all data fetching and the [uid]
 * param read live inside AdminVolunteerDetailPage (via useRouter). AdminGate enforces
 * the admin role before the screen mounts (redirects non-admins).
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminVolunteerDetailPage from '@/screens/admin/AdminVolunteerDetailPage'

// route entry: gate to admins, then render the volunteer detail screen.
export default function AdminVolunteerDetail() {
  return (
    <AdminGate>
      <AdminVolunteerDetailPage />
    </AdminGate>
  )
}
