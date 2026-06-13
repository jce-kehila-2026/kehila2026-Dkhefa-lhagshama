import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { CheckCircle, XCircle, MessageSquare, Store, Lightbulb, Layers, ClipboardCheck } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useApp } from '@/contexts/AppContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import Reveal from '../../components/motion/Reveal'
import { EmptyState, ErrorState, TableSkeleton, adminErrorMessage } from '@/components/admin/AdminUI'
import type { Lang } from '@/types'

// Orgs live in the answers collection now (split by orgType); nothing writes to
// a separate organizations collection, so it is not an approval entity.
const ENTITY_FILTERS = ['all', 'businesses', 'answers']

// A translatable field as stored by the API: either a plain string or a
// per-language object. Rendered through `L` so we never hand a raw object to React.
type LocalizedField = string | { he?: string; en?: string; [key: string]: string | undefined } | undefined | null

type EntityType = 'businesses' | 'answers'

interface ApprovalItem {
  id: string
  entityType: EntityType | string
  name?: LocalizedField
  title?: LocalizedField
}

type ApprovalAction = 'approve' | 'reject' | 'request_changes'

interface PendingAction {
  item: ApprovalItem
  action: ApprovalAction
}

// Businesses/answers store translatable fields as { he, en } objects. Render
// the active-language value (falling back to he) so the approval queue never
// tries to render a raw object as a React child.
const L = (v: LocalizedField, lang: Lang): string => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const obj = v as { he?: string; en?: string; [key: string]: string | undefined }
    return obj[lang] ?? obj.he ?? ''
  }
  return (v as string) ?? ''
}

// Distinct badge tone per entity type so the queue is scannable at a glance.
const ENTITY_TONE: Record<string, string> = {
  businesses: 'badge-amber',
  answers: 'badge-green',
}

// A small per-entity glyph + tint pairing. The icon makes each card scannable
// at a glance and echoes the brand's editorial, color-restrained surfaces.
interface EntityVisual {
  Icon: typeof Store
  fg: string
  bg: string
}

const ENTITY_VISUAL: Record<string, EntityVisual> = {
  businesses: { Icon: Store,     fg: 'var(--warning)', bg: 'var(--warning-soft)' },
  answers:    { Icon: Lightbulb, fg: 'var(--success)', bg: 'var(--success-soft)' },
  all:        { Icon: Layers,    fg: 'var(--ember)',   bg: 'var(--ember-soft)' },
}

/**
 * Approval queue rendered inside the admin shell. Reuses the existing
 * /api/admin/pending + approve|reject|request-changes endpoints (UC-05).
 */
