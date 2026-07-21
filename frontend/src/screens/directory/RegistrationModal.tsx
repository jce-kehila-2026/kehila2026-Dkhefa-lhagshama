/*
 * RegistrationModal — the public "register my business" dialog for the directory
 * screen (UC-03 community businesses). Pure presentational/controlled component:
 * all form state and the submit/validate/POST logic live in the parent directory
 * page; this just renders the fields and forwards changes via callbacks.
 * Portalled to document.body so the overlay escapes any clipped/positioned
 * ancestor. Labels and category options are read dynamically from the bilingual
 * `d` (directory) node, so HE/EN follows the active language with no extra wiring.
 */
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { TNode } from '@/types'
import CitySelect from '@/components/forms/CitySelect'
import { REG_AUTOCOMPLETE } from './constants'
import styles from './RegistrationModal.module.css'

// Submitted business shape. `website` is optional/free-form (validated as a URL
// by the parent on submit); the other six are the required core fields.
type RegisterForm = {
  business_name: string
  owner_name: string
  phone: string
  category: string
  city: string
  /** CBS locality code — the committed value; `city` is its display name. */
  cityCode: string
  desc: string
  website: string
}

type Props = {
  d: TNode
  t: TNode
  registerForm: RegisterForm
  registerSubmitting: boolean
  setShowRegForm: (v: boolean) => void
  updateRegisterField: (field: string, value: string) => void
  handleRegisterSubmit: () => void
}

// Controlled modal. `d`/`t` are bilingual label nodes (directory + common
// strings); `registerForm` holds the current values; field edits go through
// `updateRegisterField` and submit through `handleRegisterSubmit`. Closing
// (X, Cancel, or overlay click) just flips the parent's `setShowRegForm(false)`.
export default function RegistrationModal({
  d,
  t,
  registerForm,
  registerSubmitting,
  setShowRegForm,
  updateRegisterField,
  handleRegisterSubmit,
}: Props) {
  return createPortal(
    // close only on a click that lands on the overlay itself, not bubbled from inside the box
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRegForm(false)}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="dir-reg-title">
        <div className="modal-header">
          <h3 id="dir-reg-title" className={styles.title}>
            {d.registerNew}
          </h3>
          <button onClick={() => setShowRegForm(false)} className="btn btn-ghost btn-sm dir-modal-close" aria-label={t.common.cancel}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
          {/* render the six core fields from a fixed order; `desc` is a textarea,
              `category` a select over the bilingual taxonomy, the rest plain inputs */}
          {['business_name', 'owner_name', 'phone', 'category', 'city', 'desc'].map(field => (
            <div className="form-group" key={field}>
              <label className="form-label" htmlFor={`dir-reg-${field}`}>
                {d.fields[field]}
              </label>
              {field === 'desc' ? (
                <textarea
                  id={`dir-reg-${field}`}
                  name={field}
                  className="form-textarea"
                  rows={3}
                  value={registerForm.desc}
                  onChange={(e) => updateRegisterField('desc', e.target.value)}
                />
              ) : field === 'city' ? (
                /* Locality picked from the official list, never free text, so
                   two spellings can't become two different places. */
                <CitySelect
                  id={`dir-reg-${field}`}
                  value={registerForm.cityCode}
                  onChange={(code, picked) => {
                    updateRegisterField('cityCode', code)
                    updateRegisterField('city', picked ? picked.nameHe : '')
                  }}
                />
              ) : field === 'category' ? (
                <select
                  id={`dir-reg-${field}`}
                  name={field}
                  className="form-select"
                  value={registerForm.category}
                  onChange={(e) => updateRegisterField('category', e.target.value)}
                >
                  {Object.entries(d.categories as Record<string, string>).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`dir-reg-${field}`}
                  name={field}
                  autoComplete={REG_AUTOCOMPLETE[field] || 'off'}
                  className="form-input"
                  type={field === 'phone' ? 'tel' : 'text'}
                  value={(registerForm as Record<string, string>)[field]}
                  onChange={(e) => updateRegisterField(field, e.target.value)}
                />
              )}
            </div>
          ))}
          {/* optional public website, kept out of the loop above so it can use
              url-specific input affordances; validated as a URL on submit by the parent */}
          <div className="form-group">
            <label className="form-label" htmlFor="biz-website">
              {d.websiteLabel}
            </label>
            <input
              id="biz-website"
              name="website"
              autoComplete="url"
              spellCheck={false}
              className="form-input"
              type="url"
              inputMode="url"
              placeholder={d.websitePH}
              value={registerForm.website}
              onChange={(e) => updateRegisterField('website', e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => setShowRegForm(false)}>{t.common.cancel}</button>
          <button className="btn btn-ember" onClick={handleRegisterSubmit} disabled={registerSubmitting}>
            {registerSubmitting ? t.common.loading : d.submitApproval}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
