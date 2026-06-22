import { forwardRef } from "react";
import type { ReactNode } from "react";
import {
  MessagesSquare,
  AlertCircle,
  ShieldOff,
  Loader2,
  FileText,
  Download,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import type { ChatMessage } from "@/hooks/useMessages";
import { ChatAvatar } from "./ChatAvatar";
import { formatBytes } from "./shared";
import type { ChatParticipant } from "./shared";

// ── Shared centred-state shell (loading / empty / error / permission) ──
// Reuses the cross-screen `.chat-state` vocabulary; here it sits centred
// inside the scrolling message feed.
interface FeedStateProps {
  icon: ReactNode;
  tone?: "ember" | "danger" | "muted";
  title?: ReactNode;
  body?: ReactNode;
}
function renderFeedState({ icon, tone = "ember", title: stateTitle, body }: FeedStateProps) {
  const isError = tone === "danger";
  return (
    <div
      className="chat-state chat-state--feed"
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      <span aria-hidden="true" className={`chat-state__icon chat-state__icon--${tone}`}>
        {icon}
      </span>
      {stateTitle && <p className="chat-state__title">{stateTitle}</p>}
      {body && <p className="chat-state__body">{body}</p>}
    </div>
  );
}

interface MessageFeedProps {
  messages: ChatMessage[];
  msgsLoading: boolean;
  msgsError: string | null;
  currentUid: string | undefined;
  participants: Record<string, ChatParticipant>;
  isGroup: boolean;
  isRtl: boolean;
  downloading: Record<string, boolean>;
  onDownload: (att: NonNullable<ChatMessage["attachment"]>) => void;
}

export const MessageFeed = forwardRef<HTMLDivElement, MessageFeedProps>(function MessageFeed(
  {
    messages,
    msgsLoading,
    msgsError,
    currentUid,
    participants,
    isGroup,
    isRtl,
    downloading,
    onDownload,
  },
  feedRef,
) {
  const { t } = useLanguage();
  const c = t.chat;

  function formatTime(date: Date | null) {
    if (!date) return "";
    return date.toLocaleTimeString(isRtl ? "he-IL" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Server system notes carry '[SYSTEM] <marker>' content. Map the known
  // machine-readable markers to localized copy (naming the affected user when
  // we can resolve them); unknown content renders as-is, prefix stripped.
  function systemMessageText(msg: ChatMessage): string {
    const raw = msg.content.startsWith("[SYSTEM]")
      ? msg.content.slice("[SYSTEM]".length).trim()
      : msg.content.trim();
    // Prefer the name denormalized onto the message at write time (survives
    // the user leaving the chat), then the live participants map, then a uid
    // fragment as the last resort.
    const targetName =
      msg.targetName?.trim() ||
      (msg.targetUid
        ? participants[msg.targetUid]?.displayName?.trim() ||
          msg.targetUid.slice(0, 6)
        : null);
    switch (raw) {
      case "chat_created":
        return c.system.chatCreated;
      case "participant_added":
        return c.system.participantAdded(targetName ?? c.participantFallback);
      case "participant_removed":
        return c.system.participantRemoved(targetName ?? c.participantFallback);
      case "chat_paused":
        return c.system.chatPaused;
      case "chat_resumed":
        return c.system.chatResumed;
      case "close_proposed":
        return c.system.closeProposed;
      case "close_approved":
        return c.system.closeApproved;
      case "close_declined":
        return c.system.closeDeclined;
      case "close_closed":
        return c.system.closeClosed;
      default:
        // Legacy assignment note posted by chat-on-assign.
        if (raw.startsWith("A volunteer has been assigned"))
          return c.system.volunteerAssigned;
        return raw;
    }
  }

  return (
    <div
      ref={feedRef}
      className="chat-feed"
      role="log"
      aria-live="polite"
      aria-label={c.inlineHeader.eyebrow}
      tabIndex={0}
    >
      {msgsLoading &&
        renderFeedState({
          tone: "ember",
          icon: <MessagesSquare size={26} />,
          body: c.loadingMessages,
        })}
      {msgsError === "permission" &&
        renderFeedState({
          tone: "muted",
          icon: <ShieldOff size={26} />,
          title: c.noAccess,
        })}
      {msgsError &&
        msgsError !== "permission" &&
        renderFeedState({
          tone: "danger",
          icon: <AlertCircle size={26} />,
          title: c.messagesError,
        })}
      {!msgsLoading &&
        !msgsError &&
        messages.length === 0 &&
        renderFeedState({
          tone: "ember",
          icon: <MessagesSquare size={26} />,
          body: c.noMessages,
        })}

      {messages.map((msg) => {
        // System notes render as a centered muted line, not a bubble.
        if (msg.isSystem) {
          return (
            <div key={msg.id} className="chat-sysmsg">
              {systemMessageText(msg)}
            </div>
          );
        }
        const isMine = msg.senderId === currentUid;
        // Incoming rows show the sender's avatar (photo or initials),
        // keyed by senderId, so the beneficiary sees the volunteer's
        // face next to their words.
        const sender = participants[msg.senderId];
        const senderName =
          (sender?.displayName && sender.displayName.trim()) ||
          c.participantFallback;
        return (
          <div
            key={msg.id}
            className="chat-msg-row"
            style={{
              flexDirection: isMine ? "row-reverse" : "row",
              justifyContent: isMine ? "flex-end" : "flex-start",
            }}
          >
            {!isMine && (
              <span className="chat-msg-row__avatar">
                <ChatAvatar name={senderName} avatarUrl={sender?.avatarUrl ?? null} size="sm" />
              </span>
            )}
            <div className={`chat-msg-col${isMine ? " chat-msg-col--mine" : ""}`}>
              {/* Group chats: name the sender above incoming bubbles
                  so two avatar-less senders stay distinguishable. */}
              {!isMine && isGroup && (
                <span className="chat-sender-name">{senderName}</span>
              )}
              {msg.attachment ? (
                // req 26 — downloadable file bubble (mine + incoming).
                <button
                  type="button"
                  className={`chat-file-bubble${
                    isMine ? " chat-file-bubble--mine" : ""
                  }`}
                  onClick={() => onDownload(msg.attachment!)}
                  disabled={!!downloading[msg.attachment.name]}
                  aria-busy={!!downloading[msg.attachment.name]}
                  aria-label={`${c.download} - ${msg.attachment.name}`}
                  title={msg.attachment.name}
                  style={{ direction: isRtl ? "rtl" : "ltr" }}
                >
                  <span className="chat-file-bubble__icon" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                  <span className="chat-file-bubble__meta">
                    <span className="chat-file-bubble__name">
                      {msg.attachment.name}
                    </span>
                    <span className="chat-file-bubble__sub">
                      {formatBytes(msg.attachment.size)}
                    </span>
                  </span>
                  <span className="chat-file-bubble__action" aria-hidden="true">
                    {downloading[msg.attachment.name] ? (
                      <Loader2 size={16} className="chat-file-bubble__spin" />
                    ) : (
                      <Download size={16} />
                    )}
                  </span>
                </button>
              ) : (
                <div
                  className={`chat-bubble ${isMine ? "chat-bubble--mine" : "chat-bubble--in"}`}
                  style={{ direction: isRtl ? "rtl" : "ltr" }}
                >
                  {msg.content}
                </div>
              )}
              <div className="chat-time">{formatTime(msg.timestamp)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
