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
