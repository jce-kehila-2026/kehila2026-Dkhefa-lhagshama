import Link from "next/link";
import { Sparkles, ExternalLink, Phone, Mail, ArrowLeft, ArrowRight, X } from "lucide-react";

import type { Suggestion } from "@/types";
import { safeHref } from "@/lib/safeUrl";
import styles from "./SuggestCard.module.css";

// ── Suggest-alternatives card (UC-01 A1, simple If-Then) ──────
// Surfaces up to 3 approved community answers for a category. Bilingual text
// fields may be a `{ he, en }` object or a plain string — render the
// active-language value, falling back to whichever exists. Dismissible;
// callers render it only when there is at least one match. Copy strings come
// in as props so the post-submit usage (/my-requests) and the in-form usage
// (request form step 2) can phrase themselves differently.
// Visual classes (`card`, `myreq-suggest-dismiss`) are styled globally in
// src/styles/screens/my-requests.css — do not duplicate them.

// resolve a bilingual `{ he, en }` field (or plain string) to the active-lang
// string, falling back to he → en → "" so a row never renders blank.
function pickLangValue(
  value: Suggestion["title"],
  lang: string,
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang as "he" | "en"] || value.he || value.en || "";
}

// dismissible card listing up to 3 suggested answers; each row renders its
// available contact CTAs (open/call/email) or a directory deep-link fallback.
// stateless — `onDismiss` lifts visibility control to the caller; all copy
// strings are props so different call sites can phrase the card themselves.
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
    <div className={`card ${styles.card}`}>
      <button
        type="button"
        className={`myreq-suggest-dismiss ${styles.dismiss}`}
        onClick={onDismiss}
        aria-label={dismissLabel}
        title={dismissLabel}
      >
        <X size={16} aria-hidden="true" />
      </button>

      <div className={styles.headRow}>
        <Sparkles size={16} color="var(--ember)" aria-hidden="true" />
        <span className={`${styles.label} ${styles.labelEmber}`}>{heading}</span>
      </div>
      <p className={styles.subtitle}>
        {subtitle}
      </p>

      <ul className={styles.list}>
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
            <li key={item.id} className={styles.item}>
              <div className={styles.itemText}>
                <div className={styles.itemTitle}>
                  {title || "·"}
                </div>
                {source && source !== title && (
                  <div className={styles.itemSource}>
                    {source}
                  </div>
                )}
              </div>
              <div className={styles.actions}>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`btn btn-ghost btn-sm ${styles.action}`}
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
                    className={`btn btn-ghost btn-sm ${styles.action}`}
                  >
                    {callLabel}
                    <Phone size={14} aria-hidden="true" />
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className={`btn btn-ghost btn-sm ${styles.action}`}
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
                    className={`btn btn-ghost btn-sm ${styles.action}`}
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
