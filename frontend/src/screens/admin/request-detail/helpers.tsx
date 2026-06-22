import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AdminCopy, ActiveVolunteer, RequestEvent } from './types'

// Read a flat (string) reqDetail key, narrowing away the nested MatchingCopy
// (WS-6) so timeline labels stay typed as plain strings.
export function rdStr(a: AdminCopy, key: string): string {
  const v = a.reqDetail[key]
  return typeof v === 'string' ? v : ''
}

export function eventLabel(ev: RequestEvent, a: AdminCopy, volunteers: ActiveVolunteer[]): string {
  switch (ev.type) {
    case 'assigned': {
      // The 'assigned' event stores the raw volunteer uid; resolve it to a
      // display name from the loaded active-volunteers list so the timeline
      // shows a name (like the list page and the assigned label do), not a
      // 28-char database id. Fall back to the uid if the volunteer is no longer
      // in the active list (e.g. later deactivated).
      const uid = ev.details && typeof ev.details.volunteerId === 'string' ? ev.details.volunteerId : ''
      const name = volunteers.find((v) => v.uid === uid)?.fullName || uid
      return `${a.reqDetail.assign}: ${name}`
    }
    case 'status_changed':
      return `${a.reqDetail.changeStatus}: ${
        (ev.details && ev.details.to && a.statusLabels[ev.details.to]) || (ev.details && ev.details.to) || ''
      }`
    case 'note_added':
      return (ev.details && ev.details.note) || rdStr(a, 'addNote')
    // req 25 — consent-close handshake trail: details carry
    // { action: 'proposed'|'approved'|'declined', role: 'volunteer'|'beneficiary' }.
    case 'close_consent': {
      const action = typeof ev.details?.action === 'string' ? ev.details.action : ''
      const role = typeof ev.details?.role === 'string' ? ev.details.role : ''
      const base =
        action === 'declined'
          ? rdStr(a, 'closeConsentDeclined')
          : action === 'approved'
            ? rdStr(a, 'closeConsentApproved')
            : rdStr(a, 'closeConsentProposed')
      const roleLabel = (role && a.roleLabels[role]) || role
      return roleLabel ? `${base} (${roleLabel})` : base
    }
    default:
      return ev.type
  }
}

// A meta cell in the request summary: a labelled value with a quiet icon.
// Declared at module scope (not inside render) so it never remounts.
interface MetaCellProps {
  icon: LucideIcon
  label: ReactNode
  children: ReactNode
}

export function MetaCell({ icon: Icon, label, children }: MetaCellProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        paddingBlock: 'var(--sp-2)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          width: '34px',
          height: '34px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--sky-3)',
          color: 'var(--ink-2)',
        }}
      >
        <Icon size={17} />
      </span>
      <div style={{ minWidth: 0 }}>
        <dt
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 'var(--fs-xs)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--gray-500)',
            margin: 0,
          }}
        >
          {label}
        </dt>
        <dd
          style={{
            margin: '4px 0 0',
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {children}
        </dd>
      </div>
    </div>
  )
}
