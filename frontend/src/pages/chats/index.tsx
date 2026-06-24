/*
 * route adapter for the `/chats` page (Next.js Pages Router).
 * all UI + data logic lives in the ChatListPage screen (the user's chat inbox:
 * lists their conversations, opens a thread — UC-04 internal chat).
 * keeping the route file thin lets the screen be tested/reused independently of routing.
 */
import ChatListPage from "@/screens/ChatListPage";
import AuthedGate from "@/components/gates/AuthedGate";

// default export = the page Next.js mounts at /chats. Wrapped in AuthedGate so a
// signed-out visitor is redirected to login (consistent with admin/volunteer
// routes) instead of rendering the screen unguarded — audit Prompt 4.
export default function Page() {
  return (
    <AuthedGate>
      <ChatListPage />
    </AuthedGate>
  );
}
