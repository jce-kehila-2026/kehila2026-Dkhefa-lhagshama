import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { CheckCircle, ChevronDown, ChevronUp, AlertCircle, FileText, Paperclip, Calendar, Tag, Plus } from "lucide-react";

import StatusBadge from "@/components/data-display/StatusBadge";
import RatingForm from "@/components/forms/RatingForm";
import Reveal from "../components/motion/Reveal";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { apiJson } from "../lib/apiClient";
import { formatDate, truncate } from "../utils/helpers";
import type { CSSProperties, ReactNode } from "react";
import type { CaughtError, TNode } from "@/types";

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
      setError((err as CaughtError)?.detail?.error === "request_not_resolved" ? r.errorNotResolved : r.error);
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
function RequestCard({ item, t, lang, expandedId, onToggle }: {
  item: RequestRecord;
  t: Translations;
  lang: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  const isExpanded = expandedId === item.id;
  const categoryLabel = (cat: string) => t.myRequests.categories[cat] || cat;
  const urgencyLabel  = (urg: string) => t.myRequests.urgencies[urg]  || urg;
  const tbl = t.myRequests.table;
  const attachments = Array.isArray(item.attachmentPaths) ? item.attachmentPaths.length : 0;
  const panelId = `req-panel-${item.id}`;

  return (
    <div
      style={{
        background: "var(--white)",
        border: `1px solid ${isExpanded ? "var(--ember-soft)" : "var(--hair)"}`,
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
        {/* Top line: id + status + chevron */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flexWrap: "wrap" }}>
            <span style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: "12.5px",
              fontWeight: 600,
              color: "var(--ember)",
              letterSpacing: "0.04em",
              background: "var(--ember-soft)",
              padding: "3px 9px",
              borderRadius: "var(--radius-sm)",
            }}>
              {item.id}
            </span>
            <StatusBadge status={item.status} />
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

        {/* Meta grid */}
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
          <MetaField label={tbl.urgency}>
            {urgencyLabel(item.urgency)}
          </MetaField>
          <MetaField icon={<Calendar size={12} aria-hidden="true" />} label={tbl.date}>
            {formatDate(item.createdAt, lang) || "—"}
          </MetaField>
          <MetaField label={tbl.deadline}>
            <DeadlinePill deadline={item.deadline} t={t} />
          </MetaField>
          <MetaField icon={<Paperclip size={12} aria-hidden="true" />} label={tbl.attachments}>
            {attachments}
          </MetaField>
        </div>
      </button>

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
            <RequestTimeline requestId={item.id} t={t} />
            {item.status === "resolved" && (
              <RateExperienceCard requestId={item.id} t={t} />
            )}
          </div>
        </div>
      )}
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

  // #94 — detect ?new=<id> and show success banner
  const newId = (typeof router.query.new === "string" ? router.query.new : null) || null;

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

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

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

      <div className="page-container" style={{ maxWidth: "960px", padding: "clamp(32px, 5vw, 56px) 1.5rem 80px" }}>

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
            {/* Count summary line */}
            <div style={{ ...labelStyle, marginBlockEnd: "18px" }}>
              {items.length} · {t.myRequests.title}
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              {items.map((item, i) => (
                <Reveal key={item.id} delay={Math.min(i * 0.05, 0.3)}>
                  <RequestCard
                    item={item}
                    t={t}
                    lang={lang}
                    expandedId={expandedId}
                    onToggle={handleToggle}
                  />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
