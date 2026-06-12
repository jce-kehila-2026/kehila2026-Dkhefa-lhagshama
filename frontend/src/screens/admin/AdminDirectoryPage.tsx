import { useEffect, useState, useCallback } from 'react'
import { Building2, Store, Plus, Pencil, Trash2 } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useApp } from '@/contexts/AppContext'
import { apiJson } from '@/lib/apiClient'
import AdminLayout from '@/components/admin/AdminLayout'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import Reveal from '../../components/motion/Reveal'
import {
  StatusBadge,
  EmptyState,
  ErrorState,
  TableSkeleton,
  adminErrorMessage,
} from '@/components/admin/AdminUI'
import type { Lang, OrgType } from '@/types'

// The two directory catalogs managed here. 'answers' = partner organizations
// (עמותות + שותפים), 'businesses' = community businesses. Matches the
// /api/admin/directory/:catalog route segments exactly.
type Catalog = 'answers' | 'businesses'

const CATALOGS: Catalog[] = ['answers', 'businesses']

const STATUSES = ['pending', 'approved', 'rejected', 'needs_changes'] as const

// Bilingual field as returned by the API: `{ he, en }` or a plain string.
type Bilingual = string | { he?: string; en?: string } | null | undefined

interface AnswerRow {
  id: string
  title: Bilingual
  body: Bilingual
  category: string | null
  region: Bilingual
  audience: Bilingual
  sourceName: string | null
  sourceUrl: string | null
  orgType: OrgType
  status: string | null
  createdAt: string | null
}

interface BusinessRow {
  id: string
  name: Bilingual
  ownerName: string | null
  phone: string | null
  category: string | null
  city: Bilingual
  description: Bilingual
  website: string | null
  tags: { he?: string[]; en?: string[] } | string[] | null
  status: string | null
  createdAt: string | null
}

type DirectoryRow = AnswerRow | BusinessRow

// Render a bilingual field in the active language (he fallback).
const L = (v: Bilingual, lang: Lang): string => {
  if (v && typeof v === 'object') return v[lang] ?? v.he ?? ''
  return v ?? ''
}

// `tags` arrives as `{ he: string[], en: string[] }`; admin edits overwrite
// both languages, so prefill from the active language (he fallback).
const tagsOf = (v: BusinessRow['tags'], lang: Lang): string[] => {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    const arr = v[lang] ?? v.he
    return Array.isArray(arr) ? arr : []
  }
  return []
}

// Mirrors the backend http(s)-only URL rule so admins get a precise message
// instead of a generic 400 (zod's .url() + scheme refine in adminDirectory.ts).
function isValidHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

// Distinct chip tone per org type (shape + label carry the meaning too).
const ORG_TYPE_TONE: Record<OrgType, string> = {
  ngo: 'badge-blue',
  partner: 'badge-amber',
}

interface FormDialogProps {
  catalog: Catalog
  /** Row being edited, or null to create a new entry. */
  item: DirectoryRow | null
  busy: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => void
}

/**
 * Create/Edit panel for one directory entry, following the CreateTaskDialog
 * dialog pattern (confirm-overlay + confirm-box). Answers carry bilingual
 * fields side by side (HE / EN); businesses mirror the public submit schema
 * (flat strings, stored identically in both languages by the backend).
 */
