import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Layers,
  MessagesSquare,
  ArrowUpRight,
  Tag,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'
import type { VolunteerMe } from '@/types'
import VolunteerLayout from '@/components/volunteer-app/VolunteerLayout'
import { StatCard, ErrorState } from '@/components/admin/AdminUI'
import Reveal from '@/components/motion/Reveal'

interface AssignedItem {
  id: string
  title?: string
  category?: string
  status?: string
}

interface PoolByCategory {
  category: string
  count: number
}

interface PoolResponse {
  items: { id: string }[]
  byCategory: PoolByCategory[]
}

interface AssignedResponse {
  items: AssignedItem[]
}

export default function VolunteerDashboard() {
  const { t } = useLanguage()
  const v = t.volunteerApp
  const d = v.dash

  const [me, setMe] = useState<VolunteerMe | null>(null)
  const [assigned, setAssigned] = useState<AssignedItem[]>([])
  const [pool, setPool] = useState<PoolResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Work-status + category-request inline feedback.
  const [statusBusy, setStatusBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [statusErr, setStatusErr] = useState(false)
  const [catName, setCatName] = useState('')
  const [catNote, setCatNote] = useState('')
  const [catBusy, setCatBusy] = useState(false)
  const [catMsg, setCatMsg] = useState<string | null>(null)
  const [catErr, setCatErr] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [meData, assignedData, poolData] = await Promise.all([
        apiJson<VolunteerMe>('/api/volunteer/me'),
        apiJson<AssignedResponse>('/api/volunteer/assigned'),
        apiJson<PoolResponse>('/api/volunteer/pool'),
      ])
      setMe(meData)
      setAssigned(assignedData.items ?? [])
      setPool(poolData)
    } catch {
      setError(v.ui.loadError)
    } finally {
      setLoading(false)
    }
  }, [v.ui.loadError])

  useEffect(() => {
    load()
  }, [load])

  const kpis = useMemo(() => {
    const inProgress = assigned.filter(
      (a) => a.status === 'in_progress',
    ).length
    const done = assigned.filter(
      (a) => a.status === 'closed' || a.status === 'awaiting_review',
    ).length
    const poolAvailable = pool?.items.length ?? 0
    return { assigned: assigned.length, inProgress, done, poolAvailable }
  }, [assigned, pool])

  const tiles: { key: string; label: string; value: number; tone: string; icon: LucideIcon }[] = [
    { key: 'assigned', label: d.kpis.assigned, value: kpis.assigned, tone: 'info', icon: ClipboardList },
    { key: 'inProgress', label: d.kpis.inProgress, value: kpis.inProgress, tone: 'pending', icon: Clock },
    { key: 'done', label: d.kpis.done, value: kpis.done, tone: 'success', icon: CheckCircle2 },
    { key: 'poolAvailable', label: d.kpis.poolAvailable, value: kpis.poolAvailable, tone: 'default', icon: Layers },
  ]

  const setWorkStatus = async (status: VolunteerMe['workStatus']) => {
    if (statusBusy || me?.workStatus === status) return
    setStatusBusy(true)
    setStatusMsg(null)
    setStatusErr(false)
    try {
      const updated = await apiJson<VolunteerMe>('/api/volunteer/me', {
        method: 'PATCH',
        body: JSON.stringify({ workStatus: status }),
      })
      setMe(updated)
      setStatusMsg(d.workStatus.saved)
    } catch {
      setStatusErr(true)
      setStatusMsg(d.workStatus.error)
    } finally {
      setStatusBusy(false)
    }
  }

  const requestCategory = async (e: FormEvent) => {
    e.preventDefault()
    const category = catName.trim()
    if (!category || catBusy) return
    setCatBusy(true)
    setCatMsg(null)
    setCatErr(false)
    try {
      const updated = await apiJson<VolunteerMe>('/api/volunteer/me', {
        method: 'PATCH',
        body: JSON.stringify({
          requestCategory: { category, note: catNote.trim() || undefined },
        }),
      })
      setMe(updated)
      setCatName('')
      setCatNote('')
      setCatMsg(d.categories.requestSaved)
    } catch {
      setCatErr(true)
      setCatMsg(d.categories.requestError)
    } finally {
      setCatBusy(false)
    }
  }

  const statusKeyLabel: Record<string, string> = {
    pending: d.categories.statusPending,
    approved: d.categories.statusApproved,
    rejected: d.categories.statusRejected,
  }

  const workOptions: { key: VolunteerMe['workStatus']; label: string }[] = [
    { key: 'free', label: d.workStatus.free },
    { key: 'working', label: d.workStatus.working },
    { key: 'unavailable', label: d.workStatus.unavailable },
  ]

  return (
    <VolunteerLayout title={d.title} subtitle={d.subtitle}>
      {error && (
        <div style={{ marginBlockEnd: 'var(--sp-5, 1.25rem)' }}>
          <ErrorState message={error} onRetry={load} retryLabel={v.ui.retry} />
        </div>
      )}

      {/* ── KPI tiles ─────────────────────────────────────────── */}
      <Reveal className="stat-grid" y={16}>
        {tiles.map((tile) => (
          <StatCard
            key={tile.key}
            label={tile.label}
            value={tile.value}
            loading={loading}
            tone={tile.tone}
            icon={tile.icon}
          />
        ))}
      </Reveal>

      <Reveal className="volapp-columns" y={16} delay={0.05}>
        {/* ── Work status ─────────────────────────────────────── */}
        <section className="card volapp-panel">
          <h2 className="volapp-panel-title">{d.workStatus.title}</h2>
          <p className="volapp-panel-sub">{d.workStatus.subtitle}</p>
          <div className="volapp-segmented" role="group" aria-label={d.workStatus.title}>
            {workOptions.map((opt) => {
              const active = me?.workStatus === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`volapp-segment${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  disabled={statusBusy}
                  onClick={() => setWorkStatus(opt.key)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {statusMsg && (
            <p
              className={`volapp-inline-msg${statusErr ? ' is-error' : ''}`}
              role={statusErr ? 'alert' : 'status'}
            >
              {statusMsg}
            </p>
          )}
        </section>

        {/* ── My chats link ───────────────────────────────────── */}
        <section className="card volapp-panel">
          <h2 className="volapp-panel-title">{d.myChats.title}</h2>
          <p className="volapp-panel-sub">{d.myChats.body}</p>
          <Link href="/chats" className="btn btn-outline btn-sm volapp-chats-link">
            <MessagesSquare size={16} aria-hidden="true" />
            {d.myChats.link}
          </Link>
        </section>
      </Reveal>

      {/* ── Categories ──────────────────────────────────────────── */}
      <Reveal delay={0.1}>
      <section className="card volapp-panel">
        <h2 className="volapp-panel-title">{d.categories.title}</h2>

        <div className="volapp-cat-block">
          <h3 className="volapp-subhead">{d.categories.approved}</h3>
          {me && me.approvedCategories.length > 0 ? (
            <div className="volapp-chips">
              {me.approvedCategories.map((c) => (
                <span key={c} className="badge badge-green">
                  <span className="badge-dot" aria-hidden="true" />
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="volapp-muted">{d.categories.none}</p>
          )}
        </div>

        {me && me.requestedCategories.length > 0 && (
          <div className="volapp-cat-block">
            <h3 className="volapp-subhead">{d.categories.requested}</h3>
            <div className="volapp-chips">
              {me.requestedCategories.map((rc, i) => (
                <span key={`${rc.category}-${i}`} className="badge badge-amber">
                  <span className="badge-dot" aria-hidden="true" />
                  {rc.category}
                  {rc.status ? ` · ${statusKeyLabel[rc.status] ?? rc.status}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <form className="volapp-cat-form" onSubmit={requestCategory}>
          <h3 className="volapp-subhead">{d.categories.requestTitle}</h3>
          <div className="volapp-cat-fields">
            <input
              type="text"
              name="requestCategory"
              className="form-input"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder={d.categories.requestPlaceholder}
              aria-label={d.categories.requestPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
            <input
              type="text"
              name="requestCategoryNote"
              className="form-input"
              value={catNote}
              onChange={(e) => setCatNote(e.target.value)}
              placeholder={d.categories.notePlaceholder}
              aria-label={d.categories.notePlaceholder}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={catBusy || !catName.trim()}>
              {d.categories.requestBtn}
            </button>
          </div>
          {catMsg && (
            <p
              className={`volapp-inline-msg${catErr ? ' is-error' : ''}`}
              role={catErr ? 'alert' : 'status'}
            >
              {catMsg}
            </p>
          )}
        </form>
      </section>
      </Reveal>

      {/* ── Per-category counts (pool byCategory) ──────────────── */}
      <Reveal delay={0.15}>
      <section className="card volapp-panel">
        <h2 className="volapp-panel-title">{d.perCategory.title}</h2>
        <p className="volapp-panel-sub">{d.perCategory.subtitle}</p>
        {pool && pool.byCategory.length > 0 ? (
          <div className="volapp-chips">
            {pool.byCategory.map((b) => (
              <span key={b.category} className="volapp-count-chip">
                <Tag size={14} aria-hidden="true" />
                {b.category}
                <span className="volapp-count-num">{b.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="volapp-muted">{v.ui.empty}</p>
        )}
        <Link href="/volunteer-hub/pool" className="volapp-jump">
          {v.nav.pool}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </section>
      </Reveal>
    </VolunteerLayout>
  )
}
