import type { ReactNode } from 'react'
import {
  MapPin,
  Tag,
  UserCircle2,
  UserPlus,
  Share2,
  Handshake,
} from 'lucide-react'
import type { Translations } from '@/contexts/LanguageContext'
import { formatRequestRef } from '@/lib/requestRef'
import { StatusBadge } from '@/components/admin/AdminUI'
import { EYEBROW } from './types'
import type { ActiveVolunteer, RequestDetail } from './types'
import { MetaCell, rdStr } from './helpers'
import RequestTimeline from './RequestTimeline'

// Anything the Reveal-wrapped main <section> needs from the parent screen.
interface RequestSummaryProps {
  request: RequestDetail
  a: Translations['admin']
  lc: Translations['lifecycle']
  labelFor: (category: string) => ReactNode
  EMPTY: string
  fullName: string
  assignedLabel: ReactNode
  isFormerVolunteer: boolean
  fmt: (ts: string | number | Date | undefined) => string
  volunteers: ActiveVolunteer[]
  saving: boolean
  assigningClaim: string | null
  handleAssignClaim: (volunteerId: string) => void
}

// Editorial header → meta facts → consent-close panel → referral panel →
// claimant list → timeline. Pure presentation; mechanically lifted from the
// screen's main <section>.
export default function RequestSummary({
  request,
  a,
  lc,
  labelFor,
  EMPTY,
  fullName,
  assignedLabel,
  isFormerVolunteer,
  fmt,
  volunteers,
  saving,
  assigningClaim,
  handleAssignClaim,
}: RequestSummaryProps) {
  return (
    <section
      className="card admin-detail-main"
      style={{ padding: 'clamp(var(--sp-5), 3vw, var(--sp-6))' }}
    >
      {/* Editorial header: eyebrow → serif name → status */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--sp-3)',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span style={EYEBROW}>
            <UserCircle2 size={14} aria-hidden="true" />
            {a.reqDetail.title}
          </span>
          <h2
            style={{
              fontFamily: 'Frank Ruhl Libre, Georgia, serif',
              fontSize: 'var(--fs-h2)',
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
              margin: '10px 0 0',
              wordBreak: 'break-word',
            }}
          >
            {/* FIX 1 — never render the raw 36-char UUID; fall back to
                the friendly REQ-#### ref when there's no name. */}
            {fullName || formatRequestRef(request)}
          </h2>
          {/* FIX 1 — always-visible friendly request reference, so the
              admin sees REQ-#### even when a beneficiary name fills the
              heading. Mono caption, never the raw UUID. */}
          <p
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 'var(--fs-xs)',
              letterSpacing: '0.06em',
              color: 'var(--gray-500)',
              margin: '8px 0 0',
            }}
          >
            {rdStr(a, 'requestId')}: {formatRequestRef(request)}
          </p>
        </div>
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
          <StatusBadge
            status={request.status ?? ''}
            label={(request.status ? (a.statusLabels as Record<string, string>)[request.status] : '') || request.status || ''}
          />
          {request.archived && (
            <StatusBadge status="archived" label={lc.archivedBadge} />
          )}
          {(request.onBehalf === true || request.submittedByRole === 'volunteer') && (
            <StatusBadge
              status="onBehalf"
              label={request.submittedBy ? `${a.onBehalf} · ${request.submittedBy}` : a.onBehalf}
            />
          )}
        </span>
      </div>

      <p
        style={{
          color: 'var(--gray-700)',
          fontSize: 'var(--fs-lede)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          margin: 'var(--sp-4) 0 0',
        }}
      >
        {request.description}
      </p>

      {/* Meta facts as labelled, icon-led cells */}
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--sp-1) var(--sp-5)',
          margin: 'var(--sp-5) 0 0',
          paddingBlockStart: 'var(--sp-4)',
          borderBlockStart: '1px solid var(--hair)',
        }}
      >
        <MetaCell icon={Tag} label={a.reqDetail.category}>
          {request.category ? labelFor(request.category) : EMPTY}
        </MetaCell>
        <MetaCell icon={MapPin} label={a.reqDetail.city}>
          {request.city || EMPTY}
        </MetaCell>
        <MetaCell icon={UserCircle2} label={a.reqDetail.assignedTo}>
          {assignedLabel}
          {isFormerVolunteer && (
            <span className="former-tag">{a.reqDetail.formerTag}</span>
          )}
        </MetaCell>
      </dl>

      {/* req 25 — pending consent-close handshake: who proposed and
          where each side stands. The admin may close for the missing
          party via the Close control in the action panel. */}
      {request.closeRequest && (
        <div
          style={{
            margin: 'var(--sp-5) 0 0',
            padding: 'var(--sp-4)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--hair)',
            background: 'var(--sky-3)',
          }}
        >
          <span style={{ ...EYEBROW, color: 'var(--ember)' }}>
            <Handshake size={14} aria-hidden="true" />
            {a.reqDetail.closePanelTitle}
          </span>
          <p style={{ margin: 'var(--sp-2) 0 0', fontWeight: 600, color: 'var(--ink)' }}>
            {a.reqDetail.closeProposedBy}:{' '}
            {(request.closeRequest.proposedRole &&
              (a.roleLabels as Record<string, string>)[request.closeRequest.proposedRole]) ||
              request.closeRequest.proposedRole ||
              EMPTY}
            {' · '}
            {fmt(request.closeRequest.proposedAt ?? undefined)}
          </p>
          <p style={{ margin: 'var(--sp-1) 0 0', color: 'var(--gray-700)', lineHeight: 1.5 }}>
            {(a.roleLabels as Record<string, string>).volunteer}:{' '}
            {request.closeRequest.volunteerApproved
              ? a.reqDetail.closeAgreed
              : a.reqDetail.closeWaiting}
            {' · '}
            {(a.roleLabels as Record<string, string>).beneficiary}:{' '}
            {request.closeRequest.beneficiaryApproved
              ? a.reqDetail.closeAgreed
              : a.reqDetail.closeWaiting}
          </p>
          <p style={{ margin: 'var(--sp-1) 0 0', color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
            {a.reqDetail.closeAdminHint}
          </p>
        </div>
      )}

      {/* Referral panel (Note 8) — shown once the request was referred */}
      {request.referral && request.referral.partnerName && (
        <div
          className="admin-referral-panel"
          style={{
            margin: 'var(--sp-5) 0 0',
            padding: 'var(--sp-4)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--hair)',
            background: 'var(--sky-3)',
          }}
        >
          <span style={{ ...EYEBROW, color: 'var(--ember)' }}>
            <Share2 size={14} aria-hidden="true" />
            {lc.actions.refer}
          </span>
          <p style={{ margin: 'var(--sp-2) 0 0', fontWeight: 600, color: 'var(--ink)' }}>
            {lc.referral.timelineTitle(request.referral.partnerName)}
          </p>
          {request.referral.note && (
            <p style={{ margin: 'var(--sp-1) 0 0', color: 'var(--gray-700)', lineHeight: 1.5 }}>
              {request.referral.note}
            </p>
          )}
        </div>
      )}

      {/* ── Volunteers requesting this (req 22) — multi-claimant review.
          Each claimant shows their name, note + when they claimed, with
          an Assign action. Assigning clears the other claims server-side. ── */}
      {request.claims && request.claims.length > 0 && (
        <div
          style={{
            margin: 'var(--sp-6) 0 0',
            paddingBlockStart: 'var(--sp-5)',
            borderBlockStart: '1px solid var(--hair)',
          }}
        >
          <span style={{ ...EYEBROW, color: 'var(--ember)' }}>
            <UserPlus size={14} aria-hidden="true" />
            {a.claims.heading}
          </span>
          <ul className="admin-claim-list">
            {request.claims.map((claim) => {
              const busyClaim = assigningClaim === claim.volunteerId
              return (
                <li key={claim.volunteerId} className="admin-claim-item">
                  <div className="admin-claim-body">
                    <span className="admin-claim-name">
                      {claim.volunteerName || claim.volunteerId}
                    </span>
                    <p className="admin-claim-note">
                      {claim.note?.trim() || a.claims.noNote}
                    </p>
                    {claim.claimedAt && (
                      <p className="admin-claim-meta">
                        {a.claims.claimedAt}: {fmt(claim.claimedAt)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm admin-claim-assign"
                    disabled={saving || busyClaim}
                    aria-busy={busyClaim || undefined}
                    aria-label={`${a.claims.assign}: ${claim.volunteerName || claim.volunteerId}`}
                    onClick={() => handleAssignClaim(claim.volunteerId)}
                  >
                    {busyClaim ? a.claims.assigning : a.claims.assign}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Timeline */}
      <RequestTimeline request={request} a={a} volunteers={volunteers} fmt={fmt} />
    </section>
  )
}
