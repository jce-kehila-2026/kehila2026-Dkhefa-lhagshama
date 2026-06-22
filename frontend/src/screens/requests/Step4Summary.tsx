import { FormGroup } from '@/components/forms/FormElements'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Lang } from '@/types'
import type { RequestFormValues, FormChangeHandler } from './types'

interface Step4SummaryProps {
  values: RequestFormValues
  errors: Record<string, string>
  handleChange: FormChangeHandler
  labelFor: (id: string | null | undefined, lang?: Lang) => string
}

export default function Step4Summary({
  values,
  errors,
  handleChange,
  labelFor,
}: Step4SummaryProps) {
  const { t, lang } = useLanguage()
  const rq = t.request

  return (
    <div className="req-step" key="step4">
      <span className="eyebrow req-step-eyebrow">
        {lang === 'he' ? `שלב 4 מתוך 4` : `Step 4 of 4`}
      </span>
      <h2 className="req-step-title" style={{ marginBlockEnd:'var(--sp-5)' }}>{rq.step4.title}</h2>
      <div className="review-panel" style={{ marginBottom:'24px' }}>
        <dl className="review-grid">
          {[
            [rq.step4.fullName,  `${values.firstName} ${values.lastName}`],
            [rq.step4.phone,     values.phone],
            [rq.step4.city,      values.city],
            [rq.step4.category,  values.category ? labelFor(values.category) : '—'],
            [rq.step4.urgency,   values.urgency === 'high' ? rq.step2.urgencyHigh : values.urgency === 'medium' ? rq.step2.urgencyMed : rq.step2.urgencyLow],
            ...(values.deadline ? [[t.myRequests.table.deadline, values.deadline]] : []),
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
            <div style={{ fontSize:'12px', color:'var(--gray-500)', marginBottom:'4px' }}>{rq.step4.description}</div>
            <div style={{ fontSize:'14px', color:'var(--gray-700)', lineHeight:1.7 }}>{values.description}</div>
          </div>
        )}
      </div>

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
        {errors.consent && <div id="consent-error" role="alert" className="form-error" style={{ marginTop:'8px' }}>{errors.consent}</div>}
      </FormGroup>
    </div>
  )
}
