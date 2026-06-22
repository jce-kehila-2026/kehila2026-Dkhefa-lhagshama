/**
 * UploadArea.tsx — single-file attachment field for the request forms.
 *
 * Bridges the UC-01 "Submit Request" form to Firebase Storage: a beneficiary
 * drops/picks one file, it is validated client-side (MIME allowlist + 10MB,
 * mirroring storage.rules), uploaded under `requests/{requestId}/{filename}`
 * via `uploadAttachment`, and the resulting Storage path is handed back to the
 * parent form through `onUpload` to be stored on the request's attachmentPaths.
 * Used by the request-form pages; collaborates with `@/lib/storage` (upload +
 * cancellable handle) and `@/utils/sanitizeFilename`.
 *
 * Invariant: without a `requestId` the upload is SIMULATED (no network), so the
 * field stays usable in isolation/storybook-style previews.
 */
import { useEffect, useRef, useState } from 'react'
import type { DragEvent, MouseEvent, ChangeEvent, ReactNode } from 'react'
import { Upload, CheckCircle, X, FileText } from 'lucide-react'
import { uploadAttachment } from '@/lib/storage'
import type { UploadHandle } from '@/lib/storage'
import { sanitizeFilename } from '@/utils/sanitizeFilename' // #96
import styles from './UploadArea.module.css'

/** Payload reported to the parent on a successful (or simulated) upload. */
interface UploadResult {
  file: File
  path: string
  downloadURL: string
}

interface UploadAreaProps {
  label: string
  hint?: ReactNode
  formats?: ReactNode
  required?: boolean
  onUpload?: (result: UploadResult | null) => void
  error?: ReactNode
  requestId?: string | null
}

/**
 * UploadArea — drag-drop or click-to-pick a single file, upload to Firebase
 * Storage under `requests/{requestId}/{filename}`, show a progress bar, and
 * report the resulting Storage path to the parent via `onUpload`.
 *
 * Props:
 *  - label, hint, formats, required, error  — visual labels (same as prototype)
 *  - requestId  — REQUIRED for real uploads. If null/undefined, the upload is
 *                 simulated (legacy prototype behavior) so the page is still
 *                 testable in isolation.
 *  - onUpload   — called with ({ file, path, downloadURL }) on success, or
 *                 `null` when the user removes the file. The parent should
 *                 push `path` into the request's `attachmentPaths[]`.
 */
export default function UploadArea({ label, hint, formats, required, onUpload, error, requestId }: UploadAreaProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState(0)
  const [errMsg, setErrMsg] = useState('')
  const [dragging, setDragging] = useState(false)
  const handleRef = useRef<UploadHandle | null>(null)

  // Cancel an in-flight upload if the component unmounts.
  useEffect(() => () => { if (handleRef.current) handleRef.current.cancel() }, [])

  // #84 — client-side MIME allowlist (mirrors server + storage.rules)
  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])

  const handleFile = async (rawFile: File | undefined | null) => {
    if (!rawFile) return
    setErrMsg('')

    // #96 — sanitize filename before processing so the sanitized name is used
    // consistently in both the UI display and the Storage path.
    const safeName = sanitizeFilename(rawFile.name)
    // Reconstruct a File with the sanitized name (browser File is immutable).
    const f = new File([rawFile], safeName, { type: rawFile.type })

    // No requestId → simulate (keeps Storybook-style isolation working).
    if (!requestId) {
      setUploading(true)
      setTimeout(() => {
        setUploading(false); setFile(f)
        if (onUpload) onUpload({ file: f, path: '', downloadURL: '' })
      }, 600)
      return
    }

    // #84 — Client-side MIME allowlist check.
    if (!ALLOWED_TYPES.has(f.type)) {
      setErrMsg('Only JPEG, PNG, PDF, or DOCX files are allowed.')
      return
    }

    // Client-side size guard (matches storage.rules — 10MB).
    if (f.size > 10 * 1024 * 1024) {
      setErrMsg('File too large (max 10MB).')
      return
    }

    setUploading(true)
    setPercent(0)
    try {
      const handle = uploadAttachment(f, requestId)
      handleRef.current = handle // keep ref so unmount/remove can cancel it
      const unsub = handle.onProgress(setPercent)
      const result = await handle.done
      unsub()
      handleRef.current = null
      setFile(f)
      if (onUpload) onUpload({ file: f, path: result.path, downloadURL: result.downloadURL })
    } catch (err) {

      console.error('[UploadArea] upload failed:', err)
      setErrMsg('Upload failed — please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const remove = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (handleRef.current) { handleRef.current.cancel(); handleRef.current = null }
    setFile(null); setPercent(0); setErrMsg('')
    if (onUpload) onUpload(null)
  }

  // hidden <input type=file> is driven by clicking the drop zone; id is derived
  // from the label so each instance on a page targets its own input.
  const inputId = `file-${label}`
  const openPicker = () => document.getElementById(inputId)?.click()

  // ── Uploaded state: compact file card with remove ──
  if (file && !uploading) {
    return (
      <div className={styles.fileCard}>
        <div aria-hidden="true" className={styles.fileIcon}>
          <CheckCircle size={20} color="var(--success)" />
        </div>
        <div className={styles.fileMeta}>
          <div className={styles.fileName}>{file.name}</div>
          <div className={styles.fileSize}>{(file.size / 1024).toFixed(0)} KB</div>
        </div>
        <button type="button" onClick={remove} aria-label={`Remove ${file.name}`} className={`btn btn-ghost btn-sm ${styles.removeBtn}`}>
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        className={`upload-area${dragging ? ' is-dragging' : ''}`}
        onClick={openPicker}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker() } }}
        style={dragging ? { borderColor: 'var(--ember)', background: 'var(--ember-soft)' } : undefined}
      >
        {uploading ? (
          <div className={styles.uploadingCol}>
            <div className="spinner-ring" aria-hidden="true" />
            <span className={styles.percent}>
              {percent ? `${percent.toFixed(0)}%` : ''}
            </span>
            <div className={styles.progressTrack}>
              <div style={{ width: `${percent.toFixed(0)}%`, height: '100%', background: 'var(--ink)', transition: 'width 0.15s linear' }} />
            </div>
          </div>
        ) : (
          <>
            <div aria-hidden="true" className={styles.promptIcon}>
              <Upload size={20} color="var(--gray-600)" />
            </div>
            <div className={styles.promptLabel}>
              {label} {required && <span className={styles.requiredMark}>*</span>}
            </div>
            <div className={styles.promptHint}>{hint}</div>
            <div className={styles.promptFormats}>
              <FileText size={12} /> {formats}
            </div>
          </>
        )}
      </div>
      {(errMsg || error) && (
        <div className={`form-error ${styles.errorRow}`}>
          <span>{errMsg || error}</span>
        </div>
      )}
      <input
        type="file"
        id={inputId}
        accept=".jpg,.jpeg,.png,.pdf,.docx"
        className={styles.hiddenInput}
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFile(e.target.files?.[0])}
      />
      <style>{`
        .spinner-ring { width: 32px; height: 32px; border: 3px solid var(--gray-200); border-top-color: var(--ink); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (prefers-reduced-motion: reduce) { .spinner-ring { animation-duration: 1.6s; } }
      `}</style>
    </div>
  )
}
