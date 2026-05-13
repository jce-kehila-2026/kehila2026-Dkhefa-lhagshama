import { useEffect, useRef, useState } from 'react'
import { Upload, CheckCircle, X } from 'lucide-react'
import { uploadAttachment } from '../lib/storage'

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
export default function UploadArea({ label, hint, formats, required, onUpload, error, requestId }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState(0)
  const [errMsg, setErrMsg] = useState('')
  const handleRef = useRef(null)

  // Cancel an in-flight upload if the component unmounts.
  useEffect(() => () => { if (handleRef.current) handleRef.current.cancel() }, [])

  const handleFile = async (f) => {
    if (!f) return
    setErrMsg('')

    // No requestId → simulate (keeps Storybook-style isolation working).
    if (!requestId) {
      setUploading(true)
      setTimeout(() => {
        setUploading(false); setFile(f)
        if (onUpload) onUpload({ file: f, path: '', downloadURL: '' })
      }, 600)
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
      handleRef.current = handle
      const unsub = handle.onProgress(setPercent)
      const result = await handle.done
      unsub()
      handleRef.current = null
      setFile(f)
      if (onUpload) onUpload({ file: f, path: result.path, downloadURL: result.downloadURL })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[UploadArea] upload failed:', err)
      setErrMsg('Upload failed — please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const remove = (e) => {
    e.stopPropagation()
    if (handleRef.current) { handleRef.current.cancel(); handleRef.current = null }
    setFile(null); setPercent(0); setErrMsg('')
    if (onUpload) onUpload(null)
  }

  if (file && !uploading) {
    return (
      <div className="upload-area has-file" style={{ cursor:'default' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px' }}>
          <CheckCircle size={22} color="var(--success)" />
          <div>
            <div style={{ fontWeight:600, fontSize:'14px', color:'var(--success)' }}>{file.name}</div>
            <div style={{ fontSize:'12px', color:'var(--gray-400)' }}>
              {(file.size / 1024).toFixed(0)} KB
            </div>
          </div>
          <button onClick={remove} style={{
            background:'none', border:'none', cursor:'pointer',
            color:'var(--gray-400)', padding:'4px', marginInlineStart:'8px', display:'flex',
          }}>
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        className="upload-area"
        onClick={() => document.getElementById(`file-${label}`).click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyPress={e => e.key === 'Enter' && document.getElementById(`file-${label}`).click()}
      >
        {uploading ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', width:'100%' }}>
            <div style={{
              width:'32px', height:'32px', border:'3px solid var(--gray-200)',
              borderTopColor:'var(--navy)', borderRadius:'50%',
              animation:'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize:'13.5px', color:'var(--gray-500)' }}>
              Uploading… {percent ? `${percent.toFixed(0)}%` : ''}
            </span>
            <div style={{ width:'80%', height:6, background:'var(--gray-200)', borderRadius:3, overflow:'hidden' }}>
              <div style={{
                width: `${percent.toFixed(0)}%`,
                height:'100%',
                background:'var(--navy)',
                transition:'width 0.15s linear',
              }} />
            </div>
          </div>
        ) : (
          <>
            <Upload size={28} style={{ color:'var(--gray-400)', marginBottom:'10px' }} />
            <div style={{ fontWeight:600, fontSize:'14px', color:'var(--navy)', marginBottom:'6px' }}>
              {label} {required && <span style={{ color:'var(--danger)' }}>*</span>}
            </div>
            <div style={{ fontSize:'13px', color:'var(--gray-500)', marginBottom:'6px' }}>{hint}</div>
            <div style={{ fontSize:'12px', color:'var(--gray-400)' }}>{formats}</div>
          </>
        )}
      </div>
      {(errMsg || error) && (
        <div className="form-error" style={{ marginTop:'6px' }}>
          <span>{errMsg || error}</span>
        </div>
      )}
      <input
        type="file"
        id={`file-${label}`}
        accept=".jpg,.jpeg,.png,.pdf"
        style={{ display:'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
