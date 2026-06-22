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
import styles from "./RequestCard.module.css";

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
        `${styles.card} ` +
        (isArchived ? "myreq-card myreq-card-archived" : "myreq-card") +
        (isFocused ? " myreq-card-focused" : "")
      }
      style={{
        border: `1px solid ${isFocused ? "var(--ember)" : isExpanded ? "var(--ember-soft)" : "var(--hair)"}`,
        boxShadow: isExpanded ? "var(--shadow)" : "var(--shadow-xs)",
      }}
    >
      {/* Header — the whole bar is the toggle */}
      <button
        type="button"
        className={`myreq-card-toggle ${styles.toggle}`}
        onClick={() => onToggle(item.id)}
        aria-expanded={isExpanded}
        aria-controls={panelId}
      >
        {/* Top line: category (req 11) + status + chevron */}
        <div className={styles.topLine}>
          <div className={styles.topLineMain}>
            <span className={styles.category}>
              <Tag size={15} aria-hidden="true" className={styles.categoryIcon} />
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
            className={`myreq-card-chevron ${styles.chevron}`}
            data-expanded={isExpanded || undefined}
            style={{
              background: isExpanded ? "var(--ember-soft)" : "var(--sky-3)",
              color: isExpanded ? "var(--ember-700)" : "var(--gray-500)",
            }}
          >
            <ChevronDown size={16} />
          </span>
        </div>

        {/* Description */}
        <p className={styles.description}>
          {truncate(item.description || "", 140) || "·"}
        </p>

        {/* Meta grid — 4 collapsed facts (req 11): category, status, created, deadline */}
        <div className={styles.metaGrid}>
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
          className={`myreq-detail-panel ${styles.detailPanel}`}
        >
          <div className={styles.detailInner}>
            {/* req 11 — raw id + urgency live in the detail panel now */}
            <div className="myreq-detail-meta">
              <MetaField label={mr.requestId}>
                <span className={styles.requestRef}>
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
