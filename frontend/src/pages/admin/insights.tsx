/*
 * route: /admin/insights — thin page wrapper for the Pages Router.
 * wraps the AdminInsights screen (impact KPIs + charts) in AdminGate so the
 * route is admin-only; AdminGate handles the auth/role check + redirect, and
 * all data-fetching and rendering live in the screen component. matches the
 * pattern of the other admin/* pages (e.g. admin/index.tsx).
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminInsights from '@/screens/admin/AdminInsights'

// default export is the route component required by the Pages Router.
export default function AdminInsightsPage() {
  return (
    <AdminGate>
      <AdminInsights />
    </AdminGate>
  )
}
