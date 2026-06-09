import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Tag,
  Clock,
  Calendar,
  MapPin,
  ShieldCheck,
  History,
  Users,
  Check,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiFetch, apiJson } from '@/lib/apiClient'
import { formatDate } from '@/utils/helpers'
import VolunteerLayout from '@/components/volunteer-app/VolunteerLayout'
import { ErrorState, EmptyState, StatusBadge } from '@/components/admin/AdminUI'

interface PoolItem {
  id: string
  title?: string
  firstName?: string
  city?: string
  category?: string
  description?: string
  status?: string
  urgency?: string
  deadline?: string | null
  createdAt?: string
  origin?: string
  requestType?: string
  wasPreviouslyTaken?: boolean
  claimsCount?: number
  claimedByMe?: boolean
}

interface PoolByCategory {
  category: string
  count: number
}

interface PoolResponse {
  items: PoolItem[]
  byCategory: PoolByCategory[]
}

export default function VolunteerPoolPage() {
  const { t, lang } = useLanguage()
  const v = t.volunteerApp
  const p = v.pool
  const statusLabels = t.lifecycle.statusLabels as Record<string, string>

  const [data, setData] = useState<PoolResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson<PoolResponse>('/api/volunteer/pool')
      setData(res)
    } catch {
      setError(v.ui.loadError)
    } finally {
      setLoading(false)
    }
  }, [v.ui.loadError])

  useEffect(() => {
    load()
  }, [load])

  const items = useMemo(() => {
    const all = data?.items ?? []
    return activeCat ? all.filter((i) => i.category === activeCat) : all
  }, [data, activeCat])

  const claim = async (item: PoolItem) => {
    if (item.claimedByMe || claiming) return
    const note = window.prompt(p.claimNotePrompt) ?? undefined
    setClaiming(item.id)
    setNotice(null)
    try {
      const res = await apiFetch(`/api/volunteer/pool/${item.id}/claim`, {
        method: 'POST',
        body: JSON.stringify({ note: note || undefined }),
      })
      if (res.status === 409) {
        setNotice({ kind: 'err', text: p.claimConflict })
      } else if (!res.ok) {
        setNotice({ kind: 'err', text: p.claimError })
      } else {
        setNotice({ kind: 'ok', text: p.claimSuccess })
      }
      await load()
    } catch {
      setNotice({ kind: 'err', text: p.claimError })
    } finally {
      setClaiming(null)
    }
  }

  const urgencyTone = (u?: string) =>
    u === 'high' ? 'badge-red' : u === 'medium' ? 'badge-amber' : 'badge-gray'

  const renderBody = () => {
    if (error) {
      return <ErrorState message={error} onRetry={load} retryLabel={v.ui.retry} />
    }
    if (loading) {
      return (
        <div className="volapp-card-grid" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div className="card volapp-req-card" key={i}>
              <span className="skeleton skeleton-line" style={{ width: '70%' }} aria-hidden="true" />
              <span className="skeleton skeleton-line" style={{ width: '90%' }} aria-hidden="true" />
              <span className="skeleton skeleton-line" style={{ width: '40%' }} aria-hidden="true" />
            </div>
          ))}
        </div>
      )
    }
    if (items.length === 0) {
      return <EmptyState title={p.empty} />
    }

    return (
      <div className="volapp-card-grid">
        {items.map((item) => (
          <article key={item.id} className="card volapp-req-card">
            <div className="volapp-req-head">
              <h3 className="volapp-req-title">{item.title || item.category}</h3>
              {item.status && (
                <StatusBadge
                  status={item.status}
                  label={statusLabels[item.status] ?? item.status}
                />
              )}
            </div>

            <div className="volapp-badges">
              {item.urgency && (
                <span className={`badge ${urgencyTone(item.urgency)}`}>
                  <Clock size={13} aria-hidden="true" />
                  {v.assigned[
                    item.urgency === 'high'
                      ? 'urgencyHigh'
                      : item.urgency === 'medium'
                        ? 'urgencyMedium'
                        : 'urgencyLow'
                  ]}
                </span>
              )}
              {item.category && (
                <span className="badge badge-blue">
                  <Tag size={13} aria-hidden="true" />
                  {item.category}
                </span>
              )}
              {item.origin === 'admin' && (
                <span className="badge badge-ember">
                  <ShieldCheck size={13} aria-hidden="true" />
                  {p.fromAdmin}
                </span>
              )}
              {item.wasPreviouslyTaken && (
                <span className="badge badge-amber">
                  <History size={13} aria-hidden="true" />
                  {p.previouslyTaken}
                </span>
              )}
            </div>

            {item.description && <p className="volapp-req-desc">{item.description}</p>}

            <dl className="volapp-meta">
              {(item.firstName || item.city) && (
                <div className="volapp-meta-row">
                  <dt><MapPin size={13} aria-hidden="true" /> {p.requester}</dt>
                  <dd>
                    {[item.firstName, item.city].filter(Boolean).join(' · ')}
                  </dd>
                </div>
              )}
              <div className="volapp-meta-row">
                <dt><Calendar size={13} aria-hidden="true" /> {v.assigned.deadline}</dt>
                <dd>{item.deadline ? formatDate(item.deadline, lang) : v.ui.noDeadline}</dd>
              </div>
              <div className="volapp-meta-row">
                <dt><Users size={13} aria-hidden="true" /> <span className="sr-only">{p.claimsCount(item.claimsCount ?? 0)}</span></dt>
                <dd className="volapp-num">{p.claimsCount(item.claimsCount ?? 0)}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="btn btn-primary btn-sm volapp-claim-btn"
              disabled={item.claimedByMe || claiming === item.id}
              onClick={() => claim(item)}
            >
              {item.claimedByMe ? (
                <>
                  <Check size={15} aria-hidden="true" />
                  {p.claimed}
                </>
              ) : (
                p.claim
              )}
            </button>
          </article>
        ))}
      </div>
    )
  }

  return (
    <VolunteerLayout title={p.title} subtitle={p.subtitle}>
      {notice && (
        <p
          className={`volapp-inline-msg${notice.kind === 'err' ? ' is-error' : ''}`}
          role="status"
        >
          {notice.text}
        </p>
      )}

      {/* ── Category filter chips (byCategory summary) ──────────── */}
      {data && data.byCategory.length > 0 && (
        <div className="volapp-filter-row" role="group" aria-label={p.summaryTitle}>
          <button
            type="button"
            className={`volapp-filter-chip${activeCat === null ? ' is-active' : ''}`}
            aria-pressed={activeCat === null}
            onClick={() => setActiveCat(null)}
          >
            {p.all}
            <span className="volapp-count-num">{data.items.length}</span>
          </button>
          {data.byCategory.map((b) => (
            <button
              key={b.category}
              type="button"
              className={`volapp-filter-chip${activeCat === b.category ? ' is-active' : ''}`}
              aria-pressed={activeCat === b.category}
              onClick={() => setActiveCat(b.category)}
            >
              {b.category}
              <span className="volapp-count-num">{b.count}</span>
            </button>
          ))}
        </div>
      )}

      {renderBody()}
    </VolunteerLayout>
  )
}
