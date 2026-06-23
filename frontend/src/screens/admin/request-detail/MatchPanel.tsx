import {
  AlertTriangle,
  MapPin,
  RotateCcw,
  Languages,
  Gauge,
  Star,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
  X,
} from 'lucide-react'
import type { Translations } from '@/contexts/LanguageContext'
import type { Candidate, MatchReason, MatchingI18n, RequestDetail } from './types'
import styles from './MatchPanel.module.css'

// All state lives in the parent; this component is fully controlled.
// candidates = full ranked list; filteredCandidates = after the name search;
// visibleCandidates = the windowed slice the carousel actually renders;
// safeIdx = clamped carousel position (drives the counter + nav disabled state).
interface MatchPanelProps {
  request: RequestDetail
  a: Translations['admin']
  t: Translations
  isRTL: boolean
  m: MatchingI18n
  saving: boolean
  assignedLabel: React.ReactNode
  isTerminal: boolean
  reassigning: boolean
  setReassigning: (v: boolean) => void
  candidatesError: boolean
  candidates: Candidate[]
  candidateSearch: string
  setCandidateSearch: (v: string) => void
  filteredCandidates: Candidate[]
  visibleCandidates: Candidate[]
  safeIdx: number
  setCandIdx: React.Dispatch<React.SetStateAction<number>>
  assigningUid: string | null
  assignedCandidate: Candidate | null
  reasonChipLabel: (r: MatchReason) => string
  handleAssignCandidate: (uid: string) => void
}

