/**
 * Pages Router entry for the /register route.
 *
 * thin wrapper: all sign-up UI + logic lives in the shared @/screens/RegisterPage
 * component (bilingual HE/EN, role selection, firebase auth). this file only maps the
 * url path to that screen, keeping route files dumb and screens reusable/testable.
 */
import RegisterPage from '@/screens/RegisterPage'

// route handler for /register; renders the registration screen unchanged.
export default function Page() {
  return <RegisterPage />
}
