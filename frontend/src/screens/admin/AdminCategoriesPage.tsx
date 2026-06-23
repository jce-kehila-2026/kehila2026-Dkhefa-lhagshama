/**
 * AdminCategoriesPage — admin CRUD screen for the shared category taxonomy
 * (route /admin/categories). This one list governs the request form, admin
 * triage, volunteer permissions, directory NGO-area filters and both insights
 * charts, so edits here ripple across the whole app via the public categories
 * cache (refreshed on every mutation through refreshCategories()).
 *
 * Behaviour to know: the id is a slug derived server-side from nameEn; archive
 * is the safe removal path (old requests keep resolving), while hard delete is
 * backend-gated (409 category_in_use when anything still references the id).
 * Collaborates with apiJson (Express /api/admin/categories), AdminLayout/AdminUI
 * for chrome, and CategoryFormDialog (below) for create/edit.
 */
import { useEffect, useState, useCallback } from 'react'
import { Tags, Plus, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useApp } from '@/contexts/AppContext'
import { apiJson } from '@/lib/apiClient'
import { refreshCategories } from '@/hooks/useCategories'
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
import styles from './AdminCategoriesPage.module.css'

// A category row as returned by GET /api/admin/categories (archived included,
// unlike the public /api/categories read the pickers use).
interface CategoryRow {
  id: string
  nameHe: string
  nameEn: string
  archived: boolean
}

interface FormDialogProps {
  /** Row being edited, or null to create a new category. */
  item: CategoryRow | null
  busy: boolean
  onClose: () => void
  onSubmit: (payload: { nameHe: string; nameEn: string }) => void
}

/**
 * Create/Edit panel for one category, following the DirectoryFormDialog
 * pattern (confirm-overlay + confirm-box, HE / EN inputs side by side).
 * Both names are required — labels live ON the doc, never in translations.ts.
 */
