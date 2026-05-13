import { useState } from 'react'
import { Upload, CheckCircle, X, File } from 'lucide-react'

export default function UploadArea({ label, hint, formats, required, onUpload, error }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = (f) => {
    if (!f) return
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setFile(f)
      if (onUpload) onUpload(f)
    }, 900)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const remove = (e) => {
    e.stopPropagation()
    setFile(null)
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
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' }}>
            <div style={{
              width:'32px', height:'32px', border:'3px solid var(--gray-200)',
              borderTopColor:'var(--navy)', borderRadius:'50%',
              animation:'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize:'13.5px', color:'var(--gray-500)' }}>מעלה...</span>
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
      {error && (
        <div className="form-error" style={{ marginTop:'6px' }}>
          <span>{error}</span>
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