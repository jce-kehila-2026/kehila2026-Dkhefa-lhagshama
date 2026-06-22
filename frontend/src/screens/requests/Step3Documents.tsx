import { ShieldCheck } from 'lucide-react'
import { FormGroup } from '@/components/forms/FormElements'
import UploadArea from '@/components/forms/UploadArea'
import { useLanguage } from '@/contexts/LanguageContext'

interface Step3DocumentsProps {
  errors: Record<string, string>
  requestId: string | null
  setIdUploaded: (v: boolean) => void
  setIdPath: (v: string) => void
  setSupportPath: (v: string) => void
}

export default function Step3Documents({
  errors,
  requestId,
  setIdUploaded,
  setIdPath,
  setSupportPath,
}: Step3DocumentsProps) {
  const { t, lang } = useLanguage()
  const rq = t.request

  return (
    <div className="req-step" key="step3">
      <span className="eyebrow req-step-eyebrow">
        {lang === 'he' ? `שלב 3 מתוך 4` : `Step 3 of 4`}
      </span>
      <h2 className="req-step-title">{rq.step3.title}</h2>
      <p className="req-step-intro">{rq.step3.subtitle}</p>
      <FormGroup>
        <UploadArea
          label={rq.step3.idLabel}
          hint={rq.step3.idHint}
          formats={rq.step3.idFormats}
          required
          requestId={requestId}
          onUpload={(r) => {
            setIdUploaded(!!r)
            setIdPath(r?.path || '')
          }}
          error={errors.idDoc}
        />
      </FormGroup>
      <FormGroup>
        <UploadArea
          label={rq.step3.supportLabel}
          hint={rq.step3.supportHint}
          formats={rq.step3.supportFormats}
          requestId={requestId}
          onUpload={(r) => {
            setSupportPath(r?.path || '')
          }}
        />
      </FormGroup>
      <div className="soft-note" style={{ marginTop:'16px' }}>
        <ShieldCheck size={18} className="soft-note-icon" aria-hidden="true" />
        <p>{rq.step3.security}</p>
      </div>
    </div>
  )
}