function CategoryFormDialog({ item, busy, onClose, onSubmit }: FormDialogProps) {
  const { t } = useLanguage()
  const cm = t.admin.categoriesMgmt

  const [nameHe, setNameHe] = useState(item?.nameHe ?? '')
  const [nameEn, setNameEn] = useState(item?.nameEn ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = () => {
    setFormError(null)
    if (!nameHe.trim() || !nameEn.trim()) {
      setFormError(cm.validation)
      return
    }
    onSubmit({ nameHe: nameHe.trim(), nameEn: nameEn.trim() })
  }

  // Escape closes the dialog (standard dialog keyboard affordance).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

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
        aria-labelledby="cat-form-title"
      >
        <span className="confirm-icon confirm-icon--default" aria-hidden="true">
          <Tags size={22} />
        </span>
        <h2 id="cat-form-title" className="confirm-title">
          {item ? cm.editTitle : cm.createTitle}
        </h2>

        <div className={`admin-dir-bi-grid ${styles.dialogGrid}`}>
          <div className={`field ${styles.field}`}>
            <label className="form-label" htmlFor="cat-name-he">{cm.fieldNameHe}</label>
            <input
              id="cat-name-he"
              className="form-input"
              value={nameHe}
              onChange={(e) => setNameHe(e.target.value)}
              disabled={busy}
              maxLength={80}
            />
          </div>
          <div className={`field ${styles.field}`}>
            <label className="form-label" htmlFor="cat-name-en">{cm.fieldNameEn}</label>
            <input
              id="cat-name-en"
              className="form-input"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              disabled={busy}
              maxLength={80}
            />
          </div>
        </div>

        {formError && (
          <p role="alert" className={styles.formError}>
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
            {busy ? cm.saving : cm.save}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Admin category management (/admin/categories, feedback round 2). One shared
 * taxonomy for the request form, admin tasks, volunteer permissions, the
 * directory NGO-area filters and both insights charts. Archive is the safe
 * removal path (labels stay resolvable for old requests); hard delete is only
 * allowed while nothing references the id — the backend answers 409
 * `category_in_use` otherwise, surfaced here as a clear bilingual message.
 */
export default function AdminCategoriesPage() {
  const { t, lang } = useLanguage()
  const a = t.admin
  const cm = a.categoriesMgmt
  const { toast } = useApp()

  const [items, setItems] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Open create/edit dialog: the row being edited (null item = create).
  const [dialog, setDialog] = useState<{ item: CategoryRow | null } | null>(null)
  // Row pending delete confirmation.
  const [confirmDelete, setConfirmDelete] = useState<CategoryRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiJson<{ items?: CategoryRow[] }>('/api/admin/categories')
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

  // Every successful mutation re-reads the admin list AND drops the shared
  // public cache (useCategories) so pickers across the app pick up the change.
  const reloadAll = async () => {
    await Promise.all([load(), refreshCategories()])
  }

  const saveDialog = async (payload: { nameHe: string; nameEn: string }) => {
    if (!dialog) return
    setBusy(true)
    try {
      if (dialog.item) {
        await apiJson(`/api/admin/categories/${encodeURIComponent(dialog.item.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toast(cm.updateSuccess, 'success')
      } else {
        await apiJson('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast(cm.createSuccess, 'success')
      }
      setDialog(null)
      await reloadAll()
    } catch (err) {
      const e = err as { status?: number; detail?: { error?: string; details?: { id?: string } } }
      if (e.status === 409) {
        // POST id collision — the slug derived from nameEn is already taken.
        toast(cm.existsError, 'error')
      } else if (e.status === 400 && e.detail?.details?.id) {
        // nameEn had no Latin characters, so no slug could be derived.
        toast(cm.slugError, 'error')
      } else {
        toast(cm.actionError, 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  const toggleArchive = async (row: CategoryRow) => {
    if (busy) return
    setBusy(true)
    try {
      await apiJson(`/api/admin/categories/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: !row.archived }),
      })
      toast(row.archived ? cm.restoreSuccess : cm.archiveSuccess, 'success')
      await reloadAll()
    } catch {
      toast(cm.actionError, 'error')
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    setBusy(true)
    try {
      await apiJson(`/api/admin/categories/${encodeURIComponent(confirmDelete.id)}`, {
        method: 'DELETE',
      })
      toast(cm.deleteSuccess, 'success')
      setConfirmDelete(null)
      await reloadAll()
    } catch (err) {
      const e = err as { status?: number }
      if (e.status === 409) {
        // category_in_use — historical requests/answers still reference it.
        toast(cm.inUseError, 'error')
        setConfirmDelete(null)
      } else {
        toast(cm.actionError, 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  const deleteName = confirmDelete
    ? (lang === 'he' ? confirmDelete.nameHe : confirmDelete.nameEn) || confirmDelete.id
    : ''

  return (
    <AdminLayout title={cm.title} subtitle={cm.subtitle}>
      {/* ── Toolbar: the "new category" primary action ─────────────────── */}
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`btn btn-primary ${styles.newBtn}`}
          onClick={() => setDialog({ item: null })}
        >
          <Plus size={16} aria-hidden="true" />
          {cm.newCategory}
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={load} retryLabel={a.ui.retry} />}

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : !error && items.length === 0 ? (
        <EmptyState icon={Tags} title={cm.empty} message={cm.emptyHint} />
      ) : items.length > 0 ? (
        <Reveal>
          <div className={`card ${styles.tableCard}`}>
            <div className={`admin-table-wrap ${styles.tableWrap}`}>
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>{cm.colNameHe}</th>
                    <th>{cm.colNameEn}</th>
                    <th>{cm.colStatus}</th>
                    <th className="admin-table-actions-col">{a.ui.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const display = (lang === 'he' ? row.nameHe : row.nameEn) || row.id
                    return (
                      <tr key={row.id}>
                        <td data-label={cm.colNameHe}>
                          <span className="admin-user-identity">
                            <span className="admin-user-name">{row.nameHe}</span>
                            {/* The slug id doubles as the stored key on requests. */}
                            <span className="admin-user-sub">{row.id}</span>
                          </span>
                        </td>
                        <td data-label={cm.colNameEn}>{row.nameEn}</td>
                        <td data-label={cm.colStatus}>
                          <StatusBadge
                            status={row.archived ? 'inactive' : 'active'}
                            label={row.archived ? cm.archivedBadge : cm.activeBadge}
                          />
                        </td>
                        <td data-label={a.ui.actions}>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-label={`${a.table.edit}: ${display}`}
                              onClick={() => setDialog({ item: row })}
                            >
                              <Pencil size={14} aria-hidden="true" />
                              {a.table.edit}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-label={`${row.archived ? cm.restore : cm.archive}: ${display}`}
                              disabled={busy}
                              onClick={() => toggleArchive(row)}
                            >
                              {row.archived ? (
                                <ArchiveRestore size={14} aria-hidden="true" />
                              ) : (
                                <Archive size={14} aria-hidden="true" />
                              )}
                              {row.archived ? cm.restore : cm.archive}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm admin-dir-delete"
                              aria-label={`${a.table.delete}: ${display}`}
                              onClick={() => setConfirmDelete(row)}
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
        <CategoryFormDialog
          key={dialog.item?.id ?? 'new'}
          item={dialog.item}
          busy={busy}
          onClose={() => { if (!busy) setDialog(null) }}
          onSubmit={saveDialog}
        />
      )}

      {/* Hard delete sits behind a danger confirm (directory pattern). The
          backend refuses with 409 category_in_use when requests/answers still
          reference the id — surfaced as cm.inUseError above. */}
      <ConfirmDialog
        open={!!confirmDelete}
        variant="danger"
        title={cm.deleteTitle}
        message={deleteName ? `${deleteName}: ${cm.deleteBody}` : cm.deleteBody}
        confirmLabel={a.table.delete}
        cancelLabel={t.common.cancel}
        busy={busy && !!confirmDelete}
        onConfirm={doDelete}
        onCancel={() => { if (!busy) setConfirmDelete(null) }}
      />
    </AdminLayout>
  )
}
