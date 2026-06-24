/**
 * Pages-Router route entry for /my-requests (beneficiary's own request board).
 * Thin wrapper: the route exists only so Next.js maps the URL to a page; all
 * real logic (auth gating, fetching the user's requests, the status carousel,
 * suggestions, save-profile offer) lives in @/screens/MyRequestsPage.
 * Keep this file a one-liner so screens stay reusable and testable outside routing.
 */
import MyRequestsPage from "@/screens/MyRequestsPage";
import AuthedGate from "@/components/gates/AuthedGate";

// Wrapped in AuthedGate (audit Prompt 4 H1): the screen previously did a bespoke
// 600ms setTimeout redirect for signed-out users while rendering its full header
// + skeleton, i.e. a flash of beneficiary content before the bounce to /login.
// The gate decides access synchronously and shows only GateLoading until allowed,
// so signed-out visitors never see the page — matching the admin/volunteer/chats
// routes. The screen's own data/role logic still runs for signed-in users.
export default function Page() {
  return (
    <AuthedGate>
      <MyRequestsPage />
    </AuthedGate>
  );
}
