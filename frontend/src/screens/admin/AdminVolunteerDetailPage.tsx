import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  Briefcase,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HeartHandshake,
  Inbox,
  Languages,
  Mail,
  Tag,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import Reveal from '../../components/motion/Reveal'
import {
  StatusBadge,
  EmptyState,
  ErrorState,
  TableSkeleton,
  adminErrorMessage,
} from '@/components/admin/AdminUI'

// An active volunteer as returned by GET /api/admin/volunteers. Loose by
// design — only the fields this screen reads are declared.
interface VolunteerDetail {
  id: string
  uid: string
  fullName?: string | null
  email?: string | null
  profession?: string | null
  languages?: string[]
  areas?: string[]
  availability?: string | null
  workStatus?: string
  approvedCategories?: string[]
  approvedAt?: string | null
  [key: string]: unknown
}

// A row from GET /api/admin/requests?volunteerId=… — the compact subset the
// assigned-requests table renders.
interface AssignedRow {
  id: string
  firstName?: string
  lastName?: string
  title?: string | null
  description?: string
  category?: string
  status?: string
  urgency?: string
  archived?: boolean
  [key: string]: unknown
}

// A small two-letter monogram derived from the volunteer's display name —
// same presentational identity cue as the roster table.
function initials(name: string | undefined | null): string {
  if (!name) return '·'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  const first = parts[0][0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : ''
  return (first + last).toUpperCase()
}

// A meta cell in the profile summary: a labelled value with a quiet icon.
// Declared at module scope (not inside render) so it never remounts. Mirrors
// the MetaCell pattern on AdminRequestDetailPage.
interface MetaCellProps {
  icon: LucideIcon
  label: ReactNode
  children: ReactNode
}

function MetaCell({ icon: Icon, label, children }: MetaCellProps) {
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

// Shared eyebrow treatment used to label each block — matches the admin
// detail surfaces (uppercase mono, ember accent, generous tracking).
const EYEBROW: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ember)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
}

