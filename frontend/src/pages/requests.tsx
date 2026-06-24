/**
 * Route shim for /requests (Pages Router).
 *
 * thin entry that just mounts the real screen; all UC-01 "submit request" logic
 * (the multi-step beneficiary request form, auth gating, draft persistence,
 * file upload, POST /api/requests) lives in src/screens/RequestsPage.tsx.
 * keeping page files minimal is the convention across src/pages here.
 */
import RequestsPage from '@/screens/RequestsPage'
import AuthedGate from '@/components/gates/AuthedGate'

// Wrapped in AuthedGate (audit Prompt 4 H1): like /my-requests, the submit-request
// screen used a bespoke timeout redirect that could flash content to signed-out
// users. The gate redirects them to /login synchronously with no flash; the
// screen's submit/role logic still runs for signed-in beneficiaries/volunteers.
export default function Page() {
  return (
    <AuthedGate>
      <RequestsPage />
    </AuthedGate>
  )
}
