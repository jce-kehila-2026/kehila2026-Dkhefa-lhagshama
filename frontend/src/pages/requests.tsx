/**
 * Route shim for /requests (Pages Router).
 *
 * thin entry that just mounts the real screen; all UC-01 "submit request" logic
 * (the multi-step beneficiary request form, auth gating, draft persistence,
 * file upload, POST /api/requests) lives in src/screens/RequestsPage.tsx.
 * keeping page files minimal is the convention across src/pages here.
 */
import RequestsPage from '@/screens/RequestsPage'

// next.js page component for /requests; delegates entirely to the screen.
export default function Page() {
  return <RequestsPage />
}
