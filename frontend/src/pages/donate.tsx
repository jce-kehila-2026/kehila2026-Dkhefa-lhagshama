/*
 * route adapter for the public `/donate` page (Next.js Pages Router).
 * all UI lives in the DonatePage screen; bank details are in data/donation.ts.
 */
import DonatePage from '@/screens/DonatePage'

export default function Page() {
  return <DonatePage />
}
