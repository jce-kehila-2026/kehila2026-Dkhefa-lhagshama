// AdminDirectoryPage — /admin/directory CRUD console for the two community
// catalogs: `answers` (partner orgs: עמותות + שותפים) and `businesses`. Unlike
// the approvals queue it lists rows of EVERY status, and lets admins create /
// edit / delete on top of the /api/admin/directory/:catalog REST routes.
// Used by the admin staff only (AdminLayout gates access). Key collaborators:
// useCategories (live answer-category taxonomy, shared with /directory + the
// request form), t.admin.directoryMgmt (bilingual strings), apiClient.apiJson.
// Invariants worth knowing: answer fields are bilingual ({he,en}); business
// fields are flat strings stored identically in both langs by the backend;
// status is only editable when editing an existing row (create defaults to
// 'approved'); client-side validators here mirror the backend zod rules so
// admins see precise inline errors instead of a generic 400 toast.
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Building2, Store, Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useApp } from '@/contexts/AppContext'
import { useCategories } from '@/hooks/useCategories'
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
import styles from './AdminDirectoryPage.module.css'
import { pickLang as pickShared, pickLangArray as pickArrShared } from '@/lib/bilingual'

// The two directory catalogs managed here. 'answers' = partner organizations
// (עמותות + שותפים), 'businesses' = community businesses. Matches the
// /api/admin/directory/:catalog route segments exactly.
type Catalog = 'answers' | 'businesses'

const CATALOGS: Catalog[] = ['answers', 'businesses']

const STATUSES = ['pending', 'approved', 'rejected', 'needs_changes'] as const

// Bilingual field as returned by the API: `{ he, en }` or a plain string.
type Bilingual = string | { he?: string; en?: string } | null | undefined

// One partner-org row as returned by GET /api/admin/directory/answers.
interface AnswerRow {
  id: string
  title: Bilingual
  body: Bilingual
  category: string | null
  region: Bilingual
  audience: Bilingual
  sourceName: string | null
  sourceUrl: string | null
  phone: string | null
  email: string | null
  orgType: OrgType
  status: string | null
  createdAt: string | null
}

// One community-business row as returned by GET /api/admin/directory/businesses.
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
const L = (v: Bilingual, lang: Lang): string => pickShared(v, lang)

// `tags` arrives as `{ he: string[], en: string[] }`; admin edits overwrite
// both languages, so prefill from the active language (he fallback).
const tagsOf = (v: BusinessRow['tags'], lang: Lang): string[] => pickArrShared(v, lang)

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

