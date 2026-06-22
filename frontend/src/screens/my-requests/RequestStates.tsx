import Link from "next/link";
import { AlertCircle, FileText, Plus } from "lucide-react";

import type { Translations } from "./shared";
import styles from "./RequestStates.module.css";

// ── Loading skeleton (three placeholder cards) ────────────────
export function LoadingSkeleton({ t }: { t: Translations }) {
  return (
    <div aria-busy="true" aria-label={t.myRequests.loading} className={styles.skeletonGrid}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`card ${styles.skeletonCard}`}>
          <div className={styles.skeletonHeader}>
            <div className={`skeleton skeleton-line ${styles.skeletonBadgeA}`} />
            <div className={`skeleton skeleton-line ${styles.skeletonBadgeB}`} />
          </div>
          <div className={`skeleton skeleton-line ${styles.skeletonTitle}`} />
          <div className={`skeleton skeleton-line ${styles.skeletonSubtitle}`} />
          <div className={styles.skeletonMeta}>
            <div className={`skeleton skeleton-line ${styles.skeletonMetaItem}`} />
            <div className={`skeleton skeleton-line ${styles.skeletonMetaItem}`} />
            <div className={`skeleton skeleton-line ${styles.skeletonMetaItem}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Load-error state ──────────────────────────────────────────
export function LoadErrorState({ t }: { t: Translations }) {
  return (
    <div className={`card ${styles.errorCard}`}>
      <div aria-hidden="true" className={styles.errorIcon}>
        <AlertCircle size={26} color="var(--danger)" />
      </div>
      <h2 className={styles.errorTitle}>
        {t.myRequests.loadErrorTitle}
      </h2>
      <p className={styles.errorBody}>
        {t.myRequests.loadErrorBody}
      </p>
      <button className="btn btn-ember" onClick={() => window.location.reload()}>
        {t.myRequests.refresh}
      </button>
    </div>
  );
}

// ── Empty state (no requests yet) ─────────────────────────────
export function EmptyState({ t }: { t: Translations }) {
  return (
    <div className={`card ${styles.emptyCard}`}>
      <span className={`eyebrow ${styles.emptyEyebrow}`}>
        {t.myRequests.title}
      </span>
      <div aria-hidden="true" className={styles.emptyIcon}>
        <FileText size={28} color="var(--ink-2)" />
      </div>
      <h2 className={styles.emptyTitle}>
        {t.myRequests.empty}
      </h2>
      <p className={styles.emptyBody}>
        {t.myRequests.emptyHint}
      </p>
      <Link href="/requests" className="btn btn-ember btn-lg">
        <Plus size={16} aria-hidden="true" />
        {t.myRequests.submitCta}
      </Link>
    </div>
  );
}
