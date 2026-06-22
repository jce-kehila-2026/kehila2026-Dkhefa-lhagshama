import { Sparkles } from 'lucide-react'
import { FormGroup, Label, Input, Select, FormRow } from '@/components/forms/FormElements'
import HelpTooltip from '@/components/feedback/HelpTooltip'
import { useLanguage } from '@/contexts/LanguageContext'
import type { RequestFormValues, FormChangeHandler } from './types'

interface Step1PersonalProps {
  role: string | null
  values: RequestFormValues
  errors: Record<string, string>
  handleChange: FormChangeHandler
  profileLoading: boolean
  fillFromProfile: () => void
}

export default function Step1Personal({
  role,
  values,
  errors,
  handleChange,
  profileLoading,
  fillFromProfile,
}: Step1PersonalProps) {
  const { t, lang } = useLanguage()
  const rq = t.request
  const s2 = t.stream2

  return (
    <div className="req-step" key="step1">
      <div className="req-step-head req-step-head--split">
        <div style={{ minWidth:0 }}>
          <span className="eyebrow req-step-eyebrow">
            {lang === 'he' ? `שלב 1 מתוך 4` : `Step 1 of 4`}
          </span>
          <h2 className="req-step-title">{role === 'volunteer' ? rq.onBehalf.step1Title : rq.step1.title}</h2>
        </div>
        {/* #67 — auto-fill button */}
        <button
          type="button"
          className={`btn btn-ghost btn-sm req-fill-btn${profileLoading ? ' is-loading' : ''}`}
          onClick={fillFromProfile}
          disabled={profileLoading}
          aria-busy={profileLoading}
        >
          <Sparkles size={14} aria-hidden="true" /> {s2.autoFill.fillBtn}
        </button>
      </div>

      <FormRow>
        <FormGroup>
          <Label htmlFor="firstName" required>{rq.step1.firstName}</Label>
          <Input id="firstName" name="firstName" value={values.firstName} onChange={handleChange}
            autoComplete="given-name" aria-invalid={!!errors.firstName}
            placeholder={rq.step1.firstNamePH} error={errors.firstName} />
        </FormGroup>
        <FormGroup>
          <Label htmlFor="lastName" required>{rq.step1.lastName}</Label>
          <Input id="lastName" name="lastName" value={values.lastName} onChange={handleChange}
            autoComplete="family-name" aria-invalid={!!errors.lastName}
            placeholder={rq.step1.lastNamePH} error={errors.lastName} />
        </FormGroup>
      </FormRow>

      {/* #66 — ID type selector */}
      <FormGroup>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Label required>{s2.idType.label}</Label>
          <HelpTooltip text={s2.idType.tip} label={s2.idType.tipLabel} />
        </span>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'12px' }}>
          {[
            ['israeli_id', s2.idType.israeliId],
            ['passport',   s2.idType.passport],
            ['none',       s2.idType.none],
          ].map(([val, label]) => (
            <label key={val} className={`opt-pill${values.idType === val ? ' is-on' : ''}`}>
              <input type="radio" name="idType" value={val}
                checked={values.idType === val}
                onChange={handleChange} />
              {label}
            </label>
          ))}
        </div>
      </FormGroup>

      {values.idType === 'israeli_id' && (
        <FormGroup>
          <Label htmlFor="idNumber" required>{rq.step1.idNumber}</Label>
          <Input id="idNumber" name="idNumber" value={values.idNumber} onChange={handleChange}
            inputMode="numeric" autoComplete="off" spellCheck={false} aria-invalid={!!errors.idNumber}
            placeholder={rq.step1.idPH} maxLength={9} error={errors.idNumber} />
        </FormGroup>
      )}

      {(values.idType === 'passport' || values.idType === 'none') && (
        <FormRow>
          {values.idType === 'passport' && (
            <FormGroup>
              <Label htmlFor="idNumber">{rq.step1.idNumber}</Label>
              <Input id="idNumber" name="idNumber" value={values.idNumber} onChange={handleChange}
                autoComplete="off" spellCheck={false} aria-invalid={!!errors.idNumber}
                placeholder={rq.step1.passportPH} maxLength={40} error={errors.idNumber} />
            </FormGroup>
          )}
          <FormGroup style={values.idType === 'none' ? {} : {}}>
            <Label htmlFor="idNote">{s2.idType.noteLabel}</Label>
            <Input id="idNote" name="idNote" value={values.idNote || ''} onChange={handleChange}
              placeholder={s2.idType.notePH} maxLength={400} />
          </FormGroup>
        </FormRow>
      )}

      <FormRow>
        <FormGroup>
          <Label htmlFor="phone" required>{rq.step1.phone}</Label>
          <Input id="phone" name="phone" type="tel" value={values.phone} onChange={handleChange}
            inputMode="tel" autoComplete="tel" aria-invalid={!!errors.phone}
            placeholder={rq.step1.phonePH} error={errors.phone} />
        </FormGroup>
        <FormGroup>
          <Label htmlFor="email" required>{rq.step1.email}</Label>
          <Input id="email" name="email" type="email" value={values.email} onChange={handleChange}
            inputMode="email" autoComplete="email" spellCheck={false} aria-invalid={!!errors.email}
            placeholder={rq.step1.emailPH} error={errors.email}
            hint={s2.autoFill.emailNote} />
        </FormGroup>
      </FormRow>

      <FormRow>
        <FormGroup>
          <Label htmlFor="city" required>{rq.step1.city}</Label>
          <Select id="city" name="city" value={values.city} onChange={handleChange}
            autoComplete="address-level2" aria-invalid={!!errors.city} error={errors.city}>
            <option value="">{lang === 'he' ? 'בחר עיר…' : 'Select city…'}</option>
            {rq.cities.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FormGroup>
        <FormGroup>
          <Label htmlFor="age">{rq.step1.age}</Label>
          <Input id="age" name="age" type="number" value={values.age} onChange={handleChange}
            inputMode="numeric" autoComplete="off"
            placeholder={rq.step1.agePH} min={1} max={120} />
        </FormGroup>
      </FormRow>

      <FormGroup>
        <Label>{rq.step1.gender}</Label>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          {[['M', rq.step1.genderM], ['F', rq.step1.genderF], ['O', rq.step1.genderO]].map(([val, label]) => (
            <label key={val} className={`opt-pill${values.gender === val ? ' is-on' : ''}`}>
              <input type="radio" name="gender" value={val}
                checked={values.gender === val}
                onChange={handleChange} />
              {label}
            </label>
          ))}
        </div>
      </FormGroup>
    </div>
  )
}
