import Link from "next/link";
import { Sparkles, ExternalLink, Phone, Mail, ArrowLeft, ArrowRight, X } from "lucide-react";

import type { CSSProperties } from "react";
import type { Suggestion } from "@/types";
import { safeHref } from "@/lib/safeUrl";
import { pickLang as pickShared } from "@/lib/bilingual";

// ── Suggest-alternatives card (UC-01 A1, simple If-Then) ──────
// Surfaces up to 3 approved community answers for a category. Bilingual text
// fields may be a `{ he, en }` object or a plain string — render the
// active-language value, falling back to whichever exists. Dismissible;
// callers render it only when there is at least one match. Copy strings come
// in as props so the post-submit usage (/my-requests) and the in-form usage
// (request form step 2) can phrase themselves differently.
// Visual classes (`card`, `myreq-suggest-dismiss`) are styled globally in
// src/styles/screens/my-requests.css — do not duplicate them.

// Small monospace eyebrow/label helper (matches MyRequestsPage's labelStyle).
const labelStyle: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gray-500)",
};

function pickLangValue(
  value: Suggestion["title"],
  lang: string,
): string {
  return pickShared(value, lang);
}

export default function SuggestCard({ items, lang, heading, subtitle, openLabel, callLabel, emailLabel, directoryLabel, dismissLabel, onDismiss }: {
  items: Suggestion[];
  lang: string;
  heading: string;
  subtitle: string;
  openLabel: string;
  callLabel: string;
  emailLabel: string;
  /** Fallback CTA when an org has no website/phone/email — links into the
   *  directory pre-filtered to the org's category so the row is never dead. */
  directoryLabel: string;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  // Direction-aware forward arrow: in RTL (Hebrew) the reading direction runs
  // right-to-left, so "forward" points left. Mirrors the convention used in
  // DirectoryPage/RequestsPage (`isRTL ? ArrowLeft : ArrowRight`).
  const DirArrow = lang === "he" ? ArrowLeft : ArrowRight;
  return (
    <div
      className="card"
      style={{
        position: "relative",
        marginBlockEnd: "28px",
        padding: "24px 26px",
        background: "var(--ember-soft)",
        border: "1px solid var(--ember-soft)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <button
        type="button"
        className="myreq-suggest-dismiss"
        onClick={onDismiss}
        aria-label={dismissLabel}
        title={dismissLabel}
        style={{
          appearance: "none",
          position: "absolute",
          insetBlockStart: "14px",
          insetInlineEnd: "14px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          padding: 0,
          border: "none",
          borderRadius: "50%",
          background: "var(--sky-3)",
          color: "var(--gray-500)",
          cursor: "pointer",
        }}
      >
        <X size={16} aria-hidden="true" />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBlockEnd: "4px" }}>
        <Sparkles size={16} color="var(--ember)" aria-hidden="true" />
        <span style={{ ...labelStyle, color: "var(--ember)" }}>{heading}</span>
      </div>
      <p style={{ fontSize: "13.5px", color: "var(--gray-600)", lineHeight: 1.6, maxWidth: "56ch", marginBlockEnd: "16px" }}>
        {subtitle}
      </p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
        {items.slice(0, 3).map((item) => {
          const title = pickLangValue(item.title, lang) || pickLangValue(item.sourceName, lang);
          const source = pickLangValue(item.sourceName, lang);
          // safeHref gates the link to http(s) at render time (defense-in-depth
          // over the server-side scheme validation); non-http renders no link.
          const href = safeHref(item.sourceUrl);
          // Always render whatever contact channels exist (mirrors the directory
          // modal's Call/Email/Visit actions) — a user who prefers to call
          // should be able to even when a website is also present. Both are free
          // strings on the answer.
          const phone = item.phone ? String(item.phone) : "";
          const email = item.email ? String(item.email) : "";
          // No website, phone, or email → fall back to a deep-link into the
          // directory pre-filtered to this org's category (+ org tab) so the row
          // is still actionable instead of being a dead title-only line.
          const hasContact = Boolean(href || phone || email);
          const directoryHref = item.category
            ? `/directory?category=${encodeURIComponent(item.category)}${
                item.orgType === "partner" ? "&tab=partner" : ""
              }`
            : "/directory";
          return (
            <li
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "14px",
                flexWrap: "wrap",
                padding: "12px 14px",
                background: "var(--white)",
                border: "1px solid var(--hair)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>
                  {title || "·"}
                </div>
                {source && source !== title && (
                  <div style={{ fontSize: "12.5px", color: "var(--gray-500)", marginBlockStart: "2px" }}>
                    {source}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ gap: "6px" }}
                  >
                    {openLabel}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
                {/* All available contact channels render (tel:/mailto:), not just
                    when the website is absent. */}
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="btn btn-ghost btn-sm"
                    style={{ gap: "6px" }}
                  >
                    {callLabel}
                    <Phone size={14} aria-hidden="true" />
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="btn btn-ghost btn-sm"
                    style={{ gap: "6px" }}
                  >
                    {emailLabel}
                    <Mail size={14} aria-hidden="true" />
                  </a>
                )}
                {/* No contact channel at all → keep the row actionable with a
                    directory deep-link to the org's category. */}
                {!hasContact && (
                  <Link
                    href={directoryHref}
                    className="btn btn-ghost btn-sm"
                    style={{ gap: "6px" }}
                  >
                    {directoryLabel}
                    <DirArrow size={14} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
