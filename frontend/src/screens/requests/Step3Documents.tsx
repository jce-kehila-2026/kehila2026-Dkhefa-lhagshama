/**
 * Step3Documents — step 3 of 4 in the UC-01 "submit request" wizard.
 *
 * Presentational sub-screen that collects two file uploads for a request: an
 * ID document and a supporting document. Both are optional — a beneficiary who
 * holds no ID must still be able to submit — so this step never blocks the
 * wizard. Actual upload is delegated to UploadArea; this component only wires
 * the upload results back up via setter callbacks (no local state of its own).
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
  // request the uploads attach to; null until the parent has created the request
  requestId: string | null
  // storage path of the uploaded ID doc ('' clears it)
  setIdPath: (v: string) => void
  // storage path of the supporting doc ('' clears it)
  setSupportPath: (v: string) => void
}

// renders the two upload areas + a privacy note; stateless, just lifts upload results to the parent
export default function Step3Documents({
  requestId,
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
          requestId={requestId}
          onUpload={(r) => {
            // r null means removed/failed; '' clears the path
            setIdPath(r?.path || '')
          }}
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
