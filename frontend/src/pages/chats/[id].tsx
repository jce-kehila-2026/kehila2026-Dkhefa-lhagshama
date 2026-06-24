/**
 * dynamic route /chats/[id] — the single-chat window screen.
 *
 * thin pages-router wrapper: it owns the url contract (the [id] chat id is
 * read from useRouter inside the screen, not passed as a prop) and delegates
 * all rendering + data/lifecycle logic to ChatWindowPage in src/screens.
 * keep this file dumb; behavior lives in the screen and its hooks.
 */
import ChatWindowPage from "@/screens/ChatWindowPage";
import AuthedGate from "@/components/gates/AuthedGate";

// route entry point next renders for /chats/:id. Wrapped in AuthedGate so a
// signed-out visitor is redirected to login (consistent with the rest of the
// app) — audit Prompt 4. The screen still pulls the id from the router.
export default function Page() {
  return (
    <AuthedGate>
      <ChatWindowPage />
    </AuthedGate>
  );
}
