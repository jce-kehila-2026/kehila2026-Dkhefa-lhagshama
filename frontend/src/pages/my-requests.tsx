/**
 * Pages-Router route entry for /my-requests (beneficiary's own request board).
 * Thin wrapper: the route exists only so Next.js maps the URL to a page; all
 * real logic (auth gating, fetching the user's requests, the status carousel,
 * suggestions, save-profile offer) lives in @/screens/MyRequestsPage.
 * Keep this file a one-liner so screens stay reusable and testable outside routing.
 */
import MyRequestsPage from "@/screens/MyRequestsPage";

// route component Next renders for the page; delegates straight to the screen.
export default function Page() {
  return <MyRequestsPage />;
}
