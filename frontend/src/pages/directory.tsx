/*
 * route adapter for the `/directory` page (Next.js Pages Router).
 * all UI + data logic lives in the DirectoryPage screen (community "answers" =
 * orgs/initiatives/public bodies, plus the community business directory — UC-02/UC-03).
 * keeping the route file thin lets screens be tested/reused independently of routing.
 */
import DirectoryPage from '@/screens/DirectoryPage'

// default export = the page Next.js mounts at /directory; just renders the screen.
export default function Page() {
  return <DirectoryPage />
}
