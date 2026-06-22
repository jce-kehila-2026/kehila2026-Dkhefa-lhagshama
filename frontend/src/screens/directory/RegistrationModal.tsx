import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { TNode } from '@/types'
import { REG_AUTOCOMPLETE } from './constants'

type RegisterForm = {
  business_name: string
  owner_name: string
  phone: string
  category: string
  city: string
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
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRegForm(false)}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="dir-reg-title">
        <div className="modal-header">
          <h3 id="dir-reg-title" style={{ fontFamily: 'Frank Ruhl Libre, Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
            {d.registerNew}
          </h3>
          <button onClick={() => setShowRegForm(false)} className="btn btn-ghost btn-sm dir-modal-close" aria-label={t.common.cancel}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
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
          {/* Note 2 — optional public website (validated as a URL on submit). */}
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
