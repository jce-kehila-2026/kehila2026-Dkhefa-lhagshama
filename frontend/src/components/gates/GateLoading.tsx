/**
 * Neutral loading state shown by route gates while auth resolves or while a
 * redirect lands. Centralises the gate's no-flicker placeholder so all gates
 * look identical and a non-permitted user never sees a dead-end flash.
 *
 * props: `label` is the (already-translated HE/EN) status text. it is announced
 * to assistive tech via the sr-only node, while the visual skeleton bar is
 * aria-hidden, so screen readers hear the status and not a decorative shimmer.
 */
export default function GateLoading({ label }: { label: string }) {
  // role=status + aria-live=polite makes the resolving/redirecting state a
  // non-interruptive live region for assistive tech
  return (
    <div className="admin-gate-msg" role="status" aria-live="polite">
      <span className="skeleton skeleton-title" style={{ width: '14rem' }} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
