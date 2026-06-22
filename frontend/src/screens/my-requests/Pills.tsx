import { Calendar } from "lucide-react";

import type { ReactNode } from "react";

import { STATUS_TONE } from "./shared";
import type { Translations } from "./shared";
import styles from "./Pills.module.css";

// ── Lifecycle status pill (Notes 6, 8) ───────────────────────
export function LifecycleStatusPill({ status, t }: { status: string; t: Translations }) {
  const label = t.lifecycle.statusLabels[status] || status;
  const tone = STATUS_TONE[status] || STATUS_TONE.pending;
  return (
    <span className={styles.statusPill} style={{ background: tone.bg, color: tone.fg }}>
      {label}
    </span>
  );
}

// ── Deadline pill (#68) ───────────────────────────────────────
export function DeadlinePill({ deadline, t }: { deadline?: string | null; t: Translations }) {
  if (!deadline) return <span className={styles.empty} aria-hidden="true">·</span>;
  const days = Math.round((new Date(deadline).getTime() - Date.now()) / 86400000);
  const overdue = days < 0;
  const label = t.myRequests.dueIn(days);
  const tone = overdue ? "danger" : days <= 3 ? "warning" : "info";
  const palette = {
    danger:  { bg: "var(--danger-soft)",  fg: "var(--danger)" },
    warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
    info:    { bg: "var(--sky-2)",        fg: "var(--ink-2)" },
  }[tone];
  return (
    <span className={styles.deadlinePill} style={{ background: palette.bg, color: palette.fg }}>
      <Calendar size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

// ── Field with monospace label + value (card meta) ────────────
export function MetaField({ icon, label, children }: { icon?: ReactNode; label: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.metaField}>
      <div className={styles.metaLabel}>
        {icon}
        {label}
      </div>
      <div className={styles.metaValue}>
        {children}
      </div>
    </div>
  );
}
