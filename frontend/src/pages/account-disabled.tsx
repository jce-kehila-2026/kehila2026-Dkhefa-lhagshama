/**
 * Route entry for /account-disabled (Next.js Pages Router).
 *
 * Thin wrapper: the Pages Router maps this file to the URL, but all UI lives in
 * the @/screens/AccountDisabledPage component (keeps pages/ as routing-only,
 * screens/ as presentation). AuthContext redirects here after detecting a
 * disabled account and signing the user out.
 */
import AccountDisabledPage from '@/screens/AccountDisabledPage'

export default function Page() {
  return <AccountDisabledPage />
}
