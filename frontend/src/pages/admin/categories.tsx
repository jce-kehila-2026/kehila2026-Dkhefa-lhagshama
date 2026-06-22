/**
 * Route: /admin/categories (Next.js Pages Router page).
 *
 * thin entry point for the admin category-taxonomy manager. all it does is
 * mount the real screen (AdminCategoriesPage) behind AdminGate, which enforces
 * the admin-only access check before any category CRUD UI renders.
 * all data fetching, state, and rendering live in the screen component; this
 * file just wires the route to the gate so the auth invariant holds for the page.
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminCategoriesPage from '@/screens/admin/AdminCategoriesPage'

// default export is the page Next.js mounts for this route; gate wraps the screen.
export default function AdminCategories() {
  return (
    <AdminGate>
      <AdminCategoriesPage />
    </AdminGate>
  )
}
