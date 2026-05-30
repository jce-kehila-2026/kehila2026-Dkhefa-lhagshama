import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard,
  Inbox,
  HeartHandshake,
  Users,
  CheckSquare,
  Home,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

const NAV_ITEMS = [
  { href: '/admin', key: 'dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/requests', key: 'requests', icon: Inbox },
  { href: '/admin/volunteers', key: 'volunteers', icon: HeartHandshake },
  { href: '/admin/users', key: 'users', icon: Users },
  { href: '/admin/approvals', key: 'approvals', icon: CheckSquare },
]

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function AdminSidebar() {
  const { t } = useLanguage()
  const router = useRouter()
  const nav = t.admin.nav

  return (
    <aside className="admin-sidebar" aria-label={t.admin.title}>
      <div className="admin-sidebar-brand">
        <Link href="/admin" className="admin-sidebar-brand-link">
          {t.admin.title}
        </Link>
      </div>

      <nav className="admin-sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isActive(router.pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-item${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="admin-nav-label">{nav[item.key]}</span>
            </Link>
          )
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <Link href="/" className="admin-nav-item">
          <Home size={20} aria-hidden="true" />
          <span className="admin-nav-label">{nav.backToSite}</span>
        </Link>
      </div>
    </aside>
  )
}
