/**
 * RatingForm (#80).
 *
 * A compact, accessible star-rating control with an optional comment, used on
 * resolved requests in MyRequestsPage. Keyboard-operable (arrow keys + 1–5),
 * focus-visible, RTL-correct, and honours prefers-reduced-motion. Submits to
 * POST /api/ratings via the passed `onSubmit(stars, comment)` handler.
 */
import { useState } from 'react'
import { Star } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

const STYLE_ID = 'rating-form-styles'
function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = `
    .rating-star-btn {
      background: none;
      border: none;
      padding: 2px;
      cursor: pointer;
      line-height: 0;
      border-radius: 6px;
      color: var(--gray-300, #cbd5e1);
      transition: transform .12s ease, color .12s ease;
    }
    .rating-star-btn:hover { transform: scale(1.12); }
    .rating-star-btn:focus-visible {
      outline: 2px solid var(--ember, #B9694E);
      outline-offset: 2px;
    }
    .rating-star-btn.is-active { color: var(--ember, #B9694E); }
    @media (prefers-reduced-motion: reduce) {
      .rating-star-btn { transition: none; }
      .rating-star-btn:hover { transform: none; }
    }
  `
  document.head.appendChild(el)
}

export default function RatingForm({ onSubmit, submitting = false, initialStars = 0, initialComment = '' }) {
  const { t } = useLanguage()
  const r = t.ratings
  const [stars, setStars] = useState(initialStars)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState(initialComment)
  const [error, setError] = useState('')

  if (typeof document !== 'undefined') ensureStyles()

  const shown = hover || stars

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (stars < 1) {
      setError(r.pickStars)
      return
    }
    onSubmit?.(stars, comment.trim())
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      setStars((s) => Math.min(5, s + 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      setStars((s) => Math.max(1, s - 1))
    } else if (e.key >= '1' && e.key <= '5') {
      setStars(Number(e.key))
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        role="radiogroup"
        aria-label={r.starsLabel}
        onKeyDown={onKeyDown}
        style={{ display: 'inline-flex', gap: 2 }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={r.starAria(n)}
            tabIndex={stars === n || (stars === 0 && n === 1) ? 0 : -1}
            className={`rating-star-btn${n <= shown ? ' is-active' : ''}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setStars(n)}
          >
            <Star
              size={30}
              fill={n <= shown ? 'currentColor' : 'none'}
              color="currentColor"
            />
          </button>
        ))}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
        {r.commentLabel}
        <textarea
          className="form-textarea"
          rows={3}
          value={comment}
          maxLength={1000}
          onChange={(e) => setComment(e.target.value)}
          placeholder={r.commentPH}
          style={{ resize: 'vertical' }}
        />
      </label>

      {error && <div style={{ color: 'var(--danger, #DC2626)', fontSize: 13 }}>{error}</div>}

      <div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? t.common.loading : r.submit}
        </button>
      </div>
    </form>
  )
}
