import { useRef, useState } from 'react'
import { ClipboardList, Paperclip, X } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCategories } from '@/hooks/useCategories'
import { apiJson } from '@/lib/apiClient'
import { getIdToken } from '@/lib/auth'
import styles from './CreateTaskDialog.module.css'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'

// Sanitize a filename so it's safe as a Storage path segment (mirrors
// lib/storage.ts so the backend receives the same shape).
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

// A picked file plus its per-file "visible to volunteers" flag (req 21).
interface PickedFile {
  id: string
  file: File
  visibleToVol: boolean
}

interface CreateTaskDialogProps {
  open: boolean
  onClose: () => void
  /** Called after a successful create (+ uploads) so the list can refresh. */
  onCreated: (newId: string) => void
}

const URGENCIES = ['low', 'medium', 'high'] as const

/**
 * Admin "create task request" dialog (req 20 + 21). Flow:
 *   1. POST /api/admin/requests/task → { id }
 *   2. for each picked file: POST raw bytes to
 *      /api/uploads/requests/{id}?filename=...&volunteerVisible=<checkbox>
 * Category options come from the admin-managed taxonomy (useCategories), the
 * same list the beneficiary form renders — no parallel list to drift.
 */
export default function CreateTaskDialog({ open, onClose, onCreated }: CreateTaskDialogProps) {
  const { t } = useLanguage()
  const a = t.admin
  const f = a.taskForm
  const { categories, labelFor } = useCategories()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [urgency, setUrgency] = useState<(typeof URGENCIES)[number]>('low')
  const [deadline, setDeadline] = useState('')
  const [files, setFiles] = useState<PickedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const reset = () => {
    setTitle('')
    setDescription('')
    setCategory('')
    setUrgency('low')
    setDeadline('')
    setFiles([])
    setError(null)
  }

  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next: PickedFile[] = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      visibleToVol: false,
    }))
    setFiles((prev) => [...prev, ...next])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (id: string) => setFiles((prev) => prev.filter((p) => p.id !== id))

  const toggleVisible = (id: string) =>
    setFiles((prev) => prev.map((p) => (p.id === id ? { ...p, visibleToVol: !p.visibleToVol } : p)))

  // Upload one file's raw bytes to the new request, carrying its visibility.
  const uploadOne = async (requestId: string, picked: PickedFile): Promise<boolean> => {
    const idToken = await getIdToken()
    if (!idToken) return false
    const fname = safeName(picked.file.name)
    const url =
      `${API_BASE}/api/uploads/requests/${encodeURIComponent(requestId)}` +
      `?filename=${encodeURIComponent(fname)}&volunteerVisible=${picked.visibleToVol ? 'true' : 'false'}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': picked.file.type || 'application/octet-stream',
        },
        body: picked.file,
      })
      return res.ok
    } catch {
      return false
    }
  }

  const submit = async () => {
    const trimmedTitle = title.trim()
    const trimmedDesc = description.trim()
    if (!trimmedTitle || !trimmedDesc || !category) {
      setError(f.validation)
      return
    }
    setBusy(true)
    setError(null)
    try {
      // 1. Create the task first to obtain its id.
      const created = await apiJson<{ id: string }>('/api/admin/requests/task', {
        method: 'POST',
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDesc,
          category,
          urgency,
          deadline: deadline || undefined,
        }),
      })
      // 2. Attach each file with its per-file visibility flag.
      let uploadFailed = false
      for (const picked of files) {
        const ok = await uploadOne(created.id, picked)
        if (!ok) uploadFailed = true
      }
      if (uploadFailed) setError(f.uploadError)
      reset()
      onCreated(created.id)
    } catch {
      setError(f.errorTitle)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="confirm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="confirm-box admin-task-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
      >
        <span className="confirm-icon confirm-icon--default" aria-hidden="true">
          <ClipboardList size={22} />
        </span>
        <h2 id="task-dialog-title" className="confirm-title">
          {f.dialogTitle}
        </h2>

        <div className={`field ${styles.fieldStart}`}>
          <label className="form-label" htmlFor="task-title">
            {f.titleLabel}
          </label>
          <input
            id="task-title"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={f.titlePH}
            disabled={busy}
          />
        </div>

        <div className={`field ${styles.fieldSpaced}`}>
          <label className="form-label" htmlFor="task-desc">
            {f.descLabel}
          </label>
          <textarea
            id="task-desc"
            className="form-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={f.descPH}
            disabled={busy}
          />
        </div>

        <div className={`admin-task-grid ${styles.gridSpaced}`}>
          <div className={`field ${styles.fieldStart}`}>
            <label className="form-label" htmlFor="task-cat">
              {f.categoryLabel}
            </label>
            <select
              id="task-cat"
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={busy}
            >
              <option value="">{f.categoryPH}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {labelFor(c.id)}
                </option>
              ))}
            </select>
          </div>

          <div className={`field ${styles.fieldStart}`}>
            <label className="form-label" htmlFor="task-urgency">
              {f.urgencyLabel}
            </label>
            <select
              id="task-urgency"
              className="form-select"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as (typeof URGENCIES)[number])}
              disabled={busy}
            >
              {URGENCIES.map((u) => (
                <option key={u} value={u}>
                  {(a.urgencyLabels as Record<string, string>)[u]}
                </option>
              ))}
            </select>
          </div>

          <div className={`field ${styles.fieldStart}`}>
            <label className="form-label" htmlFor="task-deadline">
              {f.deadlineLabel}
            </label>
            <input
              id="task-deadline"
              type="date"
              className="form-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        {/* ── Optional attachments — each with its own visibility toggle ─── */}
        <div className={`field ${styles.fieldSpaced}`}>
          <label className="form-label">{f.filesLabel}</label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className={styles.fileInput}
            disabled={busy}
          />
          <button
            type="button"
            className={`btn btn-outline btn-sm ${styles.addBtn}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <Paperclip size={15} aria-hidden="true" />
            {f.addFiles}
          </button>

          {files.length > 0 && (
            <ul className="admin-task-files">
              {files.map((p) => (
                <li key={p.id} className="admin-task-file">
                  <span className="admin-task-file-name" title={p.file.name}>
                    {p.file.name}
                  </span>
                  <label className="admin-task-file-toggle">
                    <input
                      type="checkbox"
                      checked={p.visibleToVol}
                      onChange={() => toggleVisible(p.id)}
                      disabled={busy}
                    />
                    {f.visibleToVol}
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeFile(p.id)}
                    disabled={busy}
                    aria-label={`${f.removeFile} — ${p.file.name}`}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <div className="confirm-actions">
          <button type="button" className="btn btn-outline" onClick={close} disabled={busy}>
            {f.cancel}
          </button>
          <button
            type="button"
            className={`btn btn-primary${busy ? ' is-loading' : ''}`}
            onClick={submit}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? f.submitting : f.submit}
          </button>
        </div>
      </div>
    </div>
  )
}