// Matching/assignment body of the admin request-detail action aside (UC-05).
// Pure presentation: all data + handlers come from the parent request-detail
// screen, which owns the candidate fetch (GET /api/admin/requests/:id/candidates,
// ranked best-first by the rule-based matcher) and the assign/reassign state.
// Core invariant of the render: if the request already has an assignedVolunteerId
// and we are not actively reassigning, show the assigned summary (who + why);
// otherwise show the searchable ranked candidate carousel. HE/RTL aware (nav
// chevrons flip on isRTL).
export default function MatchPanel({
  request,
  a,
  t,
  isRTL,
  m,
  saving,
  assignedLabel,
  isTerminal,
  reassigning,
  setReassigning,
  candidatesError,
  candidates,
  candidateSearch,
  setCandidateSearch,
  filteredCandidates,
  visibleCandidates,
  safeIdx,
  setCandIdx,
  assigningUid,
  assignedCandidate,
  reasonChipLabel,
  handleAssignCandidate,
}: MatchPanelProps) {
  return (
    <>
      {isTerminal && (
        <p
          className={`admin-notice admin-notice-warn ${styles.spacedTop}`}
          role="status"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{a.reqDetail.assignTerminalHint}</span>
        </p>
      )}

      {/* FIX 2 — once assigned (and not actively reassigning) the aside
          shows WHO it is assigned to + WHY (the assigned volunteer's
          own match reasons), not the ranked list. */}
      {request.assignedVolunteerId && !reassigning ? (
        <div className={`match-assigned ${styles.spacedTop}`}>
          <p className="match-assigned-head">
            <span className="match-assigned-icon" aria-hidden="true">
              <Check size={15} />
            </span>
            <span className="match-assigned-label">{a.reqDetail.assignedTo}:</span>{' '}
            <span className="match-assigned-name">{assignedLabel}</span>
          </p>
          {assignedCandidate && assignedCandidate.reasons.length > 0 && (
            <div className="match-chips" aria-label={m.why}>
              {assignedCandidate.reasons.map((r, ri) => (
                <span
                  key={`${r.key}-${ri}`}
                  className={`match-chip${r.key === 'sameCategory' ? ' match-chip--strong' : ''}`}
                >
                  {r.key === 'speaksLanguage' && <Languages size={12} aria-hidden="true" />}
                  {r.key === 'lowLoad' && <Gauge size={12} aria-hidden="true" />}
                  {reasonChipLabel(r)}
                </span>
              ))}
            </div>
          )}
          {!isTerminal && (
            <button
              type="button"
              className="btn btn-ghost btn-sm match-assigned-reassign"
              disabled={saving}
              onClick={() => setReassigning(true)}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {m.reassign}
            </button>
          )}
        </div>
      ) : candidatesError ? (
        <p className={styles.statusMessage}>
          {m.loadError}
        </p>
      ) : candidates.length === 0 ? (
        <p className={styles.statusMessage}>
          {m.empty}
        </p>
      ) : (
        <>
          {/* FIX 2 — search box over the ranked candidates. Every active
              volunteer arrives in this list, so a name filter makes each
              of them reachable. Mirrors the /admin/users search box. */}
          <div className="admin-search match-search">
            <Search size={16} aria-hidden="true" className="admin-search-icon" />
            <input
              type="search"
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              placeholder={m.searchPlaceholder}
              aria-label={m.searchPlaceholder}
              className="form-input admin-search-input"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            {candidateSearch && (
              <button
                type="button"
                className="admin-search-clear"
                aria-label={t.common.cancel}
                onClick={() => setCandidateSearch('')}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          {filteredCandidates.length === 0 ? (
            // No volunteer name matched the active search term.
            <p className={styles.statusMessage}>
              {m.noMatches}
            </p>
          ) : (
            <>
          {/* The candidates arrive ranked best-first, so render the
              sorted list (top emphasized). With an active search ALL
              matches show; otherwise long lists collapse to the first 8
              with a show-all toggle. */}
          <div className="match-carousel-stage">
            <button
              type="button"
              className="match-nav"
              aria-label={m.prev}
              disabled={safeIdx <= 0}
              onClick={() => setCandIdx((v) => Math.max(0, v - 1))}
            >
              {isRTL ? <ChevronRight size={22} aria-hidden="true" /> : <ChevronLeft size={22} aria-hidden="true" />}
            </button>
            <ul className="match-list match-carousel-list">
            {visibleCandidates.map((c, i) => {
              // this row's assign is in flight (one assign at a time across the list)
              const busy = assigningUid === c.uid
              return (
                <li
                  key={c.uid}
                  className={`match-card${i === 0 ? ' match-card--top' : ''}`}
                >
                  <div className="match-card-body">
                    <span className="match-card-name">{c.name}</span>
                    <p className="match-card-meta">
                      <span className="match-card-pct">{c.matchPercent}% {m.match}</span>
                      {' · '}{c.openLoad} {m.openTasks}
                      {c.hasClaimed ? ` · ${m.claimedTag}` : ''}
                    </p>
                    <div className="match-chips" aria-label={m.why}>
                      {c.reasons.map((r, ri) => (
                        <span
                          key={`${r.key}-${ri}`}
                          className={`match-chip${r.key === 'sameCategory' ? ' match-chip--strong' : ''}${r.key === 'atCapacity' ? ' match-chip--warn' : ''}`}
                        >
                          {r.key === 'speaksLanguage' && <Languages size={12} aria-hidden="true" />}
                          {r.key === 'lowLoad' && <Gauge size={12} aria-hidden="true" />}
                          {r.key === 'nearby' && <MapPin size={12} aria-hidden="true" />}
                          {r.key === 'highlyRated' && <Star size={12} aria-hidden="true" />}
                          {r.key === 'atCapacity' && <AlertTriangle size={12} aria-hidden="true" />}
                          {reasonChipLabel(r)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={saving || busy || isTerminal}
                    aria-busy={busy || undefined}
                    aria-label={`${m.assign}: ${c.name}`}
                    onClick={() => handleAssignCandidate(c.uid)}
                  >
                    {busy ? m.assigning : m.assign}
                  </button>
                </li>
              )
            })}
            </ul>
            <button
              type="button"
              className="match-nav"
              aria-label={m.next}
              disabled={safeIdx >= filteredCandidates.length - 1}
              onClick={() => setCandIdx((v) => Math.min(filteredCandidates.length - 1, v + 1))}
            >
              {isRTL ? <ChevronLeft size={22} aria-hidden="true" /> : <ChevronRight size={22} aria-hidden="true" />}
            </button>
          </div>
          <p className="match-carousel-counter" aria-live="polite">{safeIdx + 1} / {filteredCandidates.length}</p>
            </>
          )}

          {/* When reassigning an already-assigned request, offer a way
              back to the assigned summary without changing anyone —
              available regardless of the search result. */}
          {reassigning && request.assignedVolunteerId && (
            <div className="match-toggle-row">
              <button
                type="button"
                className="btn btn-ghost btn-sm match-toggle"
                disabled={saving}
                onClick={() => {
                  setReassigning(false)
                  // Reset the candidate filter too (this also re-homes the
                  // carousel via the parent's candidateQuery effect).
                  setCandidateSearch('')
                }}
              >
                {m.cancelReassign}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
