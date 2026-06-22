/**
 * pages/index.tsx — route shim for `/` (the public landing page).
 *
 * Pages Router entry: keeps routing thin by delegating all markup, data
 * fetching, and i18n to the real screen in `src/screens/HomePage`. Every page
 * file under `src/pages/` follows this same thin-route convention, so screens
 * stay portable and testable independent of the router.
 */
import HomePage from '@/screens/HomePage'

// `/` route component. Renders the homepage screen verbatim; no props or
// page-level data wiring live here (HomePage owns its own state/effects).
export default function Page() {
  return <HomePage />
}
