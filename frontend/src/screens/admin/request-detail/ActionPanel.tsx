import type { LucideIcon } from 'lucide-react'
import {
  StickyNote,
  Share2,
  Archive,
  FileText,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import type { Translations } from '@/contexts/LanguageContext'
import { EYEBROW } from './types'
import type {
  Candidate,
  MatchReason,
  MatchingI18n,
  PendingTransition,
  RequestDetail,
  TransitionKind,
} from './types'
import MatchPanel from './MatchPanel'

interface ActionPanelProps {
  request: RequestDetail
  a: Translations['admin']
  lc: Translations['lifecycle']
  t: Translations
  isRTL: boolean
  m: MatchingI18n
  EMPTY: string
  saving: boolean
  assignedLabel: React.ReactNode
  isTerminal: boolean
  // Matching / assignment.
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
  // Lifecycle transitions.
  transitionControls: {
    key: TransitionKind
    label: string
    Icon: LucideIcon
    pt: PendingTransition
    danger?: boolean
  }[]
  canRefer: boolean
  canArchive: boolean
  setPendingTransition: (pt: PendingTransition) => void
  openReferDialog: () => void
  // Documents.
  openingDoc: string | null
  viewDoc: (name: string) => void
  // Note.
  note: string
  setNote: (v: string) => void
  handleNote: () => void
}

// The sticky action <aside>: matching/assignment, lifecycle transitions,
// documents and the note field. Pure presentation lifted from the screen.
export default function ActionPanel({
  request,
  a,
  lc,
  t,
  isRTL,
  m,
  EMPTY,
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
  transitionControls,
  canRefer,
  canArchive,
  setPendingTransition,
  openReferDialog,
  openingDoc,
  viewDoc,
  note,
  setNote,
  handleNote,
}: ActionPanelProps) {
  return (
    <aside
      className="card admin-detail-side"
      style={{
        padding: 'clamp(var(--sp-5), 3vw, var(--sp-6))',
        position: 'sticky',
        // AdminLayout has no fixed top chrome (header scrolls; nav is a
        // left sidebar), so we pin to a small explicit offset rather than
        // borrowing the marketing shell's --nav-h, which produced a
        // bogus ~80px gap above the panel.
        insetBlockStart: 'var(--sp-5)',
      }}
    >
      <span style={{ ...EYEBROW, marginBlockEnd: 'var(--sp-4)' }}>
        {a.reqDetail.changeStatus}
      </span>

      <div className="field" style={{ marginBlockStart: 'var(--sp-2)' }}>
        <span
          className="form-label"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
        >
          <Sparkles size={15} aria-hidden="true" style={{ color: 'var(--ember)' }} />
          {m.heading}
        </span>
        <p style={{ margin: '4px 0 0', color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
          {m.subtitle}
        </p>

        <MatchPanel
          request={request}
          a={a}
          t={t}
          isRTL={isRTL}
          m={m}
          saving={saving}
          assignedLabel={assignedLabel}
          isTerminal={isTerminal}
          reassigning={reassigning}
          setReassigning={setReassigning}
          candidatesError={candidatesError}
          candidates={candidates}
          candidateSearch={candidateSearch}
          setCandidateSearch={setCandidateSearch}
          filteredCandidates={filteredCandidates}
          visibleCandidates={visibleCandidates}
          safeIdx={safeIdx}
          setCandIdx={setCandIdx}
          assigningUid={assigningUid}
          assignedCandidate={assignedCandidate}
          reasonChipLabel={reasonChipLabel}
          handleAssignCandidate={handleAssignCandidate}
        />
      </div>

      {/* ── Lifecycle transitions (Note 6 + 8) — only legal moves from
          the current status are shown. Refer + archive sit alongside. ── */}
      <div
        className="field"
        style={{
          marginBlockStart: 'var(--sp-5)',
          paddingBlockStart: 'var(--sp-5)',
          borderBlockStart: '1px solid var(--hair)',
        }}
      >
        <span
          className="form-label"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBlockEnd: 'var(--sp-2)' }}
        >
          <Share2 size={15} aria-hidden="true" style={{ color: 'var(--ember)' }} />
          {a.reqDetail.changeStatus}
        </span>

        {transitionControls.length === 0 && !canRefer && !canArchive ? (
          <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
            {EMPTY}
          </p>
        ) : (
          <div className="admin-lifecycle-actions" role="group" aria-label={a.reqDetail.changeStatus}>
            {transitionControls.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`btn admin-side-btn ${c.danger ? 'btn-danger' : 'btn-outline'}`}
                disabled={saving}
                onClick={() => setPendingTransition(c.pt)}
              >
                <c.Icon size={15} aria-hidden="true" />
                {c.label}
              </button>
            ))}
            {canRefer && (
              <button
                type="button"
                className="btn btn-outline admin-side-btn"
                disabled={saving}
                onClick={openReferDialog}
              >
                <Share2 size={15} aria-hidden="true" />
                {lc.actions.refer}
              </button>
            )}
            {canArchive && (
              <button
                type="button"
                className="btn btn-outline admin-side-btn"
                disabled={saving}
                onClick={() => setPendingTransition({ kind: 'archive' })}
              >
                <Archive size={15} aria-hidden="true" />
                {lc.actions.archive}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Documents (Note 1) — list attachments; each opens a freshly
          minted short-lived signed URL in a new tab. ── */}
      <div
        className="field"
        style={{
          marginBlockStart: 'var(--sp-5)',
          paddingBlockStart: 'var(--sp-5)',
          borderBlockStart: '1px solid var(--hair)',
        }}
      >
        <span
          className="form-label"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBlockEnd: 'var(--sp-2)' }}
        >
          <FileText size={15} aria-hidden="true" style={{ color: 'var(--ember)' }} />
          {lc.docs.heading}
        </span>

        {request.attachments && request.attachments.length > 0 ? (
          <ul className="admin-doc-list">
            {request.attachments.map((doc) => {
              const busy = openingDoc === doc.name
              return (
                <li key={doc.name} className="admin-doc-item">
                  <FileText size={16} aria-hidden="true" className="admin-doc-icon" />
                  <span className="admin-doc-name" title={doc.name}>{doc.name}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm admin-doc-view"
                    disabled={busy}
                    aria-busy={busy || undefined}
                    aria-label={`${lc.docs.view}: ${doc.name}`}
                    onClick={() => viewDoc(doc.name)}
                  >
                    {busy ? lc.docs.opening : lc.docs.view}
                    {!busy && <ExternalLink size={14} aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: 'var(--fs-sm)' }}>
            {lc.docs.empty}
          </p>
        )}
      </div>

      <div
        className="field"
        style={{
          marginBlockStart: 'var(--sp-5)',
          paddingBlockStart: 'var(--sp-5)',
          borderBlockStart: '1px solid var(--hair)',
        }}
      >
        <label
          className="form-label"
          htmlFor="note"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
        >
          <StickyNote size={15} aria-hidden="true" style={{ color: 'var(--ember)' }} />
          {a.reqDetail.addNote}
        </label>
        <textarea
          id="note"
          className="form-textarea"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={a.reqDetail.notePH}
        />
        <button
          type="button"
          className="btn btn-outline admin-side-btn"
          disabled={saving || !note.trim()}
          onClick={handleNote}
        >
          {a.reqDetail.saveNote}
        </button>
      </div>
    </aside>
  )
}
