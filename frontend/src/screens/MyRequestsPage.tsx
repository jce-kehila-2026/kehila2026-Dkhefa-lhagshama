import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle, ChevronDown, ChevronUp, AlertCircle, FileText, Paperclip, Calendar, Tag, Plus, Sparkles, ExternalLink, X, MessageCircle } from "lucide-react";

import RatingForm from "@/components/forms/RatingForm";
import Reveal from "../components/motion/Reveal";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { apiJson } from "../lib/apiClient";
import { formatDate, truncate } from "../utils/helpers";
import type { CSSProperties, ReactNode } from "react";
import type { CaughtError, TNode, Referral, Suggestion } from "@/types";

// `t` is the bilingual translation table — consumed via dynamic key lookups
// (`t.myRequests.categories[cat]`, `tl.types[ev.type]`), so use the loose
// `TNode` view rather than the precise per-key context type.
type Translations = TNode;

// A request record / timeline event as returned by the API: loose JSON shapes,
// narrowed to the fields actually read at the call sites below.
interface RequestRecord {
  id: string;
  status: string;
  description?: string;
  category: string;
  urgency: string;
  createdAt?: string;
  deadline?: string | null;
  attachmentPaths?: string[];
  /** Embedded attachment metadata (Note 1) — fall back to count when present. */
  attachments?: { name: string }[];
  /** Archived flag — archived requests are grouped as "past" (Note 6). */
  archived?: boolean;
  /** Partner referral, set when status === 'referred' (Note 8). */
  referral?: Referral;
}
interface TimelineEvent {
  id?: string | number;
  type: string;
  createdAt?: string;
}

// ── Small monospace eyebrow/label helper ──────────────────────
const labelStyle: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gray-500)",
};

// ── Lifecycle status pill (Notes 6, 8) ───────────────────────
// Renders the canonical request statuses with the bilingual lifecycle
// status-label keys (incl. awaiting_review / closed / rejected / referred).
// Colour comes from existing editorial tokens only — no new colours.
const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending:         { bg: "var(--sky-2)",      fg: "var(--ink-2)" },
  in_progress:     { bg: "var(--warning-soft)", fg: "var(--warning)" },
  awaiting_review: { bg: "var(--ember-soft)", fg: "var(--ember-700)" },
  closed:          { bg: "var(--success-soft)", fg: "var(--success)" },
  rejected:        { bg: "var(--danger-soft)", fg: "var(--danger)" },
  referred:        { bg: "var(--ember-soft)", fg: "var(--ember-700)" },
};

