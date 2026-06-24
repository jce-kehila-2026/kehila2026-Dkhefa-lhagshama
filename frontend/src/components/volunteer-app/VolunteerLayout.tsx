/*
 * VolunteerLayout — the page shell wrapped around every /volunteer-hub/* screen.
 *
 * Its single responsibility is structural chrome: it pairs the persistent
 * VolunteerSidebar (dark nav on desktop, bottom tab bar on mobile) with an
 * optional header (title/subtitle/actions) and the page's content area. It owns
 * no data and no state — callers pass their own header bits and children.
 *
 * Collaborators: VolunteerSidebar (the nav), and _app.tsx (which hides the
 * global Navbar/Footer for these routes so this shell stands alone). It
 * deliberately reuses the admin shell CSS classes (`admin-*`) so the volunteer
 * hub stays visually consistent with AdminLayout; `volapp-shell` is the only
 * volunteer-specific override.
 *
 * Big picture: this is a dumb presentational wrapper. Auth/route-guarding and
 * data fetching happen in the pages that render it, not here.
 */
import type { ReactNode } from 'react'
import VolunteerSidebar from './VolunteerSidebar'

// all props optional so callers can render the bare shell (sidebar + content)
// without a header; pass ReactNode (not just string) to allow inline icons/markup.
interface VolunteerLayoutProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

/**
 * Shell for all /volunteer-hub/* pages: a persistent dark sidebar (desktop)
 * that collapses to a bottom tab bar on mobile, plus a header and content area.
 * The global Navbar/Footer are hidden for /volunteer-hub/* routes in _app.tsx.
 * Mirrors AdminLayout and reuses the admin shell classes.
 */
export default function VolunteerLayout({ title, subtitle, actions, children }: VolunteerLayoutProps) {
  return (
    <div className="admin-shell volapp-shell">
      <VolunteerSidebar />
      <div className="admin-main">
        {/* header only renders when there's a title or actions; subtitle alone
            does not trigger it (subtitle is a child of the title block). */}
        {(title || actions) && (
          <header className="admin-header">
            <div className="admin-header-text">
              {title && <h1 className="admin-header-title">{title}</h1>}
              {subtitle && <p className="admin-header-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="admin-header-actions">{actions}</div>}
          </header>
        )}
        <main className="admin-content page-enter">{children}</main>
      </div>
    </div>
  )
}
