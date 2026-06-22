/**
 * Route entry for /admin (Next.js Pages Router) — the admin dashboard landing page.
 *
 * Thin composition wrapper: it does no logic of its own. AdminGate handles the
 * auth/role check (redirects non-admins away, shows a loading/denied state while
 * resolving), and only renders its children once the current user is a verified
 * admin. AdminDashboard (in screens/admin) holds all the real UI — KPI tiles,
 * deep-links, charts. Keeping this file trivial is intentional: the gate is the
 * invariant guarding every admin screen, the dashboard is reused/testable on its own.
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminDashboard from '@/screens/admin/AdminDashboard'

// page component for /admin: gate first, then render the dashboard for admins only
export default function AdminHome() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  )
}
