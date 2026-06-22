/**
 * Route entry for `/login` (Next.js Pages Router).
 *
 * Thin wrapper that delegates to the `LoginPage` screen, which holds all auth
 * logic + UI (email/password form, AuthContext.login, and the `?next=` safe
 * post-login redirect via validateRedirect). Keeping pages as one-line screen
 * re-exports is the convention across `src/pages/*` here; put behavior in the
 * screen, not in this file.
 */
import LoginPage from '@/screens/LoginPage'

// default export = the page component Next.js mounts for this route.
export default function Page() {
  return <LoginPage />
}
