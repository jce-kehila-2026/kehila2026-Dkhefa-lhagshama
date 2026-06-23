import { UploadArea } from 'push-for-fulfillment-frontend'

const wrap = { padding: 16, maxWidth: 460 } as const

export function Empty() {
  return (
    <div style={wrap}>
      <UploadArea
        label="Proof of address"
        hint="Drag a file here, or click to browse"
        formats="JPEG, PNG, PDF or DOCX — up to 10MB"
        required
      />
    </div>
  )
}

export function WithError() {
  return (
    <div style={wrap}>
      <UploadArea
        label="Income statement"
        hint="Drag a file here, or click to browse"
        formats="JPEG, PNG, PDF or DOCX — up to 10MB"
        error="File too large (max 10MB)."
      />
    </div>
  )
}
