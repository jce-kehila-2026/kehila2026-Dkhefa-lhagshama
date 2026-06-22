/*
 * route adapter for the `/chats` page (Next.js Pages Router).
 * all UI + data logic lives in the ChatListPage screen (the user's chat inbox:
 * lists their conversations, opens a thread — UC-04 internal chat).
 * keeping the route file thin lets the screen be tested/reused independently of routing.
 */
import ChatListPage from "@/screens/ChatListPage";

// default export = the page Next.js mounts at /chats; just renders the screen.
export default function Page() {
  return <ChatListPage />;
}
