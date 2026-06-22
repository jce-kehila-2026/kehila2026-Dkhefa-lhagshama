import { Share2 } from 'lucide-react'
import type { Translations } from '@/contexts/LanguageContext'
import type { AnswerOption } from './types'

interface ReferDialogProps {
  a: Translations['admin']
  lc: Translations['lifecycle']
  t: Translations
  referring: boolean
  setReferOpen: (v: boolean) => void
  answersLoaded: boolean
  answers: AnswerOption[]
  referAnswerId: string
  setReferAnswerId: (v: string) => void
  referNote: string
  setReferNote: (v: string) => void
  resolveBilingual: (v: AnswerOption['title']) => string
  submitReferral: () => void
}

// ── Refer to partner dialog (Note 8) — picker over the answers catalog
// + optional note. Reuses the branded confirm surface for consistency. ──
export default function ReferDialog({
  a,
  lc,
  t,
  referring,
  setReferOpen,
  answersLoaded,
  answers,
  referAnswerId,
  setReferAnswerId,
  referNote,
  setReferNote,
  resolveBilingual,
  submitReferral,
}: ReferDialogProps) {
  return (
    <div
      className="confirm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !referring) setReferOpen(false)
      }}
    >
      <div
        className="confirm-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refer-title"
      >
        <span className="confirm-icon confirm-icon--default" aria-hidden="true">
          <Share2 size={22} />
        </span>
        <h2 id="refer-title" className="confirm-title">{lc.referral.dialogTitle}</h2>

        <div className="field" style={{ textAlign: 'start' }}>
          <label className="form-label" htmlFor="refer-partner">
            {lc.referral.choosePartner}
          </label>
          {!answersLoaded ? (
            <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
              {a.ui.loading}
            </p>
          ) : answers.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
              {lc.referral.noPartners}
            </p>
          ) : (
            <select
              id="refer-partner"
              className="form-select"
              value={referAnswerId}
              onChange={(e) => setReferAnswerId(e.target.value)}
            >
              <option value="">{lc.referral.partnerPH}</option>
              {answers.map((ans) => (
                <option key={ans.id} value={ans.id}>
                  {resolveBilingual(ans.title) || resolveBilingual(ans.sourceName) || ans.id}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="field" style={{ textAlign: 'start', marginBlockStart: 'var(--sp-3)' }}>
          <label className="form-label" htmlFor="refer-note">
            {lc.referral.noteLabel}
          </label>
          <textarea
            id="refer-note"
            className="form-textarea"
            rows={3}
            value={referNote}
            onChange={(e) => setReferNote(e.target.value)}
            placeholder={lc.referral.notePH}
          />
        </div>

        <div className="confirm-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setReferOpen(false)}
            disabled={referring}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            className={`btn btn-primary${referring ? ' is-loading' : ''}`}
            onClick={submitReferral}
            disabled={referring || !referAnswerId}
            aria-busy={referring || undefined}
          >
            {referring ? lc.referral.submitting : lc.referral.submit}
          </button>
        </div>
      </div>
    </div>
  )
}
