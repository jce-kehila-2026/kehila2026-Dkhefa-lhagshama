/**
 * dynamic route /chats/[id] — the single-chat window screen.
 *
 * thin pages-router wrapper: it owns the url contract (the [id] chat id is
 * read from useRouter inside the screen, not passed as a prop) and delegates
 * all rendering + data/lifecycle logic to ChatWindowPage in src/screens.
 * keep this file dumb; behavior lives in the screen and its hooks.
 */
import ChatWindowPage from "@/screens/ChatWindowPage";

// route entry point next renders for /chats/:id; no props, the screen pulls the id from the router.
export default function Page() {
  return <ChatWindowPage />;
}
