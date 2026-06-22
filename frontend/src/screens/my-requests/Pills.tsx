import { Calendar } from "lucide-react";

import type { ReactNode } from "react";

import { labelStyle, STATUS_TONE } from "./shared";
import type { Translations } from "./shared";

// ── Lifecycle status pill (Notes 6, 8) ───────────────────────
export function LifecycleStatusPill({ status, t }: { status: string; t: Translations }) {
  const label = t.lifecycle.statusLabels[status] || status;
  const tone = STATUS_TONE[status] || STATUS_TONE.pending;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 600,
      background: tone.bg,
      color: tone.fg,
    }}>
      {label}
    </span>
  );
}

// ── Deadline pill (#68) ───────────────────────────────────────
export function DeadlinePill({ deadline, t }: { deadline?: string | null; t: Translations }) {
  if (!deadline) return <span style={{ color: "var(--gray-400)" }} aria-hidden="true">·</span>;
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
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 600,
      background: palette.bg,
      color: palette.fg,
    }}>
      <Calendar size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

// ── Field with monospace label + value (card meta) ────────────
export function MetaField({ icon, label, children }: { icon?: ReactNode; label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "6px", marginBlockEnd: "5px" }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: "14px", color: "var(--ink)", fontWeight: 500 }}>
        {children}
      </div>
    </div>
  );
}
