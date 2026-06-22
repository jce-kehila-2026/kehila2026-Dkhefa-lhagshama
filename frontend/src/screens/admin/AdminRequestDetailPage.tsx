import { useRouter } from 'next/router'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCategories } from '@/hooks/useCategories'
import AdminLayout from '@/components/admin/AdminLayout'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import { ErrorState } from '@/components/admin/AdminUI'
import Reveal from '../../components/motion/Reveal'
import { useRequestDetail } from './request-detail/useRequestDetail'
import RequestSummary from './request-detail/RequestSummary'
import ActionPanel from './request-detail/ActionPanel'
import ReferDialog from './request-detail/ReferDialog'

export default function AdminRequestDetailPage() {
  const { t, isRTL } = useLanguage()
  // Bilingual category labels from the admin-managed taxonomy.
  const { labelFor } = useCategories()
  const router = useRouter()
  const { id } = router.query
  const BackArrow = isRTL ? ArrowRight : ArrowLeft

  const {
    a, lc, m,
    request, volunteers, loading, error, saving, load,
    note, setNote, handleNote,
    dismissedFormer, setDismissedFormer, isFormerVolunteer,
    candidates, candidatesError, candidateSearch, setCandidateSearch,
    filteredCandidates, visibleCandidates, safeIdx, setCandIdx,
    reassigning, setReassigning, assigningUid, assignedCandidate,
    reasonChipLabel, handleAssignCandidate,
    assigningClaim, handleAssignClaim,
    pendingTransition, setPendingTransition, TRANSITION_COPY, runTransition,
    transitionControls, canRefer, canArchive, isTerminal,
    referOpen, setReferOpen, answers, answersLoaded, referAnswerId,
    setReferAnswerId, referNote, setReferNote, referring,
    openReferDialog, resolveBilingual, submitReferral,
    openingDoc, viewDoc,
    EMPTY, fmt, fullName, assignedLabel,
  } = useRequestDetail(id)

  return (
    <AdminLayout title={a.reqDetail.title}>
      <Link
        href="/admin/requests"
        className="admin-back-link"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
      >
        <BackArrow size={16} aria-hidden="true" />
        {a.reqDetail.back}
      </Link>

      {error && (
        <div style={{ marginBlockStart: 'var(--sp-4)' }}>
          <ErrorState message={error} onRetry={() => load()} retryLabel={a.ui.retry} />
        </div>
      )}

      {/* Loading — an intentional skeleton mirroring the final two-column layout */}
      {loading && (
        <div
          className="admin-detail-grid"
          style={{ marginBlockStart: 'var(--sp-5)' }}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">{a.ui.loading}</span>
          <section className="card" style={{ padding: 'var(--sp-5)' }} aria-hidden="true">
            <span className="skeleton skeleton-line" style={{ width: '45%', height: '1.6rem' }} />
            <span className="skeleton skeleton-line" style={{ width: '100%', marginBlockStart: 'var(--sp-4)' }} />
            <span className="skeleton skeleton-line" style={{ width: '92%', marginBlockStart: 'var(--sp-2)' }} />
            <span className="skeleton skeleton-line" style={{ width: '70%', marginBlockStart: 'var(--sp-2)' }} />
            <span className="skeleton skeleton-line" style={{ width: '60%', height: '2.6rem', marginBlockStart: 'var(--sp-5)' }} />
          </section>
          <aside className="card" style={{ padding: 'var(--sp-5)' }} aria-hidden="true">
            <span className="skeleton skeleton-line" style={{ width: '50%' }} />
            <span className="skeleton skeleton-line" style={{ width: '100%', height: '2.6rem', marginBlockStart: 'var(--sp-3)' }} />
            <span className="skeleton skeleton-line" style={{ width: '50%', height: '2.6rem', marginBlockStart: 'var(--sp-5)' }} />
          </aside>
        </div>
      )}

      {/* #91 — assigned volunteer was deactivated; prompt reassignment */}
      {!loading && request && isFormerVolunteer && !dismissedFormer && (
        <div
          className="admin-notice admin-notice-warn"
          role="alert"
          style={{ marginBlockStart: 'var(--sp-4)' }}
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{a.reqDetail.formerVolWarning}</span>
          <button
            type="button"
            className="admin-notice-action"
            onClick={() => setDismissedFormer(true)}
          >
            {a.reqDetail.dismiss}
          </button>
        </div>
      )}

      {!loading && request && (
        <Reveal y={16}>
          <div className="admin-detail-grid" style={{ marginBlockStart: 'var(--sp-5)' }}>
            <RequestSummary
              request={request}
              a={a}
              lc={lc}
              labelFor={labelFor}
              EMPTY={EMPTY}
              fullName={fullName}
              assignedLabel={assignedLabel}
              isFormerVolunteer={isFormerVolunteer}
              fmt={fmt}
              volunteers={volunteers}
              saving={saving}
              assigningClaim={assigningClaim}
              handleAssignClaim={handleAssignClaim}
            />

            <ActionPanel
              request={request}
              a={a}
              lc={lc}
              t={t}
              isRTL={isRTL}
              m={m}
              EMPTY={EMPTY}
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
              transitionControls={transitionControls}
              canRefer={canRefer}
              canArchive={canArchive}
              setPendingTransition={setPendingTransition}
              openReferDialog={openReferDialog}
              openingDoc={openingDoc}
              viewDoc={viewDoc}
              note={note}
              setNote={setNote}
              handleNote={handleNote}
            />
          </div>
        </Reveal>
      )}

      {/* ── Transition confirmation (Note 6) ── */}
      {pendingTransition && (
        <ConfirmDialog
          open
          title={
            transitionControls.find((c) => c.key === pendingTransition.kind)?.label ||
            (pendingTransition.kind === 'archive' ? lc.actions.archive : lc.actions.refer)
          }
          message={TRANSITION_COPY[pendingTransition.kind].confirm}
          confirmLabel={t.common.confirm}
          cancelLabel={t.common.cancel}
          variant={TRANSITION_COPY[pendingTransition.kind].variant}
          busy={saving}
          onConfirm={() => runTransition(pendingTransition)}
          onCancel={() => setPendingTransition(null)}
        />
      )}

      {/* ── Refer to partner dialog (Note 8) — picker over the answers catalog
          + optional note. Reuses the branded confirm surface for consistency. ── */}
      {referOpen && (
        <ReferDialog
          a={a}
          lc={lc}
          t={t}
          referring={referring}
          setReferOpen={setReferOpen}
          answersLoaded={answersLoaded}
          answers={answers}
          referAnswerId={referAnswerId}
          setReferAnswerId={setReferAnswerId}
          referNote={referNote}
          setReferNote={setReferNote}
          resolveBilingual={resolveBilingual}
          submitReferral={submitReferral}
        />
      )}
    </AdminLayout>
  )
}
