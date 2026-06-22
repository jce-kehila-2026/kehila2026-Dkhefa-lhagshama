import Link from "next/link";
import { ChevronDown, Paperclip, Calendar, Tag, MessageCircle } from "lucide-react";

import { useCategories } from "@/hooks/useCategories";
import { formatDate, truncate } from "@/utils/helpers";
import { formatRequestRef } from "@/lib/requestRef";

import { LifecycleStatusPill, DeadlinePill, MetaField } from "./Pills";
import { RequestTimeline } from "./RequestTimeline";
import { ReferralPanel } from "./ReferralPanel";
import { RateExperienceCard } from "./RateExperienceCard";
import type { Translations, RequestRecord } from "./shared";

// ── Request card with expandable timeline ─────────────────────
// req 11 — the collapsed card headlines the CATEGORY (the raw id moves into
// the expanded detail panel) and shows 4 facts: category, status, created,
// deadline. req 12 — the footer carries the attachments indicator + a chat
// shortcut. req 9 — `?focus=<id>` highlights + scrolls to the card.
export function RequestCard({ item, t, lang, expandedId, onToggle, isFocused, focusRef }: {
  item: RequestRecord;
  t: Translations;
  lang: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
  isFocused?: boolean;
  focusRef?: (el: HTMLDivElement | null) => void;
}) {
  const isExpanded = expandedId === item.id;
  // Category labels resolve from the admin-managed taxonomy doc; the static
  // t.myRequests.categories map survives inside labelFor as a legacy fallback.
  const { labelFor } = useCategories();
  const categoryLabel = (cat: string) => labelFor(cat);
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
        className="myreq-card-toggle"
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
            className="myreq-card-chevron"
            data-expanded={isExpanded || undefined}
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
            }}
          >
            <ChevronDown size={16} />
          </span>
        </div>

        {/* Description */}
        <p style={{
          marginBlock: "12px 0",
          color: "var(--ink-2)",
          fontSize: "15px",
          lineHeight: 1.55,
        }}>
          {truncate(item.description || "", 140) || "·"}
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
            {formatDate(item.createdAt, lang) || "·"}
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
            ChatListPage). A chat exists once a volunteer is assigned — which can
            happen while the request is still `pending` (admin /assign creates an
            active chat + system message but does NOT move it out of pending;
            "start" is a separate step). So `pending` is included here too
            (review r6, finding 19): the card no longer hides an active
            conversation. ChatListPage's focusNoChat message handles the case
            where assignment hasn't happened yet, so a chatless pending request
            doesn't dead-end. rejected/referred have no chat and are omitted. */}
        {["pending", "in_progress", "awaiting_review", "closed"].includes(item.status) && (
          <Link
            href={`/chats?requestId=${encodeURIComponent(item.id)}`}
            className="btn btn-ghost btn-sm myreq-card-chat"
            aria-label={mr.openChat}
            title={mr.openChat}
          >
            <MessageCircle size={15} aria-hidden="true" />
            <span className="myreq-card-chat-label">{mr.openChat}</span>
          </Link>
        )}
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div
          id={panelId}
          className="myreq-detail-panel"
          style={{
            padding: "4px 24px 24px",
            background: "var(--sky-3)",
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
                  {formatRequestRef(item)}
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