export default function AdminApprovalsPage() {
  const { t, lang } = useLanguage()
  const a = t.admin
  const { toast } = useApp()

  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  // Pending action awaiting confirmation: { item, action } | null.
  const [pending, setPending] = useState<PendingAction | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson('/api/admin/pending') as { items?: ApprovalItem[] }
      setItems(res.items || [])
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => {
    load()
  }, [load])

  const act = async (item: ApprovalItem, action: ApprovalAction) => {
    setBusyId(item.id)
    try {
      const endpoint = action.replace('_', '-')
      const res = await apiFetch(`/api/admin/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ entityType: item.entityType, entityId: item.id }),
      })
      if (!res.ok) throw new Error('action_failed')
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast(a.approvals.actionSuccess, 'success')
    } catch {
      toast(a.approvals.actionError, 'error')
    } finally {
      setBusyId(null)
      setPending(null)
    }
  }

  // Per-action confirm copy + theming. Reject is destructive → danger variant.
  const c = a.approvals.confirm
  const CONFIRM_COPY: Record<ApprovalAction, { title: string; body: string; variant: 'default' | 'danger'; label: string }> = {
    approve:         { title: c.approveTitle, body: c.approveBody, variant: 'default', label: t.admin.table.approve },
    reject:          { title: c.rejectTitle,  body: c.rejectBody,  variant: 'danger',  label: t.admin.table.reject },
    request_changes: { title: c.changesTitle, body: c.changesBody, variant: 'default', label: a.approvals.requestChanges },
  }
  const pendingCopy = pending ? CONFIRM_COPY[pending.action] : null

  const counts: Record<string, number> = {
    all: items.length,
    businesses: items.filter((i) => i.entityType === 'businesses').length,
    answers: items.filter((i) => i.entityType === 'answers').length,
  }
  const filtered = filter === 'all' ? items : items.filter((i) => i.entityType === filter)
  const labels: Record<string, string> = {
    all: a.approvals.entityAll,
    businesses: a.approvals.entityBusinesses,
    answers: a.approvals.entityAnswers,
  }

  return (
    <AdminLayout title={a.approvals.title} subtitle={a.approvals.subtitle}>
      {/* QUEUE SUMMARY: a quiet count strip that frames the work ahead. */}
      <div className="card admin-approvals-summary" aria-live="polite">
        <span aria-hidden="true" className="admin-approvals-summary-icon">
          <ClipboardCheck size={22} />
        </span>
        <div className="admin-approvals-summary-body">
          <span className="admin-approvals-eyebrow">
            {lang === 'he' ? 'תור אישורים' : 'Approval queue'}
          </span>
          <p className="admin-approvals-count">
            {loading
              ? (lang === 'he' ? 'טוען את התור…' : 'Loading the queue…')
              : counts.all === 0
                ? (lang === 'he' ? 'אין פריטים הממתינים לאישור.' : 'No items are waiting for review.')
                : counts.all === 1
                  ? (lang === 'he' ? 'פריט אחד ממתין לאישור.' : '1 item is waiting for your review.')
                  : (lang === 'he'
                      ? `${counts.all} פריטים ממתינים לאישור.`
                      : `${counts.all} items are waiting for your review.`)}
          </p>
        </div>
      </div>

      {/* FILTERS: entity tabs that scope the queue by type, with live counts. */}
      <div
        className="admin-filters"
        role="group"
        aria-label={a.approvals.title}
        style={{ marginBlockEnd: 'var(--sp-5)' }}
      >
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            className={`admin-filter-tab${filter === f ? ' is-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {labels[f]}
            {counts[f] > 0 ? <span className="admin-approval-tab-count">{` (${counts[f]})`}</span> : ''}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : filtered.length === 0 ? (
        <Reveal>
          {counts.all > 0 ? (
            /* Queue is not empty: the active filter just has nothing in it.
               Don't claim the queue is clear; offer a way back to everything. */
            <EmptyState
              icon={Layers}
              title={lang === 'he' ? 'אין פריטים מסוג זה' : 'No items of this type'}
              message={
                <button
                  type="button"
                  className="btn btn-ghost btn-sm admin-approval-clear-filter"
                  onClick={() => setFilter('all')}
                >
                  {lang === 'he' ? 'הצגת כל הפריטים' : 'Show all items'}
                </button>
              }
            />
          ) : (
            <EmptyState icon={CheckCircle} title={a.approvals.empty} />
          )}
        </Reveal>
      ) : (
        <div className="admin-approval-list">
          {filtered.map((item, i) => {
            const visual = ENTITY_VISUAL[item.entityType] || ENTITY_VISUAL.all
            const EntityIcon = visual.Icon
            const isBusy = busyId === item.id
            const displayName = L(item.name, lang) || L(item.title, lang) || item.id
            return (
              <Reveal key={item.id} delay={Math.min(i, 6) * 0.05}>
                <div className={`card admin-approval-card${isBusy ? ' is-busy' : ''}`}>
                  {/* Identity: entity glyph + type badge + display name */}
                  <div className="admin-approval-info">
                    <span
                      aria-hidden="true"
                      className="admin-approval-glyph"
                      style={{ '--approval-glyph-fg': visual.fg, '--approval-glyph-bg': visual.bg } as CSSProperties}
                    >
                      <EntityIcon size={20} />
                    </span>
                    <div className="admin-approval-text">
                      <span className={`badge ${ENTITY_TONE[item.entityType] || 'badge-gray'}`}>
                        <span className="badge-dot" aria-hidden="true" />
                        {labels[item.entityType] || item.entityType}
                      </span>
                      <h3 className="admin-approval-name">{displayName}</h3>
                    </div>
                  </div>

                  {/* Actions: approve leads (ember), then request-changes, then reject */}
                  <div className="admin-row-actions" style={{ marginInlineStart: 'auto' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm admin-approval-action"
                      disabled={isBusy}
                      aria-label={`${a.table.approve}: ${displayName}`}
                      onClick={() => setPending({ item, action: 'approve' })}
                    >
                      <CheckCircle size={14} aria-hidden="true" />
                      {a.table.approve}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm admin-approval-action"
                      disabled={isBusy}
                      aria-label={`${a.approvals.requestChanges}: ${displayName}`}
                      onClick={() => setPending({ item, action: 'request_changes' })}
                    >
                      <MessageSquare size={14} aria-hidden="true" />
                      {a.approvals.requestChanges}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm admin-approval-action admin-approval-reject"
                      disabled={isBusy}
                      aria-label={`${a.table.reject}: ${displayName}`}
                      onClick={() => setPending({ item, action: 'reject' })}
                    >
                      <XCircle size={14} aria-hidden="true" />
                      {a.table.reject}
                    </button>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={pendingCopy?.title ?? ''}
        message={pendingCopy?.body}
        confirmLabel={pendingCopy?.label || t.common.confirm}
        cancelLabel={t.common.cancel}
        variant={pendingCopy?.variant}
        busy={!!pending && busyId === pending.item.id}
        onConfirm={() => pending && act(pending.item, pending.action)}
        onCancel={() => { if (!busyId) setPending(null) }}
      />
    </AdminLayout>
  )
}
