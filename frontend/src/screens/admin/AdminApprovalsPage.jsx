import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, MessageSquare, Store, Building2, Lightbulb, Layers, ClipboardCheck } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useApp } from '@/contexts/AppContext'
import { apiJson, apiFetch } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import ConfirmDialog from '@/components/ConfirmDialog'
import Reveal from '../../components/motion/Reveal'
import { EmptyState, ErrorState, TableSkeleton, adminErrorMessage } from '@/components/admin/AdminUI'

const ENTITY_FILTERS = ['all', 'businesses', 'organizations', 'answers']

// Businesses/answers store translatable fields as { he, en } objects. Render
// the active-language value (falling back to he) so the approval queue never
// tries to render a raw object as a React child.
const L = (v, lang) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v[lang] ?? v.he ?? '') : (v ?? '')

// Distinct badge tone per entity type so the queue is scannable at a glance.
const ENTITY_TONE = {
  businesses: 'badge-amber',
  organizations: 'badge-blue',
  answers: 'badge-green',
}

// A small per-entity glyph + tint pairing. The icon makes each card scannable
// at a glance and echoes the brand's editorial, color-restrained surfaces.
const ENTITY_VISUAL = {
  businesses:    { Icon: Store,     fg: 'var(--warning)', bg: 'var(--warning-soft)' },
  organizations: { Icon: Building2, fg: 'var(--info)',    bg: 'var(--sky-3)' },
  answers:       { Icon: Lightbulb, fg: 'var(--success)', bg: 'var(--success-soft)' },
  all:           { Icon: Layers,    fg: 'var(--ember)',   bg: 'var(--ember-soft)' },
}

/**
 * Approval queue rendered inside the admin shell. Reuses the existing
 * /api/admin/pending + approve|reject|request-changes endpoints (UC-05).
 */
export default function AdminApprovalsPage() {
  const { t, lang } = useLanguage()
  const a = t.admin
  const { toast } = useApp()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)
  // Pending action awaiting confirmation: { item, action } | null.
  const [pending, setPending] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson('/api/admin/pending')
      setItems(res.items || [])
    } catch (err) {
      setError(adminErrorMessage(err, lang))
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => {
    load()
  }, [load])

  const act = async (item, action) => {
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
  const CONFIRM_COPY = {
    approve:         { title: c.approveTitle, body: c.approveBody, variant: 'default', label: t.admin.table.approve },
    reject:          { title: c.rejectTitle,  body: c.rejectBody,  variant: 'danger',  label: t.admin.table.reject },
    request_changes: { title: c.changesTitle, body: c.changesBody, variant: 'default', label: a.approvals.requestChanges },
  }
  const pendingCopy = pending ? CONFIRM_COPY[pending.action] : null

  const counts = {
    all: items.length,
    businesses: items.filter((i) => i.entityType === 'businesses').length,
    organizations: items.filter((i) => i.entityType === 'organizations').length,
    answers: items.filter((i) => i.entityType === 'answers').length,
  }
  const filtered = filter === 'all' ? items : items.filter((i) => i.entityType === filter)
  const labels = {
    all: a.approvals.entityAll,
    businesses: a.approvals.entityBusinesses,
    organizations: a.approvals.entityOrganizations,
    answers: a.approvals.entityAnswers,
  }

  const eyebrowFont = {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: 'var(--fs-xs)',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  }

  return (
    <AdminLayout title={a.approvals.title} subtitle={a.approvals.subtitle}>
      {/* ── QUEUE SUMMARY — a quiet count strip that frames the work ahead ── */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          padding: 'var(--sp-4) var(--sp-5)',
          marginBlockEnd: 'var(--sp-5)',
          border: '1px solid var(--hair)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            inlineSize: '44px',
            blockSize: '44px',
            flexShrink: 0,
            borderRadius: 'var(--radius)',
            color: 'var(--ember)',
            background: 'var(--ember-soft)',
          }}
        >
          <ClipboardCheck size={22} />
        </span>
        <div style={{ minInlineSize: 0 }}>
          <span style={{ ...eyebrowFont, color: 'var(--ember)', display: 'block', marginBlockEnd: '4px' }}>
            {lang === 'he' ? 'תור אישורים' : 'Approval queue'}
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--fs-body)',
              color: 'var(--gray-600)',
              lineHeight: 1.4,
              textAlign: 'start',
            }}
          >
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

      {/* ── FILTERS — entity tabs with live counts ── */}
      <div
        className="admin-filters"
        role="tablist"
        aria-label={a.approvals.title}
        style={{ marginBlockEnd: 'var(--sp-5)' }}
      >
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`admin-filter-tab${filter === f ? ' is-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {labels[f]}
            {counts[f] > 0 ? ` (${counts[f]})` : ''}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : filtered.length === 0 ? (
        <Reveal>
          <EmptyState icon={CheckCircle} title={a.approvals.empty} />
        </Reveal>
      ) : (
        <div
          className="admin-approval-list"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
        >
          {filtered.map((item, i) => {
            const visual = ENTITY_VISUAL[item.entityType] || ENTITY_VISUAL.all
            const EntityIcon = visual.Icon
            const isBusy = busyId === item.id
            return (
              <Reveal key={item.id} delay={Math.min(i, 6) * 0.05}>
                <div
                  className="card"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 'var(--sp-4)',
                    padding: 'var(--sp-4) var(--sp-5)',
                    border: '1px solid var(--hair)',
                    boxShadow: 'var(--shadow-sm)',
                    opacity: isBusy ? 0.6 : 1,
                    transition: 'opacity var(--dur-2) var(--ease-out)',
                  }}
                >
                  {/* Identity: entity glyph + type badge + display name */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-4)',
                      flex: '1 1 16rem',
                      minInlineSize: 0,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        inlineSize: '42px',
                        blockSize: '42px',
                        flexShrink: 0,
                        borderRadius: 'var(--radius)',
                        color: visual.fg,
                        background: visual.bg,
                      }}
                    >
                      <EntityIcon size={20} />
                    </span>
                    <div style={{ minInlineSize: 0 }}>
                      <span className={`badge ${ENTITY_TONE[item.entityType] || 'badge-gray'}`}>
                        <span className="badge-dot" aria-hidden="true" />
                        {labels[item.entityType] || item.entityType}
                      </span>
                      <h3
                        className="admin-approval-name"
                        style={{
                          margin: '6px 0 0',
                          fontSize: 'var(--fs-h3)',
                          fontFamily: 'Frank Ruhl Libre, Georgia, serif',
                          fontWeight: 500,
                          lineHeight: 1.25,
                          color: 'var(--ink)',
                          letterSpacing: '-0.01em',
                          textAlign: 'start',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {L(item.name, lang) || L(item.title, lang) || item.id}
                      </h3>
                    </div>
                  </div>

                  {/* Actions: approve leads (ember), then request-changes, then reject */}
                  <div
                    className="admin-row-actions"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--sp-2)',
                      marginInlineStart: 'auto',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isBusy}
                      onClick={() => setPending({ item, action: 'approve' })}
                    >
                      <CheckCircle size={14} aria-hidden="true" />
                      {a.table.approve}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={isBusy}
                      onClick={() => setPending({ item, action: 'request_changes' })}
                    >
                      <MessageSquare size={14} aria-hidden="true" />
                      {a.approvals.requestChanges}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={isBusy}
                      onClick={() => setPending({ item, action: 'reject' })}
                      style={{ color: 'var(--danger)' }}
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
        title={pendingCopy?.title}
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
