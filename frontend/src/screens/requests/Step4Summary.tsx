/**
 * Step4Summary — final "review and confirm" step of the 4-step request intake form (UC-01).
 *
 * read-only recap: renders back the values collected in steps 1-3 (no inputs except the
 * consent checkbox), so the beneficiary can verify before submit. the parent stepper owns
 * all state; this screen only reads `values`/`errors` and forwards consent toggles via
 * `handleChange`. fully bilingual (HE/EN) off the shared LanguageContext.
 *
 * invariant: optional fields (deadline, preferredLanguage) are conditionally spread into the
 * review grid only when present, so empty rows never show.
 */
import { FormGroup } from '@/components/forms/FormElements'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Lang } from '@/types'
import type { RequestFormValues, FormChangeHandler } from './types'
import styles from './Step4Summary.module.css'

interface Step4SummaryProps {
  values: RequestFormValues
  errors: Record<string, string>
  handleChange: FormChangeHandler
  labelFor: (id: string | null | undefined, lang?: Lang) => string
}

// props: `values`/`errors` come from the parent stepper's useForm; `handleChange` wires the
// consent checkbox back to it; `labelFor` resolves a category id to its localized display label.
export default function Step4Summary({
  values,
  errors,
  handleChange,
  labelFor,
}: Step4SummaryProps) {
  const { t, lang } = useLanguage()
  const rq = t.request // request-form i18n namespace shortcut

  return (
    <div className="req-step" key="step4">
      <span className="eyebrow req-step-eyebrow">
        {lang === 'he' ? `שלב 4 מתוך 4` : `Step 4 of 4`}
      </span>
      <h2 className={`req-step-title ${styles.title}`}>{rq.step4.title}</h2>
      <div className={`review-panel ${styles.reviewPanel}`}>
        <dl className="review-grid">
          {/* [label, value] pairs driving the recap rows; deadline + preferredLanguage are
              conditionally spread so optional fields are omitted entirely when unset */}
          {[
            [rq.step4.fullName,  `${values.firstName} ${values.lastName}`],
            [rq.step4.phone,     values.phone],
            [rq.step4.city,      values.city],
            [rq.step4.category,  values.category ? labelFor(values.category) : '—'],
            [rq.step4.urgency,   values.urgency === 'high' ? rq.step2.urgencyHigh : values.urgency === 'medium' ? rq.step2.urgencyMed : rq.step2.urgencyLow],
            ...(values.deadline ? [[t.myRequests.table.deadline, values.deadline]] : []),
            // map the he/am/en code to its localized label; fall back to the raw code if unknown
            ...(values.preferredLanguage
              ? [[rq.step2.prefLang, ({ he: rq.step2.prefLangHe, am: rq.step2.prefLangAm, en: rq.step2.prefLangEn } as Record<string, string>)[values.preferredLanguage] ?? values.preferredLanguage]]
              : []),
          ].map(([label, val]) => (
            <div key={label} className="review-item">
              <dt>{label}</dt>
              <dd>{val || '—'}</dd>
            </div>
          ))}
        </dl>
        {values.description && (
          <div className="review-note">
            <div className={styles.noteLabel}>{rq.step4.description}</div>
            <div className={styles.noteText}>{values.description}</div>
          </div>
        )}
      </div>

      {/* only interactive control on this step; consent is required for submit (validated upstream) */}
      <FormGroup>
        <label className="consent-row">
          <input
            type="checkbox" name="consent"
            checked={values.consent}
            onChange={handleChange}
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? 'consent-error' : undefined}
          />
          <span>{rq.step4.consent}</span>
        </label>
        {errors.consent && <div id="consent-error" role="alert" className={`form-error ${styles.consentError}`}>{errors.consent}</div>}
      </FormGroup>
    </div>
  )
}
