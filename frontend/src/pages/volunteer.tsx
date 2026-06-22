/**
 * Route shim for the public `/volunteer` page (Next.js Pages Router).
 * All UI/logic lives in the `VolunteerPage` screen; this file only wires the
 * route -> component so screens stay reusable and out of the pages/ folder.
 * The screen branches on auth role: volunteers/admins see the team panel,
 * everyone else sees the info + apply CTA.
 */
import VolunteerPage from '@/screens/VolunteerPage'

// next pages-router entry: renders the volunteer screen at `/volunteer`.
export default function Page() {
  return <VolunteerPage />
}
