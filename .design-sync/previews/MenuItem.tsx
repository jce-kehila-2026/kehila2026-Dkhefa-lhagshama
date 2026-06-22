import { MenuItem } from 'push-for-fulfillment-frontend'
import { User, Settings, LogOut, LayoutDashboard, Globe } from 'lucide-react'

const surface = {
  position: 'static',
  display: 'inline-block',
  minWidth: 220,
  margin: 24,
} as const

export function AccountMenu() {
  return (
    <div className="menu-popover" style={surface}>
      <MenuItem icon={<User size={15} />}>My profile</MenuItem>
      <MenuItem icon={<LayoutDashboard size={15} />}>Volunteer dashboard</MenuItem>
      <MenuItem icon={<Settings size={15} />}>Account settings</MenuItem>
      <MenuItem icon={<LogOut size={15} />}>Sign out</MenuItem>
    </div>
  )
}

export function WithSelection() {
  return (
    <div className="menu-popover" style={surface}>
      <MenuItem icon={<Globe size={15} />} selected>Hebrew</MenuItem>
      <MenuItem icon={<Globe size={15} />}>English</MenuItem>
      <MenuItem icon={<Globe size={15} />}>Arabic</MenuItem>
    </div>
  )
}
