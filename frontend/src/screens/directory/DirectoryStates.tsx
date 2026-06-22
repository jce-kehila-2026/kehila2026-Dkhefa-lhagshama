import { AlertTriangle } from 'lucide-react'
import type { TNode } from '@/types'
import { PER_PAGE } from './constants'

type Props = {
  d: TNode
  t: TNode
  loading: boolean
  error: string | null
  resultsCount: number
  retry: () => void
}

export default function DirectoryStates({ d, t, loading, error, resultsCount, retry }: Props) {
  return (
    <>
      {/* ── RESULTS COUNT ─────────────────────────────────────────── */}
      {!error && (
        <div aria-live="polite" className="dir-results-count">
          {loading ? t.common.loading : `${resultsCount} ${t.common.results}`}
        </div>
      )}

      {/* ── ERROR STATE (with Retry) ──────────────────────────────── */}
      {!loading && error && (
        <div className="dir-state" role="alert">
          <span className="dir-state-icon is-error">
            <AlertTriangle size={26} aria-hidden="true" />
          </span>
          <h3 className="section-display dir-state-title">{d.loadError}</h3>
          <button className="btn btn-ember" onClick={() => retry()} style={{ marginBlockStart: '12px' }}>
            {d.retry}
          </button>
        </div>
      )}

      {/* ── LOADING SKELETON — branded card bones ─────────────────── */}
      {loading && !error && (
        <div className="dir-grid" aria-hidden="true">
          {Array.from({ length: PER_PAGE }).map((_, i) => (
            <div key={i} className="card-bones">
              <div className="card-bones-head">
                <span className="skeleton card-bones-avatar" />
                <span className="card-bones-head-lines">
                  <span className="skeleton bone bone-title" />
                  <span className="skeleton bone bone-sub" />
                </span>
              </div>
              <span className="skeleton bone bone-line" />
              <span className="skeleton bone bone-line bone-w-90" />
              <span className="skeleton bone bone-line bone-w-75" />
              <span className="skeleton bone bone-pill" />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