function LifecycleStatusPill({ status, t }: { status: string; t: Translations }) {
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
function DeadlinePill({ deadline, t }: { deadline?: string | null; t: Translations }) {
  if (!deadline) return <span style={{ color: "var(--gray-400)" }}>—</span>;
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

// ── Request Timeline (#68) ────────────────────────────────────
function RequestTimeline({ requestId, t }: { requestId: string; t: Translations }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null); // null = loading, [] = empty
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    apiJson<{ events?: TimelineEvent[] }>(`/api/requests/${requestId}/events`)
      .then((data) => { if (alive) setEvents(Array.isArray(data.events) ? data.events : []); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [requestId]);

  const tl = t.myRequests.timeline;

  if (error) return null;
  if (events === null) {
    return (
      <div style={{ padding: "12px 0", color: "var(--gray-400)", fontSize: "13px" }}>
        {t.common.loading}
      </div>
    );
  }

  return (
    <div style={{ marginBlockStart: "4px" }}>
      <div style={{ ...labelStyle, marginBlockEnd: "14px" }}>
        {tl.title}
      </div>
      {events.length === 0 ? (
        <div style={{ color: "var(--gray-500)", fontSize: "13px" }}>{tl.noEvents}</div>
      ) : (
        <ol className="timeline">
          {events.map((ev: TimelineEvent, i: number) => {
            const typeLabel = tl.types[ev.type] || ev.type;
            const dateStr = ev.createdAt ? formatDate(ev.createdAt, t.lang) : "";
            const isLast = i === events.length - 1;
            return (
              <li key={ev.id} className="timeline-item">
                {!isLast && <span className="timeline-rail" aria-hidden="true" />}
                <span className="timeline-dot" aria-hidden="true" />
                <div style={{ flex: 1, paddingBlockStart: "1px" }}>
                  <div className="timeline-title">{typeLabel}</div>
                  {dateStr && <div className="timeline-time">{dateStr}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ── Referral panel (Note 8) ───────────────────────────────────
// When a request is `referred`, surface the partner + contact to the
// beneficiary as a timeline event. Partner name + optional note + contact
// come from `request.referral`; all copy via the lifecycle.referral keys.
function ReferralPanel({ referral, t }: { referral: Referral; t: Translations }) {
  const rf = t.lifecycle.referral;
  const partner = referral.partnerName || "";
  const contact = [
    (referral as { phone?: string }).phone,
    (referral as { website?: string }).website,
    (referral as { email?: string }).email,
  ].filter(Boolean) as string[];

  return (
    <div className="referral-panel" role="group" aria-label={rf.timelineTitle(partner)}>
      <div className="referral-panel-head">
        <span className="referral-panel-dot" aria-hidden="true" />
        <div className="referral-panel-title">{rf.timelineTitle(partner)}</div>
      </div>
      {referral.referredAt && (
        <div className="referral-panel-time">{formatDate(referral.referredAt, t.lang)}</div>
      )}
      <p className="referral-panel-line">{rf.contactLine}</p>
      {referral.note && <p className="referral-panel-note">{referral.note}</p>}
      {contact.length > 0 && (
        <div className="referral-panel-contact">
          <div style={labelStyle}>{rf.contactLabel}</div>
          <ul className="referral-panel-contact-list">
            {contact.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Rate-your-experience card (#80) ───────────────────────────
function RateExperienceCard({ requestId, t }: { requestId: string; t: Translations }) {
  const r = t.ratings;
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<{ stars?: number } | null>(null); // null = unknown, {} = none

  // Check whether this request was already rated.
  useEffect(() => {
    let alive = true;
    apiJson<{ stars?: number }>(`/api/ratings/${requestId}`)
      .then((data) => { if (alive) setExisting(data); })
      .catch(() => { if (alive) setExisting({}); });
    return () => { alive = false; };
  }, [requestId]);

  const handleSubmit = async (stars: number, comment: string) => {
    setSubmitting(true);
    setError("");
    try {
      await apiJson("/api/ratings", {
        method: "POST",
        body: JSON.stringify({ requestId, stars, comment }),
      });
      setDone(true);
    } catch (err) {
      // Rating is only allowed once the request is `closed` (Note 6 — the
      // trigger moved off the retired `resolved` status). Accept either
      // backend error code so the "can only rate handled requests" message
      // shows regardless of the backend's exact wording.
      const code = (err as CaughtError)?.detail?.error;
      const notReady = code === "request_not_resolved" || code === "request_not_closed";
      setError(notReady ? r.errorNotResolved : r.error);
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyRated = done || (existing && typeof existing.stars === "number");

  return (
    <div
      style={{
        marginBlockStart: "20px",
        padding: "22px 24px",
        background: "linear-gradient(180deg, var(--white), var(--ember-soft) 380%)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div style={{
        fontFamily: "Frank Ruhl Libre, Georgia, serif",
        fontSize: "1.15rem",
        fontWeight: 500,
        color: "var(--ink)",
        marginBlockEnd: "6px",
      }}>
        {r.cardTitle}
      </div>
      {alreadyRated ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--success)", fontSize: "14px", fontWeight: 600 }}>
          <CheckCircle size={16} aria-hidden="true" /> {r.thanks}
        </div>
      ) : (
        <>
          <p style={{ fontSize: "13px", color: "var(--gray-600)", marginBlockEnd: "16px", lineHeight: 1.6, maxWidth: "52ch" }}>
            {r.cardSubtitle}
          </p>
          <RatingForm onSubmit={handleSubmit} submitting={submitting} />
          {error && <div className="form-error" style={{ marginBlockStart: 10 }}><span>{error}</span></div>}
        </>
      )}
    </div>
  );
}

// ── Field with monospace label + value (card meta) ────────────
function MetaField({ icon, label, children }: { icon?: ReactNode; label: ReactNode; children: ReactNode }) {
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

// ── Request card with expandable timeline ─────────────────────
// req 11 — the collapsed card headlines the CATEGORY (the raw id moves into
// the expanded detail panel) and shows 4 facts: category, status, created,
// deadline. req 12 — the footer carries the attachments indicator + a chat
// shortcut. req 9 — `?focus=<id>` highlights + scrolls to the card.
function RequestCard({ item, t, lang, expandedId, onToggle, isFocused, focusRef }: {
  item: RequestRecord;
  t: Translations;
  lang: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
  isFocused?: boolean;
  focusRef?: (el: HTMLDivElement | null) => void;
}) {
  const isExpanded = expandedId === item.id;
  const categoryLabel = (cat: string) => t.myRequests.categories[cat] || cat;
  const urgencyLabel  = (urg: string) => t.myRequests.urgencies[urg]  || urg;
  const tbl = t.myRequests.table;
  const mr = t.myRequests;
  const attachments = Array.isArray(item.attachments)
    ? item.attachments.length
    : Array.isArray(item.attachmentPaths)
      ? item.attachmentPaths.length
      : 0;
  const panelId = `req-panel-${item.id}`;
  const isArchived = item.archived === true;

  return (
    <div
      ref={focusRef}
      className={
        (isArchived ? "myreq-card myreq-card-archived" : "myreq-card") +
        (isFocused ? " myreq-card-focused" : "")
      }
      style={{
        background: "var(--white)",
        border: `1px solid ${isFocused ? "var(--ember)" : isExpanded ? "var(--ember-soft)" : "var(--hair)"}`,
        borderRadius: "var(--radius-lg)",
        boxShadow: isExpanded ? "var(--shadow)" : "var(--shadow-xs)",
        overflow: "hidden",
        transition: "box-shadow var(--dur-2) var(--ease-out), border-color var(--dur-2) var(--ease-out)",
      }}
    >
      {/* Header — the whole bar is the toggle */}
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        style={{
          // NOTE: do not use `all: unset` here — it resets `outline` to
          // `none` inline, which beats the global `*:focus-visible` ring on
          // specificity and leaves keyboard users with no visible focus.
          // Reset only what we need and let the global ember ring apply.
          appearance: "none",
          margin: 0,
          background: "none",
          border: "none",
          borderRadius: "inherit",
          font: "inherit",
          color: "inherit",
          boxSizing: "border-box",
          display: "block",
          width: "100%",
          cursor: "pointer",
          padding: "20px 24px",
          textAlign: "start",
        }}
      >
        {/* Top line: category (req 11) + status + chevron */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              fontFamily: "Frank Ruhl Libre, Georgia, serif",
              fontSize: "1.05rem",
              fontWeight: 500,
              color: "var(--ink)",
            }}>
              <Tag size={15} aria-hidden="true" style={{ color: "var(--ember)" }} />
              {categoryLabel(item.category)}
            </span>
            <LifecycleStatusPill status={item.status} t={t} />
            {isArchived && (
              <span className="myreq-archived-badge">{t.lifecycle.archivedBadge}</span>
            )}
            {isFocused && (
              <span className="myreq-focused-badge">{mr.focusedBadge}</span>
            )}
          </div>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: isExpanded ? "var(--ember-soft)" : "var(--sky-3)",
              color: isExpanded ? "var(--ember-700)" : "var(--gray-500)",
              flexShrink: 0,
              transition: "background var(--dur-2) var(--ease-out)",
            }}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>

        {/* Description */}
        <p style={{
          marginBlock: "12px 0",
          color: "var(--ink-2)",
          fontSize: "15px",
          lineHeight: 1.55,
        }}>
          {truncate(item.description || "", 140) || "—"}
        </p>

        {/* Meta grid — 4 collapsed facts (req 11): category, status, created, deadline */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "16px 20px",
          marginBlockStart: "18px",
          paddingBlockStart: "16px",
          borderBlockStart: "1px solid var(--hair)",
        }}>
          <MetaField icon={<Tag size={12} aria-hidden="true" />} label={tbl.category}>
            {categoryLabel(item.category)}
          </MetaField>
          <MetaField label={tbl.status}>
            <LifecycleStatusPill status={item.status} t={t} />
          </MetaField>
          <MetaField icon={<Calendar size={12} aria-hidden="true" />} label={tbl.date}>
            {formatDate(item.createdAt, lang) || "—"}
          </MetaField>
          <MetaField label={tbl.deadline}>
            <DeadlinePill deadline={item.deadline} t={t} />
          </MetaField>
        </div>
      </button>

      {/* Card footer — attachments indicator + chat shortcut (req 12).
          Kept outside the toggle button so the chat link isn't nested in
          another interactive element. */}
      <div className="myreq-card-footer">
        <span className="myreq-card-files" title={tbl.attachments}>
          <Paperclip size={14} aria-hidden="true" />
          {attachments} {tbl.attachments}
        </span>
        {/* req 12 — chat link sits at the logical end (right in LTR) of the
            files indicator. Resolves the chat via ?requestId= (handled by
            ChatListPage). */}
        <Link
          href={`/chats?requestId=${encodeURIComponent(item.id)}`}
          className="btn btn-ghost btn-sm myreq-card-chat"
          aria-label={mr.openChat}
          title={mr.openChat}
        >
          <MessageCircle size={15} aria-hidden="true" />
          <span className="myreq-card-chat-label">{mr.openChat}</span>
        </Link>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div
          id={panelId}
          style={{
            padding: "4px 24px 24px",
            background: "linear-gradient(180deg, var(--sky-3), var(--white) 60%)",
            borderBlockStart: "1px solid var(--hair)",
          }}
        >
          <div style={{ paddingBlockStart: "20px" }}>
            {/* req 11 — raw id + urgency live in the detail panel now */}
            <div className="myreq-detail-meta">
              <MetaField label={mr.requestId}>
                <span style={{
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--ember-700)",
                  letterSpacing: "0.04em",
                }}>
                  {item.id}
                </span>
              </MetaField>
              <MetaField label={tbl.urgency}>
                {urgencyLabel(item.urgency)}
              </MetaField>
            </div>
            <RequestTimeline requestId={item.id} t={t} />
            {item.status === "referred" && item.referral && (
              <ReferralPanel referral={item.referral} t={t} />
            )}
            {item.status === "closed" && (
              <RateExperienceCard requestId={item.id} t={t} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suggest-alternatives card (UC-01 A1, simple If-Then) ──────
// After a beneficiary submits (?new=<id>), surface up to 3 approved community
// answers in the SAME category. Bilingual text fields may be a `{ he, en }`
// object or a plain string — render the active-language value, falling back to
// whichever exists. Dismissible; renders nothing when there are no matches.
function pickLangValue(
  value: Suggestion["title"],
  lang: string,
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang as "he" | "en"] || value.he || value.en || "";
}

function SuggestCard({ items, lang, t, onDismiss }: {
  items: Suggestion[];
  lang: string;
  t: Translations;
  onDismiss: () => void;
}) {
  const s = t.myRequests.suggest;
  return (
    <div
      className="card"
      style={{
        position: "relative",
        marginBlockEnd: "28px",
        padding: "24px 26px",
        background: "linear-gradient(180deg, var(--white), var(--ember-soft) 420%)",
        border: "1px solid var(--ember-soft)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label={s.dismiss}
        title={s.dismiss}
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
        <span style={{ ...labelStyle, color: "var(--ember)" }}>{s.heading}</span>
      </div>
      <p style={{ fontSize: "13.5px", color: "var(--gray-600)", lineHeight: 1.6, maxWidth: "56ch", marginBlockEnd: "16px" }}>
        {s.subtitle}
      </p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
        {items.slice(0, 3).map((item) => {
          const title = pickLangValue(item.title, lang) || pickLangValue(item.sourceName, lang);
          const source = pickLangValue(item.sourceName, lang);
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
                  {title || "—"}
                </div>
                {source && source !== title && (
                  <div style={{ fontSize: "12.5px", color: "var(--gray-500)", marginBlockStart: "2px" }}>
                    {source}
                  </div>
                )}
              </div>
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ flexShrink: 0, gap: "6px" }}
                >
                  {s.open}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function MyRequestsPage() {
  const { t: tRaw, lang } = useLanguage();
  const t = tRaw as unknown as Translations;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Suggest-alternatives (UC-01 A1) — community answers in the new request's
  // category. Dismissible; only shown when there's at least one match.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestDismissed, setSuggestDismissed] = useState(false);

  // #94 — detect ?new=<id> and show success banner
  const newId = (typeof router.query.new === "string" ? router.query.new : null) || null;

  // req 9 — ?focus=<id> arrives from the chat window's "open request" link;
  // scroll to + highlight the matching card.
  const focusId = (typeof router.query.focus === "string" ? router.query.focus : null) || null;
  const focusCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent("/my-requests")}`);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;

    let alive = true;
    const loadRequests = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiJson("/api/requests/mine") as { items?: RequestRecord[] };
        if (!alive) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        // Auto-expand the newly submitted request so the user sees it (#94)
        if (newId) setExpandedId(newId);
      } catch (err) {
        if (!alive) return;
        if ((err as CaughtError)?.status === 401) {
          router.replace(`/login?next=${encodeURIComponent("/my-requests")}`);
          return;
        }
        setError((err as CaughtError)?.status === 404 ? "not_found" : "load_failed");
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadRequests();
    return () => { alive = false; };
  }, [authLoading, user, router, newId]);

  // After the requests load, if we arrived via ?new=<id>, look up that
  // request's category and fetch up to 3 approved community answers in the
  // same category (public endpoint). Dismissal is handled locally below.
  useEffect(() => {
    if (!newId || items.length === 0) return;
    const fresh = items.find((it) => it.id === newId);
    const category = fresh?.category;
    if (!category) return;

    let alive = true;
    apiJson<{ items?: Suggestion[] }>(`/api/suggestions?category=${encodeURIComponent(category)}`)
      .then((data) => { if (alive) setSuggestions(Array.isArray(data.items) ? data.items : []); })
      .catch(() => { if (alive) setSuggestions([]); });
    return () => { alive = false; };
  }, [newId, items]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // req 9 — once the focused request is present, expand + scroll to it.
  useEffect(() => {
    if (!focusId || loading) return;
    if (!items.some((it) => it.id === focusId)) return;
    setExpandedId(focusId);
    const el = focusCardRef.current;
    if (el) {
      // Defer so the expand has laid out before we scroll.
      const id = window.setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      return () => window.clearTimeout(id);
    }
  }, [focusId, loading, items]);

  // Active vs. archived split — archived requests stay visible to their owner
  // but are grouped/de-emphasized as "past" rather than hidden (Note 6).
  const activeItems = items.filter((it) => it.archived !== true);
  const archivedItems = items.filter((it) => it.archived === true);

  // req 10 — group active requests into 3 kanban-style status columns.
  const COLUMN_DEFS: { key: "open" | "inProgress" | "done"; statuses: string[] }[] = [
    { key: "open",       statuses: ["pending", "referred"] },
    { key: "inProgress", statuses: ["in_progress", "awaiting_review"] },
    { key: "done",       statuses: ["closed", "rejected"] },
  ];
  const columns = COLUMN_DEFS.map((def) => ({
    key: def.key,
    title: t.myRequests.columns[def.key],
    items: activeItems.filter((it) => def.statuses.includes(it.status)),
  }));

  return (
    <>
      {/* ── COMPACT INLINE HEADER — eyebrow → serif title → lede + CTA (start-aligned) ── */}
      <section className="myreq-header">
        <div className="page-container myreq-header-container">
          <Reveal>
            <div className="myreq-header-inner">
              <div className="myreq-header-copy">
                <span className="eyebrow myreq-header-eyebrow">{t.myRequests.inlineHeader.eyebrow}</span>
                <h1 className="section-display-bold myreq-header-title">{t.myRequests.inlineHeader.title}</h1>
                <p className="section-lede myreq-header-lede">{t.myRequests.inlineHeader.lede}</p>
              </div>
              <Link href="/requests" className="btn btn-ember myreq-header-cta">
                <Plus size={16} aria-hidden="true" />
                {t.myRequests.submitCta}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="page-container" style={{ maxWidth: "1180px", padding: "clamp(32px, 5vw, 56px) 1.5rem 80px" }}>

        {/* UC-01 A1 — suggest-alternatives card (dismissible, top of page) */}
        {!suggestDismissed && suggestions.length > 0 && (
          <Reveal>
            <SuggestCard
              items={suggestions}
              lang={lang}
              t={t}
              onDismiss={() => setSuggestDismissed(true)}
            />
          </Reveal>
        )}

        {/* #94 — New-request success banner */}
        {newId && !loading && (
          <Reveal>
            <div className="form-banner form-banner-success" style={{ marginBlockEnd: "28px", alignItems: "flex-start" }}>
              <CheckCircle size={18} aria-hidden="true" />
              <div>
                <div style={{ fontWeight: 700 }}>{t.stream2.newRequestBadge}</div>
                <div style={{ fontSize: "12.5px", fontWeight: 500, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', marginBlockStart: "2px" }}>
                  {newId}
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {loading || authLoading ? (
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
        ) : error ? (
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
        ) : items.length === 0 ? (
          <Reveal>
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
          </Reveal>
        ) : (
          <>
            {/* Active requests — archived ones are grouped separately below */}
            <div style={{ ...labelStyle, marginBlockEnd: "18px" }}>
              {activeItems.length} · {t.myRequests.title}
            </div>

            {/* req 10 — kanban-style status columns. CSS collapses the grid to
                a single column (stacked sections) on narrow screens. */}
            <div className="myreq-board">
              {columns.map((col) => (
                <section key={col.key} className="myreq-col" aria-label={col.title}>
                  <div className="myreq-col-head">
                    <h2 className="myreq-col-title" style={labelStyle}>{col.title}</h2>
                    <span className="myreq-col-count">{col.items.length}</span>
                  </div>
                  <div className="myreq-col-body">
                    {col.items.length === 0 ? (
                      <p className="myreq-col-empty">{t.myRequests.columns.empty}</p>
                    ) : (
                      col.items.map((item, i) => (
                        <Reveal key={item.id} delay={Math.min(i * 0.05, 0.3)}>
                          <RequestCard
                            item={item}
                            t={t}
                            lang={lang}
                            expandedId={expandedId}
                            onToggle={handleToggle}
                            isFocused={focusId === item.id}
                            focusRef={focusId === item.id ? (el) => { focusCardRef.current = el; } : undefined}
                          />
                        </Reveal>
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>

            {/* Past / archived requests — de-emphasized, not hidden (Note 6) */}
            {archivedItems.length > 0 && (
              <section className="myreq-archived-group" aria-label={t.lifecycle.archivedLabel}>
                <h2 className="myreq-archived-heading" style={labelStyle}>
                  {t.lifecycle.archivedLabel}
                </h2>
                <div style={{ display: "grid", gap: "16px" }}>
                  {archivedItems.map((item, i) => (
                    <Reveal key={item.id} delay={Math.min(i * 0.05, 0.3)}>
                      <RequestCard
                        item={item}
                        t={t}
                        lang={lang}
                        expandedId={expandedId}
                        onToggle={handleToggle}
                        isFocused={focusId === item.id}
                        focusRef={focusId === item.id ? (el) => { focusCardRef.current = el; } : undefined}
                      />
                    </Reveal>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