export default function AdminVolunteerDetailPage() {
  const { t, lang, isRTL } = useLanguage()
  const a = t.admin
  const vd = a.volDetail
  const router = useRouter()
  const uid = typeof router.query.uid === 'string' ? router.query.uid : ''
  const BackArrow = isRTL ? ArrowRight : ArrowLeft
  const ManageArrow = isRTL ? ChevronLeft : ChevronRight

  const [volunteer, setVolunteer] = useState<VolunteerDetail | null>(null)
  const [requests, setRequests] = useState<AssignedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!uid) return
    setLoading(true)
    setError(null)
    try {
      // Single bulk roster call (same pattern as the request detail page) +
      // this volunteer's assigned requests, fetched in parallel. A uid that is
      // absent from the active list is NOT an error — it's a former volunteer;
      // their assigned requests still render below the note.
      const [volData, reqData] = await Promise.all([
        apiJson('/api/admin/volunteers') as Promise<{ active?: VolunteerDetail[] }>,
        apiJson(
          `/api/admin/requests?volunteerId=${encodeURIComponent(uid)}`,
        ) as Promise<{ items?: AssignedRow[] }>,
      ])
      setVolunteer((volData.active || []).find((v) => v.uid === uid) || null)
      setRequests(reqData.items || [])
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setLoading(false)
    }
  }, [uid, lang])

  useEffect(() => {
    load()
  }, [load])

  const isFormer = !loading && !error && !volunteer

  const EMPTY = '·' // middle dot placeholder for missing values

  const fmtDate = (ts: string | null | undefined): string => {
    if (!ts) return EMPTY
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return EMPTY
    return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')
  }

  // Friendly labels for the volunteer ops status (req 14e); raw value as a
  // fallback so an unknown status still renders something truthful.
  const workStatusLabel = (ws: string | undefined): string => {
    if (ws === 'free') return vd.wsFree
    if (ws === 'working') return vd.wsWorking
    if (ws === 'unavailable') return vd.wsUnavailable
    return ws || EMPTY
  }

  const name = volunteer?.fullName || uid

  return (
    <AdminLayout title={vd.title}>
      <Link
        href="/admin/volunteers"
        className="admin-back-link"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
      >
        <BackArrow size={16} aria-hidden="true" />
        {vd.back}
      </Link>

      {error && (
        <div style={{ marginBlockStart: 'var(--sp-4)' }}>
          <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />
        </div>
      )}

      {/* Loading — a skeleton mirroring the profile card + requests table */}
      {loading && (
        <div
          style={{ marginBlockStart: 'var(--sp-5)' }}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">{a.ui.loading}</span>
          <section className="card" style={{ padding: 'var(--sp-5)' }} aria-hidden="true">
            <span className="skeleton skeleton-line" style={{ width: '40%', height: '1.6rem' }} />
            <span className="skeleton skeleton-line" style={{ width: '100%', marginBlockStart: 'var(--sp-4)' }} />
            <span className="skeleton skeleton-line" style={{ width: '85%', marginBlockStart: 'var(--sp-2)' }} />
            <span className="skeleton skeleton-line" style={{ width: '60%', marginBlockStart: 'var(--sp-2)' }} />
          </section>
          <div style={{ marginBlockStart: 'var(--sp-5)' }} aria-hidden="true">
            <TableSkeleton rows={4} cols={5} />
          </div>
        </div>
      )}

      {!loading && !error && (
        <Reveal y={16}>
          {/* The uid is not on the active roster — a deactivated (former)
              volunteer. Their request history still renders below. */}
          {isFormer && (
            <div
              className="admin-notice admin-notice-warn"
              role="status"
              style={{ marginBlockStart: 'var(--sp-4)' }}
            >
              <HeartHandshake size={18} aria-hidden="true" />
              <span>{vd.formerNote}</span>
            </div>
          )}

          {/* ── Profile card: monogram + serif name + status, then the meta
                fields the roster table never shows ─────────────────────── */}
          <section
            className="card"
            style={{
              padding: 'clamp(var(--sp-5), 3vw, var(--sp-6))',
              marginBlockStart: 'var(--sp-5)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--sp-3)',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--sp-4)',
                  alignItems: 'center',
                  minWidth: 0,
                }}
              >
                <span className="admin-vol-avatar admin-vol-avatar--lg" aria-hidden="true">
                  {initials(name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <span style={EYEBROW}>
                    <HeartHandshake size={14} aria-hidden="true" />
                    {vd.title}
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
                    {name}
                  </h2>
                </div>
              </div>
              <StatusBadge
                status={isFormer ? 'inactive' : 'active'}
                label={isFormer ? a.volStatus.inactive : a.volStatus.active}
              />
            </div>

            {/* Meta facts as labelled, icon-led cells (only for active
                volunteers — former ones have no roster doc to read from). */}
            {volunteer && (
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 'var(--sp-1) var(--sp-5)',
                  margin: 'var(--sp-5) 0 0',
                  paddingBlockStart: 'var(--sp-4)',
                  borderBlockStart: '1px solid var(--hair)',
                }}
              >
                <MetaCell icon={Mail} label={vd.email}>
                  {volunteer.email || EMPTY}
                </MetaCell>
                <MetaCell icon={Briefcase} label={vd.profession}>
                  {volunteer.profession || EMPTY}
                </MetaCell>
                <MetaCell icon={Languages} label={vd.languages}>
                  {volunteer.languages && volunteer.languages.length > 0
                    ? volunteer.languages.join(', ')
                    : EMPTY}
                </MetaCell>
                <MetaCell icon={HeartHandshake} label={vd.areas}>
                  {volunteer.areas && volunteer.areas.length > 0
                    ? volunteer.areas.join(', ')
                    : EMPTY}
                </MetaCell>
                <MetaCell icon={Clock3} label={vd.availability}>
                  {volunteer.availability || EMPTY}
                </MetaCell>
                <MetaCell icon={Activity} label={vd.workStatus}>
                  {workStatusLabel(volunteer.workStatus)}
                </MetaCell>
                <MetaCell icon={Tag} label={vd.approvedCategories}>
                  {volunteer.approvedCategories && volunteer.approvedCategories.length > 0 ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        alignItems: 'center',
                      }}
                    >
                      {volunteer.approvedCategories.map((c) => (
                        <span key={c} className="badge badge-ember">
                          {c}
                        </span>
                      ))}
                    </span>
                  ) : (
                    EMPTY
                  )}
                </MetaCell>
                <MetaCell icon={CalendarCheck2} label={vd.approvedAt}>
                  {fmtDate(volunteer.approvedAt)}
                </MetaCell>
              </dl>
            )}
          </section>

          {/* ── Assigned requests: every request currently assigned to this
                volunteer, server-filtered via ?volunteerId= ─────────────── */}
          <section style={{ marginBlockStart: 'var(--sp-6)' }}>
            <div className="admin-reqlist-head">
              <h2 className="admin-reqlist-title">{vd.assignedHeading}</h2>
              <p className="admin-reqlist-count">
                {lang === 'he'
                  ? `${requests.length} ${requests.length === 1 ? 'בקשה' : 'בקשות'}`
                  : `${requests.length} ${requests.length === 1 ? 'request' : 'requests'}`}
              </p>
            </div>

            {requests.length === 0 ? (
              <EmptyState icon={Inbox} title={vd.assignedEmpty} message={vd.assignedEmptyHint} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>{a.reqList.colTitle}</th>
                      <th>{a.reqList.colCategory}</th>
                      <th>{a.reqList.colStatus}</th>
                      <th>{vd.colUrgency}</th>
                      <th className="admin-table-actions-col">{a.ui.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => {
                      const beneficiaryName = [r.firstName, r.lastName].filter(Boolean).join(' ')
                      // Admin task requests carry a `title` and no beneficiary
                      // name; fall back to the description, then the id.
                      const primary =
                        r.title || beneficiaryName || (r.description ? r.description.slice(0, 40) : r.id)
                      return (
                        <tr key={r.id}>
                          <td data-label={a.reqList.colTitle}>
                            <span className="admin-reqlist-primary">{primary}</span>
                          </td>
                          <td data-label={a.reqList.colCategory}>
                            <span className={r.category ? 'admin-reqlist-meta' : 'admin-reqlist-meta--empty'}>
                              {r.category || EMPTY}
                            </span>
                          </td>
                          <td data-label={a.reqList.colStatus}>
                            <span className="admin-reqlist-cell">
                              <StatusBadge
                                status={r.status ?? ''}
                                label={(r.status ? (a.statusLabels as Record<string, string>)[r.status] : '') || r.status || ''}
                              />
                              {r.archived && (
                                <StatusBadge status="archived" label={t.lifecycle.archivedBadge} />
                              )}
                            </span>
                          </td>
                          <td data-label={vd.colUrgency}>
                            <span className={r.urgency ? 'admin-reqlist-meta' : 'admin-reqlist-meta--empty'}>
                              {r.urgency
                                ? (a.urgencyLabels as Record<string, string>)[r.urgency] || r.urgency
                                : EMPTY}
                            </span>
                          </td>
                          <td data-label={a.ui.actions}>
                            <Link
                              href={`/admin/requests/${r.id}`}
                              className="btn btn-ghost btn-sm admin-reqlist-manage"
                            >
                              {a.reqList.manage}
                              <ManageArrow size={15} aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </Reveal>
      )}
    </AdminLayout>
  )
}
