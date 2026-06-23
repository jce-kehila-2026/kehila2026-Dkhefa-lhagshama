import { Menu, MenuItem } from 'push-for-fulfillment-frontend'
import { User, Settings, LogOut } from 'lucide-react'

const wrap = { padding: 16, maxWidth: 320 } as const

export function AccountTrigger() {
  return (
    <div style={wrap}>
      <Menu label="Account" trigger={<span className="btn btn-outline btn-sm">Account ▾</span>}>
        <MenuItem icon={<User size={15} />}>My profile</MenuItem>
        <MenuItem icon={<Settings size={15} />}>Settings</MenuItem>
        <MenuItem icon={<LogOut size={15} />}>Sign out</MenuItem>
      </Menu>
    </div>
  )
}

export function PrimaryTrigger() {
  return (
    <div style={wrap}>
      <Menu align="start" label="Request actions" trigger={<span className="btn btn-primary btn-sm">Manage request ▾</span>}>
        <MenuItem icon={<User size={15} />}>Assign volunteer</MenuItem>
        <MenuItem icon={<Settings size={15} />}>Change category</MenuItem>
        <MenuItem icon={<LogOut size={15} />}>Close request</MenuItem>
      </Menu>
    </div>
  )
}