// Mirrors the backend z.string().email() guard on answer.email so an admin
// gets an inline message instead of a generic 400 toast. Empty = no email.
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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

  // Answer categories come from the live admin-managed taxonomy — the same
  // source as the /directory filter chips and the request-form tiles — so a
  // category added in /admin/categories is immediately assignable here (and
  // its chip / suggestions can actually be populated). Business categories
  // stay the static enum, matching the backend zod enum.
  const { categories: liveCategories, labelFor } = useCategories()
  const answerCats = liveCategories.map((c) => c.id)
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
  // Contact fields (NPO org import) — the public org card renders these as
  // Call / Send-email actions, so the admin form must be able to set/edit them.
  const [answerPhone, setAnswerPhone] = useState(answer?.phone ?? '')
  const [answerEmail, setAnswerEmail] = useState(answer?.email ?? '')

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

  // The live taxonomy may still be loading when the dialog mounts — backfill
  // the default answer category once it arrives (create flow only).
  useEffect(() => {
    if (isAnswers && !category && answerCats.length > 0) setCategory(answerCats[0])
  }, [isAnswers, category, answerCats])

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
      const emailTrim = answerEmail.trim()
      if (emailTrim && !isValidEmail(emailTrim)) {
        setFormError(dm.invalidEmail)
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
        // Empty string clears the value (backend treats '' as "clear").
        phone: answerPhone.trim(),
        email: emailTrim,
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
    <div className={`field ${styles.field}`}>
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
            <div className={`admin-dir-bi-grid ${styles.gridGap}`}>
              {field('dir-title-he', dm.fieldTitleHe, titleHe, setTitleHe)}
              {field('dir-title-en', dm.fieldTitleEn, titleEn, setTitleEn)}
            </div>
            <div className={`admin-dir-bi-grid ${styles.gridGap}`}>
              {field('dir-body-he', dm.fieldBodyHe, bodyHe, setBodyHe, { textarea: true })}
              {field('dir-body-en', dm.fieldBodyEn, bodyEn, setBodyEn, { textarea: true })}
            </div>
            <div className={`admin-task-grid ${styles.gridGap}`}>
              <div className={`field ${styles.field}`}>
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
              <div className={`field ${styles.field}`}>
                <label className="form-label" htmlFor="dir-category">{dm.fieldCategory}</label>
                <select
                  id="dir-category"
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={busy}
                >
                  {answerCats.map((k) => (
                    <option key={k} value={k}>{labelFor(k)}</option>
                  ))}
                </select>
              </div>
              {item && (
                <div className={`field ${styles.field}`}>
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
            <div className={`admin-dir-bi-grid ${styles.gridGap}`}>
              {field('dir-region-he', dm.fieldRegionHe, regionHe, setRegionHe)}
              {field('dir-region-en', dm.fieldRegionEn, regionEn, setRegionEn)}
            </div>
            <div className={`admin-dir-bi-grid ${styles.gridGap}`}>
              {field('dir-audience-he', dm.fieldAudienceHe, audienceHe, setAudienceHe)}
              {field('dir-audience-en', dm.fieldAudienceEn, audienceEn, setAudienceEn)}
            </div>
            <div className={`admin-dir-bi-grid ${styles.gridGap}`}>
              {field('dir-source-name', dm.fieldSourceName, sourceName, setSourceName)}
              {field('dir-source-url', dm.fieldSourceUrl, sourceUrl, setSourceUrl, { type: 'url', placeholder: 'https://example.org' })}
            </div>
            <div className={`admin-dir-bi-grid ${styles.gridGap}`}>
              {field('dir-answer-phone', dm.fieldAnswerPhone, answerPhone, setAnswerPhone, { type: 'tel' })}
              {field('dir-answer-email', dm.fieldAnswerEmail, answerEmail, setAnswerEmail, { type: 'email', placeholder: 'name@example.org' })}
            </div>
          </>
        ) : (
          <>
            <div className={`admin-dir-bi-grid ${styles.gridGap}`}>
              {field('dir-biz-name', dm.fieldName, name, setName)}
              {field('dir-biz-owner', dm.fieldOwnerName, ownerName, setOwnerName)}
            </div>
            <div className={`admin-task-grid ${styles.gridGap}`}>
              {field('dir-biz-phone', dm.fieldPhone, phone, setPhone, { type: 'tel' })}
              <div className={`field ${styles.field}`}>
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
                <div className={`field ${styles.field}`}>
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
            <div className={`field ${styles.descField}`}>
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
            <div className={`admin-dir-bi-grid ${styles.gridGap}`}>
              {field('dir-biz-website', dm.fieldWebsite, website, setWebsite, { type: 'url', placeholder: 'https://example.com' })}
              {field('dir-biz-tags', dm.fieldTags, tagsText, setTagsText)}
            </div>
          </>
        )}

        {formError && (
          <p
            role="alert"
            className={styles.formError}
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
  // Bilingual answer-category labels from the live taxonomy (legacy keys fall
  // back to the static t-maps inside labelFor, then the raw id).
  const { labelFor } = useCategories()
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
  const [query, setQuery] = useState('') // WS-9 bilingual client-side search

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

  // Persist the dialog: PATCH when editing an existing row, POST to create.
  // On success closes the dialog and re-fetches both catalogs.
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

  // Hard-delete the confirmed row via DELETE, then re-fetch.
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

  const q = query.trim().toLowerCase()
  const baseRows: DirectoryRow[] = tab === 'answers' ? answers : businesses
  // Active-tab rows after the bilingual client-side search (title/name +
  // resolved category label + source/owner). Empty query returns all rows.
  const rows: DirectoryRow[] = useMemo(() => {
    if (!q) return baseRows
    return baseRows.filter((row) => {
      if (tab === 'answers') {
        const r = row as AnswerRow
        const title = L(r.title, lang).toLowerCase()
        const cat = (r.category ? labelFor(r.category) : '').toLowerCase()
        const source = String(r.sourceName || '').toLowerCase()
        return title.includes(q) || cat.includes(q) || source.includes(q)
      }
      const r = row as BusinessRow
      const name = L(r.name, lang).toLowerCase()
      const cat = ((dir.categories as Record<string, string>)[r.category || ''] || r.category || '').toLowerCase()
      const source = String(r.ownerName || '').toLowerCase()
      return name.includes(q) || cat.includes(q) || source.includes(q)
    })
  }, [baseRows, q, tab, lang, labelFor, dir.categories])

  const deleteName = confirmDelete
    ? (confirmDelete.catalog === 'answers'
        ? L((confirmDelete.item as AnswerRow).title, lang)
        : L((confirmDelete.item as BusinessRow).name, lang)) || confirmDelete.item.id
    : ''

  return (
    <AdminLayout title={dm.title} subtitle={dm.subtitle}>
      {/* ── Toolbar: catalog tabs + the "new entry" primary action ─────── */}
      <div className={styles.toolbar}>
        <div className={`admin-filters ${styles.filtersFlush}`} role="group" aria-label={dm.title}>
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
          className={`btn btn-primary ${styles.newBtn}`}
          onClick={() => setDialog({ catalog: tab, item: null })}
        >
          <Plus size={16} aria-hidden="true" />
          {tab === 'answers' ? dm.newAnswer : dm.newBusiness}
        </button>
      </div>

      <div className="admin-search">
        <Search size={16} aria-hidden="true" className="admin-search-icon" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dm.searchPlaceholder}
          aria-label={dm.searchPlaceholder}
          className="form-input admin-search-input"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {query && (
          <button
            type="button"
            className="admin-search-clear"
            aria-label={t.common.cancel}
            onClick={() => setQuery('')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={tab === 'answers' ? 6 : 5} />
      ) : !error && rows.length === 0 ? (
        <EmptyState
          icon={q ? Search : tab === 'answers' ? Building2 : Store}
          title={q ? dm.noMatches : tab === 'answers' ? dm.emptyAnswers : dm.emptyBusinesses}
        />
      ) : !error ? (
        <Reveal>
          <div className={`card ${styles.tableCard}`}>
            <div className={`admin-table-wrap ${styles.tableWrapFlush}`}>
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
                    ? (rows as AnswerRow[]).map((row) => {
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
                              {row.category ? labelFor(row.category) : ''}
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
                    : (rows as BusinessRow[]).map((row) => {
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
