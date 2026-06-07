import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard,
  Layers,
  ClipboardList,
  BarChart3,
  MessagesSquare,
  Home,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

interface NavItem {
  href: string
  key: string
  icon: LucideIcon
  exact?: boolean
  external?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/volunteer-hub', key: 'dashboard', icon: LayoutDashboard, exact: true },
  { href: '/volunteer-hub/pool', key: 'pool', icon: Layers },
  { href: '/volunteer-hub/assigned', key: 'assigned', icon: ClipboardList },
  { href: '/volunteer-hub/insights', key: 'insights', icon: BarChart3 },
  { href: '/chats', key: 'chats', icon: MessagesSquare, external: true },
]

function isActive(pathname: string, item: NavItem) {
  if (item.external) return false
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function VolunteerSidebar() {
  const { t } = useLanguage()
  const router = useRouter()
  const v = t.volunteerApp
  const nav = v.nav

  return (
    <aside className="admin-sidebar volapp-sidebar" aria-label={v.brand}>
      <div className="admin-sidebar-brand">
        <Link href="/volunteer-hub" className="admin-sidebar-brand-link">
          <span className="admin-sidebar-mark" aria-hidden="true">דחיפה</span>
          <span className="admin-sidebar-brand-name">{v.brand}</span>
        </Link>
      </div>

      <nav className="admin-sidebar-nav" aria-label={v.brand}>
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
              <span className="admin-nav-label">{nav[item.key as keyof typeof nav]}</span>
            </Link>
          )
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <Link href="/" className="admin-nav-item">
          <Home size={20} aria-hidden="true" />
          <span className="admin-nav-label">{v.backToSite}</span>
        </Link>
      </div>
    </aside>
  )
}
