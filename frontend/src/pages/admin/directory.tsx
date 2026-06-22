/*
 * route: /admin/directory (Next.js pages router).
 * thin wrapper for the admin community-directory management screen (UC-02/UC-03:
 * the catalog of "answers" — NGOs/initiatives/public bodies — and community businesses).
 * responsibility here is only routing + access control: AdminGate enforces the admin
 * role (redirects non-admins) and all the actual CRUD/list UI lives in AdminDirectoryPage.
 * mirrors the other src/pages/admin/*.tsx wrappers (gate + screen).
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminDirectoryPage from '@/screens/admin/AdminDirectoryPage'

// page entry: gate the directory screen behind admin auth.
export default function AdminDirectory() {
  return (
    <AdminGate>
      <AdminDirectoryPage />
    </AdminGate>
  )
}
