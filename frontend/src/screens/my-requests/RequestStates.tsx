import Link from "next/link";
import { AlertCircle, FileText, Plus } from "lucide-react";

import type { Translations } from "./shared";

// ── Loading skeleton (three placeholder cards) ────────────────
export function LoadingSkeleton({ t }: { t: Translations }) {
  return (
    <div aria-busy="true" aria-label={t.myRequests.loading} style={{ display: "grid", gap: "16px" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBlockEnd: "16px" }}>
            <div className="skeleton skeleton-line" style={{ width: "90px", height: "1.2rem" }} />
            <div className="skeleton skeleton-line" style={{ width: "70px", height: "1.2rem" }} />
          </div>
          <div className="skeleton skeleton-line" style={{ width: "85%" }} />
          <div className="skeleton skeleton-line" style={{ width: "55%", marginBlockStart: "8px" }} />
          <div style={{ display: "flex", gap: "20px", marginBlockStart: "20px", paddingBlockStart: "16px", borderBlockStart: "1px solid var(--hair)" }}>
            <div className="skeleton skeleton-line" style={{ width: "22%" }} />
            <div className="skeleton skeleton-line" style={{ width: "22%" }} />
            <div className="skeleton skeleton-line" style={{ width: "22%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Load-error state ──────────────────────────────────────────
export function LoadErrorState({ t }: { t: Translations }) {
  return (
    <div className="card" style={{ padding: "clamp(40px, 6vw, 56px) 32px", textAlign: "center" }}>
      <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--danger-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginInline: "auto", marginBlockEnd: "18px" }}>
        <AlertCircle size={26} color="var(--danger)" />
      </div>
      <h2 style={{ fontFamily: "Frank Ruhl Libre, Georgia, serif", fontSize: "var(--fs-h3)", fontWeight: 500, color: "var(--ink)", marginBlockEnd: "10px" }}>
        {t.myRequests.loadErrorTitle}
      </h2>
      <p style={{ color: "var(--gray-600)", marginBlockEnd: "24px", lineHeight: 1.7, maxWidth: "44ch", marginInline: "auto" }}>
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
    <div className="card" style={{ padding: "clamp(48px, 7vw, 72px) 32px", textAlign: "center" }}>
      <span className="eyebrow" style={{ color: "var(--ember)", display: "block", marginBlockEnd: "16px" }}>
        {t.myRequests.title}
      </span>
      <div aria-hidden="true" style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--sky-2)", display: "flex", alignItems: "center", justifyContent: "center", marginInline: "auto", marginBlockEnd: "20px" }}>
        <FileText size={28} color="var(--ink-2)" />
      </div>
      <h2 style={{ fontFamily: "Frank Ruhl Libre, Georgia, serif", fontSize: "var(--fs-h2)", fontWeight: 500, color: "var(--ink)", lineHeight: 1.2, marginBlockEnd: "12px", textWrap: "balance" }}>
        {t.myRequests.empty}
      </h2>
      <p style={{ color: "var(--gray-600)", marginBlockEnd: "28px", lineHeight: 1.7, maxWidth: "46ch", marginInline: "auto", fontSize: "var(--fs-lede)" }}>
        {t.myRequests.emptyHint}
      </p>
      <Link href="/requests" className="btn btn-ember btn-lg">
        <Plus size={16} aria-hidden="true" />
        {t.myRequests.submitCta}
      </Link>
    </div>
  );
}