function DirectoryFormDialog({ catalog, item, busy, onClose, onSubmit }: FormDialogProps) {
  const { t, lang } = useLanguage()
  const dm = t.admin.directoryMgmt
  const dir = t.directory

  const isAnswers = catalog === 'answers'
  const answer = isAnswers ? (item as AnswerRow | null) : null
  const business = !isAnswers ? (item as BusinessRow | null) : null

  // Category taxonomies reuse the live public-directory keys so the admin
  // catalog can never drift from what the /directory filters understand.
  const answerCats = Object.keys(dir.ngoAreas as Record<string, string>).filter((k) => k !== 'all')
  const businessCats = Object.keys(dir.categories as Record<string, string>)

  // ── Answer fields ──────────────────────────────────────────────
  const [titleHe, setTitleHe] = useState(answer?.title && typeof answer.title === 'object' ? answer.title.he ?? '' : (answer?.title as string) ?? '')
  const [titleEn, setTitleEn] = useState(answer?.title && typeof answer.title === 'object' ? answer.title.en ?? '' : '')
  const [bodyHe, setBodyHe] = useState(answer?.body && typeof answer.body === 'object' ? answer.body.he ?? '' : (answer?.body as string) ?? '')
  const [bodyEn, setBodyEn] = useState(answer?.body && typeof answer.body === 'object' ? answer.body.en ?? '' : '')
  const [regionHe, setRegionHe] = useState(answer?.region && typeof answer.region === 'object' ? answer.region.he ?? '' : (answer?.region as string) ?? '')
  const [regionEn, setRegionEn] = useState(answer?.region && typeof answer.region === 'object' ? answer.region.en ?? '' : '')
  const [audienceHe, setAudienceHe] = useState(answer?.audience && typeof answer.audience === 'object' ? answer.audience.he ?? '' : (answer?.audience as string) ?? '')
  const [audienceEn, setAudienceEn] = useState(answer?.audience && typeof answer.audience === 'object' ? answer.audience.en ?? '' : '')
  const [orgType, setOrgType] = useState<OrgType>(answer?.orgType ?? 'ngo')
  const [sourceName, setSourceName] = useState(answer?.sourceName ?? '')
  const [sourceUrl, setSourceUrl] = useState(answer?.sourceUrl ?? '')

  // ── Business fields ────────────────────────────────────────────
  const [name, setName] = useState(L(business?.name, lang))
  const [ownerName, setOwnerName] = useState(business?.ownerName ?? '')
  const [phone, setPhone] = useState(business?.phone ?? '')
  const [city, setCity] = useState(L(business?.city, lang))
  const [description, setDescription] = useState(L(business?.description, lang))
  const [website, setWebsite] = useState(business?.website ?? '')
  const [tagsText, setTagsText] = useState(tagsOf(business?.tags ?? null, lang).join(', '))

  // ── Shared fields ──────────────────────────────────────────────
  const [category, setCategory] = useState(item?.category ?? (isAnswers ? answerCats[0] : businessCats[0]) ?? '')
  const [status, setStatus] = useState(item?.status ?? 'approved')
  const [formError, setFormError] = useState<string | null>(null)

  const dialogTitle = isAnswers
    ? (item ? dm.editAnswerTitle : dm.createAnswerTitle)
    : (item ? dm.editBusinessTitle : dm.createBusinessTitle)

  const submit = () => {
    setFormError(null)

    if (isAnswers) {
      if (!titleHe.trim() || !titleEn.trim() || !category) {
        setFormError(dm.validationAnswer)
        return
      }
      const url = sourceUrl.trim()
      if (url && !isValidHttpUrl(url)) {
        setFormError(dm.invalidUrl)
        return
      }
      const payload: Record<string, unknown> = {
        title: { he: titleHe.trim(), en: titleEn.trim() },
        body: { he: bodyHe.trim(), en: bodyEn.trim() },
        category,
        orgType,
        region: { he: regionHe.trim(), en: regionEn.trim() },
        audience: { he: audienceHe.trim(), en: audienceEn.trim() },
        sourceName: sourceName.trim(),
        sourceUrl: url,
      }
      if (item) payload.status = status
      onSubmit(payload)
      return
    }

    if (!name.trim() || !ownerName.trim() || !phone.trim() || !city.trim() || description.trim().length < 10) {
      setFormError(dm.validationBusiness)
      return
    }
    const site = website.trim()
    if (site && !isValidHttpUrl(site)) {
      setFormError(dm.invalidUrl)
      return
    }
    const payload: Record<string, unknown> = {
      name: name.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      category,
      city: city.trim(),
      description: description.trim(),
      website: site,
      tags: tagsText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12),
    }
    if (item) payload.status = status
    onSubmit(payload)
  }

  // Escape closes the dialog (standard dialog keyboard affordance).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { textarea?: boolean; type?: string; placeholder?: string } = {},
  ) => (
    <div className="field" style={{ textAlign: 'start' }}>
      <label className="form-label" htmlFor={id}>{label}</label>
      {opts.textarea ? (
        <textarea
          id={id}
          className="form-textarea"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
        />
      ) : (
        <input
          id={id}
          className="form-input"
          type={opts.type || 'text'}
          placeholder={opts.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
        />
      )}
    </div>
  )

  return (
    <div
      className="confirm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="confirm-box admin-dir-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dir-form-title"
      >
        <span className="confirm-icon confirm-icon--default" aria-hidden="true">
          {isAnswers ? <Building2 size={22} /> : <Store size={22} />}
        </span>
        <h2 id="dir-form-title" className="confirm-title">{dialogTitle}</h2>

        {isAnswers ? (
          <>
            {/* Bilingual pairs sit side by side, labeled HE / EN. */}
            <div className="admin-dir-bi-grid" style={{ marginBlockStart: 'var(--sp-3)' }}>
              {field('dir-title-he', dm.fieldTitleHe, titleHe, setTitleHe)}
              {field('dir-title-en', dm.fieldTitleEn, titleEn, setTitleEn)}
            </div>
            <div className="admin-dir-bi-grid" style={{ marginBlockStart: 'var(--sp-3)' }}>
              {field('dir-body-he', dm.fieldBodyHe, bodyHe, setBodyHe, { textarea: true })}
              {field('dir-body-en', dm.fieldBodyEn, bodyEn, setBodyEn, { textarea: true })}
            </div>
            <div className="admin-task-grid" style={{ marginBlockStart: 'var(--sp-3)' }}>
              <div className="field" style={{ textAlign: 'start' }}>
                <label className="form-label" htmlFor="dir-org-type">{dm.fieldOrgType}</label>
                <select
                  id="dir-org-type"
                  className="form-select"
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value as OrgType)}
                  disabled={busy}
                >
                  {(['ngo', 'partner'] as OrgType[]).map((k) => (
                    <option key={k} value={k}>{dm.orgTypeLabels[k]}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ textAlign: 'start' }}>
                <label className="form-label" htmlFor="dir-category">{dm.fieldCategory}</label>
                <select
                  id="dir-category"
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={busy}
                >
                  {answerCats.map((k) => (
                    <option key={k} value={k}>{(dir.ngoAreas as Record<string, string>)[k] || k}</option>
                  ))}
                </select>
              </div>
              {item && (
                <div className="field" style={{ textAlign: 'start' }}>
                  <label className="form-label" htmlFor="dir-status">{dm.fieldStatus}</label>
                  <select
                    id="dir-status"
                    className="form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={busy}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{dm.statusLabels[s]}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="admin-dir-bi-grid" style={{ marginBlockStart: 'var(--sp-3)' }}>
              {field('dir-region-he', dm.fieldRegionHe, regionHe, setRegionHe)}
              {field('dir-region-en', dm.fieldRegionEn, regionEn, setRegionEn)}
            </div>
            <div className="admin-dir-bi-grid" style={{ marginBlockStart: 'var(--sp-3)' }}>
              {field('dir-audience-he', dm.fieldAudienceHe, audienceHe, setAudienceHe)}
              {field('dir-audience-en', dm.fieldAudienceEn, audienceEn, setAudienceEn)}
            </div>
            <div className="admin-dir-bi-grid" style={{ marginBlockStart: 'var(--sp-3)' }}>
              {field('dir-source-name', dm.fieldSourceName, sourceName, setSourceName)}
              {field('dir-source-url', dm.fieldSourceUrl, sourceUrl, setSourceUrl, { type: 'url', placeholder: 'https://example.org' })}
            </div>
          </>
        ) : (
          <>
            <div className="admin-dir-bi-grid" style={{ marginBlockStart: 'var(--sp-3)' }}>
              {field('dir-biz-name', dm.fieldName, name, setName)}
              {field('dir-biz-owner', dm.fieldOwnerName, ownerName, setOwnerName)}
            </div>
            <div className="admin-task-grid" style={{ marginBlockStart: 'var(--sp-3)' }}>
              {field('dir-biz-phone', dm.fieldPhone, phone, setPhone, { type: 'tel' })}
              <div className="field" style={{ textAlign: 'start' }}>
                <label className="form-label" htmlFor="dir-biz-category">{dm.fieldCategory}</label>
                <select
                  id="dir-biz-category"
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={busy}
                >
                  {businessCats.map((k) => (
                    <option key={k} value={k}>{(dir.categories as Record<string, string>)[k] || k}</option>
                  ))}
                </select>
              </div>
              {field('dir-biz-city', dm.fieldCity, city, setCity)}
              {item && (
                <div className="field" style={{ textAlign: 'start' }}>
                  <label className="form-label" htmlFor="dir-biz-status">{dm.fieldStatus}</label>
                  <select
                    id="dir-biz-status"
                    className="form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={busy}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{dm.statusLabels[s]}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="field" style={{ textAlign: 'start', marginBlockStart: 'var(--sp-3)' }}>
              <label className="form-label" htmlFor="dir-biz-desc">{dm.fieldDescription}</label>
              <textarea
                id="dir-biz-desc"
                className="form-textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="admin-dir-bi-grid" style={{ marginBlockStart: 'var(--sp-3)' }}>
              {field('dir-biz-website', dm.fieldWebsite, website, setWebsite, { type: 'url', placeholder: 'https://example.com' })}
              {field('dir-biz-tags', dm.fieldTags, tagsText, setTagsText)}
            </div>
          </>
        )}

        {formError && (
          <p
            role="alert"
            style={{ margin: 'var(--sp-3) 0 0', color: 'var(--danger)', fontSize: 'var(--fs-sm)', textAlign: 'start' }}
          >
            {formError}
          </p>
        )}

        <div className="confirm-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className={`btn btn-primary${busy ? ' is-loading' : ''}`}
            onClick={submit}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? dm.saving : dm.save}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Admin directory management (/admin/directory). Lists ALL answers and
 * businesses regardless of status (unlike the approvals queue, which only
 * shows pending items) and offers create / edit / delete on top of the
 * /api/admin/directory CRUD routes.
 */
export default function AdminDirectoryPage() {
  const { t, lang } = useLanguage()
  const a = t.admin
  const dm = a.directoryMgmt
  const dir = t.directory
  const { toast } = useApp()

  const [tab, setTab] = useState<Catalog>('answers')
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Open create/edit dialog: which catalog + the row (null = create).
  const [dialog, setDialog] = useState<{ catalog: Catalog; item: DirectoryRow | null } | null>(null)
  // Row pending delete confirmation.
  const [confirmDelete, setConfirmDelete] = useState<{ catalog: Catalog; item: DirectoryRow } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ans, biz] = await Promise.all([
        apiJson<{ items?: AnswerRow[] }>('/api/admin/directory/answers'),
        apiJson<{ items?: BusinessRow[] }>('/api/admin/directory/businesses'),
      ])
      setAnswers(ans.items || [])
      setBusinesses(biz.items || [])
    } catch (err) {
      setError(adminErrorMessage(err as { status?: number } | null, lang))
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => {
    load()
  }, [load])

  const fmtDate = (iso: string | null): string => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')
  }

  const saveDialog = async (payload: Record<string, unknown>) => {
    if (!dialog) return
    setBusy(true)
    try {
      if (dialog.item) {
        await apiJson(`/api/admin/directory/${dialog.catalog}/${dialog.item.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast(dm.updateSuccess, 'success')
      } else {
        await apiJson(`/api/admin/directory/${dialog.catalog}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast(dm.createSuccess, 'success')
      }
      setDialog(null)
      await load()
    } catch {
      toast(dm.actionError, 'error')
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    setBusy(true)
    try {
      await apiJson(`/api/admin/directory/${confirmDelete.catalog}/${confirmDelete.item.id}`, {
        method: 'DELETE',
      })
      toast(dm.deleteSuccess, 'success')
      setConfirmDelete(null)
      await load()
    } catch {
      toast(dm.actionError, 'error')
    } finally {
      setBusy(false)
    }
  }

  const tabLabels: Record<Catalog, string> = {
    answers: dm.tabAnswers,
    businesses: dm.tabBusinesses,
  }
  const counts: Record<Catalog, number> = {
    answers: answers.length,
    businesses: businesses.length,
  }

  const rows: DirectoryRow[] = tab === 'answers' ? answers : businesses
  const deleteName = confirmDelete
    ? (confirmDelete.catalog === 'answers'
        ? L((confirmDelete.item as AnswerRow).title, lang)
        : L((confirmDelete.item as BusinessRow).name, lang)) || confirmDelete.item.id
    : ''

  return (
    <AdminLayout title={dm.title} subtitle={dm.subtitle}>
      {/* ── Toolbar: catalog tabs + the "new entry" primary action ─────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--sp-3)',
          marginBlockEnd: 'var(--sp-5)',
        }}
      >
        <div className="admin-filters" role="group" aria-label={dm.title} style={{ marginBlockEnd: 0 }}>
          {CATALOGS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={tab === c}
              className={`admin-filter-tab${tab === c ? ' is-active' : ''}`}
              onClick={() => setTab(c)}
            >
              {tabLabels[c]}
              {!loading && !error ? <span className="admin-approval-tab-count">{` (${counts[c]})`}</span> : ''}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setDialog({ catalog: tab, item: null })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} aria-hidden="true" />
          {tab === 'answers' ? dm.newAnswer : dm.newBusiness}
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={tab === 'answers' ? 6 : 5} />
      ) : !error && rows.length === 0 ? (
        <EmptyState
          icon={tab === 'answers' ? Building2 : Store}
          title={tab === 'answers' ? dm.emptyAnswers : dm.emptyBusinesses}
        />
      ) : !error ? (
        <Reveal>
          <div
            className="card"
            style={{
              padding: 0,
              overflow: 'hidden',
              border: '1px solid var(--hair)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="admin-table-wrap" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>{dm.colTitle}</th>
                    {tab === 'answers' && <th>{dm.colOrgType}</th>}
                    <th>{dm.colCategory}</th>
                    <th>{dm.colStatus}</th>
                    <th>{dm.colCreated}</th>
                    <th className="admin-table-actions-col">{a.ui.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {tab === 'answers'
                    ? answers.map((row) => {
                        const title = L(row.title, lang) || row.id
                        return (
                          <tr key={row.id}>
                            <td data-label={dm.colTitle}>
                              <span className="admin-user-identity">
                                <span className="admin-user-name">{title}</span>
                                {row.sourceName && <span className="admin-user-sub">{row.sourceName}</span>}
                              </span>
                            </td>
                            <td data-label={dm.colOrgType}>
                              <span className={`badge ${ORG_TYPE_TONE[row.orgType] || 'badge-gray'}`}>
                                <span className="badge-dot" aria-hidden="true" />
                                {dm.orgTypeLabels[row.orgType] || row.orgType}
                              </span>
                            </td>
                            <td data-label={dm.colCategory}>
                              {(dir.ngoAreas as Record<string, string>)[row.category || ''] || row.category || ''}
                            </td>
                            <td data-label={dm.colStatus}>
                              <StatusBadge
                                status={row.status || 'pending'}
                                label={(dm.statusLabels as Record<string, string>)[row.status || ''] || row.status || ''}
                              />
                            </td>
                            <td data-label={dm.colCreated}>{fmtDate(row.createdAt)}</td>
                            <td data-label={a.ui.actions}>
                              <div className="admin-row-actions">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  aria-label={`${a.table.edit}: ${title}`}
                                  onClick={() => setDialog({ catalog: 'answers', item: row })}
                                >
                                  <Pencil size={14} aria-hidden="true" />
                                  {a.table.edit}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm admin-dir-delete"
                                  aria-label={`${a.table.delete}: ${title}`}
                                  onClick={() => setConfirmDelete({ catalog: 'answers', item: row })}
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                  {a.table.delete}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    : businesses.map((row) => {
                        const name = L(row.name, lang) || row.id
                        return (
                          <tr key={row.id}>
                            <td data-label={dm.colTitle}>
                              <span className="admin-user-identity">
                                <span className="admin-user-name">{name}</span>
                                {row.ownerName && <span className="admin-user-sub">{row.ownerName}</span>}
                              </span>
                            </td>
                            <td data-label={dm.colCategory}>
                              {(dir.categories as Record<string, string>)[row.category || ''] || row.category || ''}
                            </td>
                            <td data-label={dm.colStatus}>
                              <StatusBadge
                                status={row.status || 'pending'}
                                label={(dm.statusLabels as Record<string, string>)[row.status || ''] || row.status || ''}
                              />
                            </td>
                            <td data-label={dm.colCreated}>{fmtDate(row.createdAt)}</td>
                            <td data-label={a.ui.actions}>
                              <div className="admin-row-actions">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  aria-label={`${a.table.edit}: ${name}`}
                                  onClick={() => setDialog({ catalog: 'businesses', item: row })}
                                >
                                  <Pencil size={14} aria-hidden="true" />
                                  {a.table.edit}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm admin-dir-delete"
                                  aria-label={`${a.table.delete}: ${name}`}
                                  onClick={() => setConfirmDelete({ catalog: 'businesses', item: row })}
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                  {a.table.delete}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      ) : null}

      {/* Create / edit panel — keyed so the form state resets per open. */}
      {dialog && (
        <DirectoryFormDialog
          key={`${dialog.catalog}-${dialog.item?.id ?? 'new'}`}
          catalog={dialog.catalog}
          item={dialog.item}
          busy={busy}
          onClose={() => { if (!busy) setDialog(null) }}
          onSubmit={saveDialog}
        />
      )}

      {/* Hard delete sits behind a danger confirm (approvals pattern). */}
      <ConfirmDialog
        open={!!confirmDelete}
        variant="danger"
        title={confirmDelete?.catalog === 'businesses' ? dm.deleteBusinessTitle : dm.deleteAnswerTitle}
        message={deleteName ? `${deleteName}: ${dm.deleteBody}` : dm.deleteBody}
        confirmLabel={a.table.delete}
        cancelLabel={t.common.cancel}
        busy={busy && !!confirmDelete}
        onConfirm={doDelete}
        onCancel={() => { if (!busy) setConfirmDelete(null) }}
      />
    </AdminLayout>
  )
}
