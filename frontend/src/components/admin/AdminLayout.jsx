import AdminSidebar from './AdminSidebar'

/**
 * Shell for all /admin/* pages: a persistent dark sidebar (desktop) that
 * collapses to a bottom tab bar on mobile, plus a header and content area.
 * The global Navbar/Footer are hidden for /admin/* routes in pages/_app.tsx.
 */
export default function AdminLayout({ title, subtitle, actions, children }) {
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-main">
        {(title || actions) && (
          <header className="admin-header">
            <div className="admin-header-text">
              {title && <h1 className="admin-header-title">{title}</h1>}
              {subtitle && <p className="admin-header-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="admin-header-actions">{actions}</div>}
          </header>
        )}
        <div className="admin-content">{children}</div>
      </div>
    </div>
  )
}
