/**
 * Step3Documents — step 3 of 4 in the UC-01 "submit request" wizard.
 *
 * Presentational sub-screen that collects two file uploads for a request:
 * a required ID document and an optional supporting document. Actual upload
 * is delegated to UploadArea; this component only wires the upload results
 * back up to the wizard via setter callbacks (no local state of its own).
 *
 * Invariant: requestId may be null on first render (request not yet created),
 * UploadArea handles that case. Strings come from the shared HE/EN i18n bundle
 * (t.request.step3), so all copy is bilingual.
 */
import { ShieldCheck } from 'lucide-react'
import { FormGroup } from '@/components/forms/FormElements'
import UploadArea from '@/components/forms/UploadArea'
import { useLanguage } from '@/contexts/LanguageContext'
import styles from './Step3Documents.module.css'

interface Step3DocumentsProps {
  // field-keyed validation messages from the parent wizard (errors.idDoc shown on the ID upload)
  errors: Record<string, string>
  // request the uploads attach to; null until the parent has created the request
  requestId: string | null
  // true once a non-null ID upload result has come back (drives required-field validation upstream)
  setIdUploaded: (v: boolean) => void
  // storage path of the uploaded ID doc ('' clears it)
  setIdPath: (v: string) => void
  // storage path of the optional supporting doc ('' clears it)
  setSupportPath: (v: string) => void
}

// renders the two upload areas + a privacy note; stateless, just lifts upload results to the parent
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
            // r null means removed/failed; coerce to bool for the required flag, '' clears the path
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
      <div className={`soft-note ${styles.securityNote}`}>
        <ShieldCheck size={18} className="soft-note-icon" aria-hidden="true" />
        <p>{rq.step3.security}</p>
      </div>
    </div>
  )
}
