/**
 * VolunteerDashboard — landing screen of the volunteer hub (/volunteer-hub).
 *
 * Bilingual (HE/EN) overview a logged-in volunteer sees first: hero KPIs
 * (active load / next deadline / availability toggle), a link into chats,
 * their category permissions + a form to request a new one, and per-category
 * open-pool counts. Read-only aside from two writes: the WorkStatusControl
 * availability toggle and the "request a category" PATCH.
 *
 * Data comes from three parallel GETs on mount (/api/volunteer/{me,assigned,pool}).
 * Category labels are resolved through the admin-managed taxonomy (useCategories),
 * with 'uncategorized' special-cased so the raw English id never leaks into HE.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  MessagesSquare,
  ArrowUpRight,
  Tag,
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCategories } from '@/hooks/useCategories'
import { apiJson } from '@/lib/apiClient'
import type { VolunteerMe } from '@/types'
import VolunteerLayout from '@/components/volunteer-app/VolunteerLayout'
import WorkStatusControl from '@/components/volunteer-app/WorkStatusControl'
import { ErrorState } from '@/components/admin/AdminUI'
import Reveal from '@/components/motion/Reveal'
import styles from './VolunteerDashboard.module.css'

// One request currently assigned to this volunteer (subset of fields the
// dashboard reads; status drives the in-progress/done KPIs and next-deadline).
interface AssignedItem {
  id: string
  title?: string
  category?: string
  status?: string
  deadline?: string | null
}

interface PoolByCategory {
  category: string
  count: number
}

// /api/volunteer/pool: open (unassigned) requests this volunteer may claim.
// items drives the total count; byCategory drives the per-category chips.
interface PoolResponse {
  items: { id: string }[]
  byCategory: PoolByCategory[]
}

interface AssignedResponse {
  items: AssignedItem[]
}

// Default-exported page component; rendered by the /volunteer-hub route.
export default function VolunteerDashboard() {
  const { t, lang } = useLanguage()
  const v = t.volunteerApp
  const d = v.dash
  // Admin-managed taxonomy: category-permission picker + chip labels.
  const { categories: allCategories, labelFor } = useCategories()
  // The pool buckets requests with no category under a synthetic
  // 'uncategorized' id that is NOT in the taxonomy, so labelFor would leak the
  // raw English 'uncategorized' into the Hebrew UI. Resolve it to the localized
  // label (mirrors the VolunteerPoolPage catLabel wrapper).
  const catLabel = (id: string): string =>
    id === 'uncategorized' ? t.common.uncategorized : labelFor(id)

  // Short, locale-aware date for the hero "next deadline" and the
  // "available again on" pill. RTL handled by the surrounding flow.
  const fmtDate = (iso: string): string => {
    const dt = new Date(iso)
    if (Number.isNaN(dt.getTime())) return iso
    return dt.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', {
      day: 'numeric',
      month: 'short',
    })
  }

  const [me, setMe] = useState<VolunteerMe | null>(null)
  const [assigned, setAssigned] = useState<AssignedItem[]>([])
  const [pool, setPool] = useState<PoolResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Category-request inline feedback.
  const [catName, setCatName] = useState('')
  const [catNote, setCatNote] = useState('')
  const [catBusy, setCatBusy] = useState(false)
  const [catMsg, setCatMsg] = useState<string | null>(null)
  const [catErr, setCatErr] = useState(false)


  // Fetch me/assigned/pool together; a single failure flags the whole screen
  // (no partial render). Memoized so the mount effect has a stable dep.
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

  // Derived hero stats from the assigned list + pool size.
  const kpis = useMemo(() => {
    const inProgress = assigned.filter(
      (a) => a.status === 'in_progress',
    ).length
    const done = assigned.filter(
      (a) => a.status === 'closed' || a.status === 'awaiting_review',
    ).length
    const poolAvailable = pool?.items.length ?? 0
    // Earliest non-terminal deadline at/after today (the signal the volunteer
    // most needs to see). Terminal requests (closed/awaiting_review) are
    // excluded so a stale past job never surfaces as "next".
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextDeadline = assigned
      .filter((a) => a.status !== 'closed' && a.status !== 'awaiting_review')
      .map((a) => a.deadline)
      .filter((dl): dl is string => typeof dl === 'string' && dl.length > 0)
      .filter((dl) => {
        const dt = new Date(dl)
        return !Number.isNaN(dt.getTime()) && dt.getTime() >= today.getTime()
      })
      .sort()[0] ?? null
    return { assigned: assigned.length, inProgress, done, poolAvailable, nextDeadline }
  }, [assigned, pool])

  // Submit a new category permission request (PATCH /api/volunteer/me with a
  // requestCategory payload). Optimistically swaps in the returned VolunteerMe
  // so the requested-chips list reflects the new pending entry, clears the
  // form, and surfaces inline success/error feedback. Guarded against empty
  // category and double-submit.
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

  // Pickable categories: active taxonomy minus the ones already approved or
  // pending for this volunteer (no point re-requesting them).
  const requestableCategories = useMemo(() => {
    if (!me) return allCategories
    const taken = new Set<string>([
      ...me.approvedCategories,
      ...me.requestedCategories
        .filter((rc) => rc.status === 'pending')
        .map((rc) => rc.category),
    ])
    return allCategories.filter((c) => !taken.has(c.id))
  }, [allCategories, me])

  if (error && !me) {
    return (
      <VolunteerLayout title={d.title} subtitle={d.subtitle}>
        <ErrorState message={error} onRetry={load} retryLabel={v.ui.retry} />
      </VolunteerLayout>
    )
  }

  return (
    <VolunteerLayout title={d.title} subtitle={d.subtitle}>
      {error && (
        <div className={styles.errorWrap}>
          <ErrorState message={error} onRetry={load} retryLabel={v.ui.retry} />
        </div>
      )}

      {/* ── Hero signals: active load · next deadline · availability ── */}
      <Reveal className="voldash-hero" y={16}>
        <section className="card voldash-hero-card">
          <p className="voldash-hero-label">{d.hero.assignedLabel}</p>
          <span className="voldash-hero-value">{loading ? '–' : kpis.assigned}</span>
          <p className="voldash-hero-sub">{`${kpis.inProgress} ${d.hero.openTasks}`}</p>
        </section>

        <section className="card voldash-hero-card">
          <p className="voldash-hero-label">{d.hero.nextDeadlineLabel}</p>
          <span className="voldash-hero-value">
            {loading ? '–' : kpis.nextDeadline ? fmtDate(kpis.nextDeadline) : '–'}
          </span>
          <p className="voldash-hero-sub">
            {kpis.nextDeadline ? '' : d.hero.noDeadline}
          </p>
        </section>

        <section className="card voldash-hero-card">
          <p className="voldash-hero-label">{d.hero.availabilityLabel}</p>
          <WorkStatusControl me={me} onChange={setMe} />
          <Link href="/volunteer-hub/calendar" className="voldash-avail-manage">
            <ClipboardList size={14} aria-hidden="true" />
            {d.availability.manage}
          </Link>
        </section>
      </Reveal>

      {/* ── My chats link ───────────────────────────────────────── */}
      <Reveal y={16} delay={0.05}>
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
                  {labelFor(c)}
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
                  {labelFor(rc.category)}
                  {rc.status ? ` · ${statusKeyLabel[rc.status] ?? rc.status}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <form className="volapp-cat-form" onSubmit={requestCategory}>
          <h3 className="volapp-subhead">{d.categories.requestTitle}</h3>
          <div className="volapp-cat-fields">
            {/* Picker over the admin-managed taxonomy (was free text) —
                already-approved / pending categories are filtered out. */}
            <select
              name="requestCategory"
              className="form-select"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              aria-label={d.categories.requestTitle}
            >
              <option value="">{d.categories.selectPlaceholder}</option>
              {requestableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {labelFor(c.id)}
                </option>
              ))}
            </select>
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
                {catLabel(b.category)}
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
