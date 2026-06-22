/**
 * /admin/approvals route entry (Pages Router). UC-05 admin approval queue.
 * thin composition: wraps the heavy <AdminApprovalsPage> screen (the queue UI,
 * data fetching, approve/reject actions) in <AdminGate> so only an authenticated
 * admin ever renders it; non-admins are redirected by the gate. all real logic
 * lives in the screen and the gate, never here.
 */
import AdminGate from '@/components/admin/AdminGate'
import AdminApprovalsPage from '@/screens/admin/AdminApprovalsPage'

// page-level wrapper: gate first, screen second. keep this empty of logic.
export default function AdminApprovals() {
  return (
    <AdminGate>
      <AdminApprovalsPage />
    </AdminGate>
  )
}
