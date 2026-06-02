import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  MessageCircle,
  MessagesSquare,
  AlertCircle,
  ShieldOff,
  Send,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { apiFetch } from "../lib/apiClient";
import { useMessages } from "../hooks/useMessages";
import Reveal from "../components/motion/Reveal";

/** A chat participant as returned by GET /api/chats/:id/participants. */
interface ChatParticipant {
  uid: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Initials for the identity avatar — first glyphs of up to two words,
 * falling back to the leading character of the label. Mirrors the pattern
 * used in the admin user/volunteer rosters so avatars look consistent.
 */
function toInitials(label: string | undefined | null): string {
  const s = String(label ?? "").trim();
  if (!s) return "?";
  const parts = s.replace(/[._-]+/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default function ChatWindowPage() {
  const { t, lang, isRTL } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const c = t.chat;
  const router = useRouter();
  const { id: chatId } = router.query;

  // Only attach the listener once auth is resolved AND a user exists,
  // so logged-out visitors never trigger a permission-denied snapshot.
  const listenChatId = !authLoading && user && typeof chatId === "string" ? chatId : null;
  const { messages, loading: msgsLoading, error: msgsError } = useMessages(listenChatId);

  // ── Note 11 — participant identity (photo + name) ──────────────────────
  // Fetch the chat's participants ONCE on open (authenticated, participant-
  // only). Build a senderId → { displayName, avatarUrl } map used to render
  // a real name + photo for both sides; initials fallback when no photo.
  const [participants, setParticipants] = useState<Record<string, ChatParticipant>>({});

  useEffect(() => {
    if (!listenChatId) {
      setParticipants({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/chats/${listenChatId}/participants`);
        if (!res.ok) return; // 403/other — keep the title-only fallback
        const list = (await res.json()) as ChatParticipant[];
        if (cancelled || !Array.isArray(list)) return;
        const map: Record<string, ChatParticipant> = {};
        for (const p of list) {
          if (p && typeof p.uid === "string") map[p.uid] = p;
        }
        setParticipants(map);
      } catch {
        // Network error — leave the map empty; UI degrades to the title.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listenChatId]);

  // The "other" participant (everyone who isn't the signed-in user) — used to
  // headline the conversation with a human name + face.
  const otherParticipant =
    Object.values(participants).find((p) => p.uid !== user?.uid) ?? null;
  const otherName =
    (otherParticipant?.displayName && otherParticipant.displayName.trim()) ||
    c.participantFallback;

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isRtl = lang === "he";
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setSendError("");

    try {
      const res = await apiFetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSendError(body.error ?? "send_failed");
        return;
      }

      setInputText("");
    } catch {
      setSendError("send_failed");
    } finally {
      setSending(false);
    }
  }

  function formatTime(date: Date | null) {
    if (!date) return "";
    return date.toLocaleTimeString(isRtl ? "he-IL" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ── Note 11 — avatar: photo when available, initials circle otherwise ──
  function renderAvatar(name: string, avatarUrl: string | null, size: "sm" | "md") {
    const px = size === "sm" ? 28 : 40;
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={c.avatarAlt(name)}
          width={px}
          height={px}
          className={`chat-avatar chat-avatar--${size}`}
        />
      );
    }
    return (
      <span
        className={`chat-avatar chat-avatar--initials chat-avatar--${size}`}
        role="img"
        aria-label={c.avatarAlt(name)}
      >
        {toInitials(name)}
      </span>
    );
  }

  // ── Shared centred-state shell (loading / empty / error / permission) ──
  interface FeedStateProps {
    icon: ReactNode;
    tone?: "neutral" | "danger" | "muted" | "ember" | string;
    title?: ReactNode;
    body?: ReactNode;
  }
  function renderFeedState({ icon, tone = "neutral", title: stateTitle, body }: FeedStateProps) {
    const ring =
      tone === "danger"
        ? "var(--danger-soft)"
        : tone === "muted"
        ? "var(--gray-100)"
        : "var(--ember-soft)";
    const fg =
      tone === "danger"
        ? "var(--danger)"
        : tone === "muted"
        ? "var(--gray-500)"
        : "var(--ember)";
    const isError = tone === "danger";
    return (
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        style={{
          margin: "auto",
          maxWidth: "26rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "var(--sp-3)",
          paddingBlock: "var(--sp-7)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            borderRadius: "var(--radius-lg)",
            background: ring,
            color: fg,
          }}
        >
          {icon}
        </span>
        {stateTitle && (
          <p
            style={{
              fontFamily: "Frank Ruhl Libre, Georgia, serif",
              fontSize: "var(--fs-h3)",
              color: "var(--ink)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {stateTitle}
          </p>
        )}
        {body && (
          <p style={{ color: "var(--gray-500)", fontSize: "var(--fs-sm)", lineHeight: 1.65, margin: 0 }}>
            {body}
          </p>
        )}
      </div>
    );
  }

  // Auth gate: don't render the chat UI for logged-out users.
  if (!authLoading && !user) {
    return (
      <>
        <div
          className="page-container chat-inline-header"
          style={{ maxWidth: "640px", paddingBlock: "clamp(36px, 5vw, 56px) clamp(20px, 3vw, 28px)" }}
        >
          <header className="chat-inline-header__inner">
            <span className="eyebrow chat-inline-header__eyebrow">{c.inlineHeader.eyebrow}</span>
            <h1 className="chat-inline-header__title">{c.signInRequired}</h1>
          </header>
        </div>
        <div className="page-container" style={{ maxWidth: "640px", paddingBlock: "0 var(--sp-9)" }}>
          <Reveal>
            <div className="card" style={{ padding: "var(--sp-7)", textAlign: "center" }}>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "60px",
                  height: "60px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--ember-soft)",
                  color: "var(--ember)",
                  marginBlockEnd: "var(--sp-4)",
                }}
              >
                <Lock size={26} />
              </span>
              <h2
                style={{
                  fontFamily: "Frank Ruhl Libre, Georgia, serif",
                  fontSize: "var(--fs-h2)",
                  fontWeight: 400,
                  color: "var(--ink)",
                  margin: "0 0 var(--sp-2)",
                  lineHeight: 1.2,
                }}
              >
                {c.signInRequired}
              </h2>
              <p
                style={{
                  color: "var(--gray-500)",
                  margin: "0 auto var(--sp-5)",
                  lineHeight: 1.7,
                  maxWidth: "30rem",
                }}
              >
                {c.signInWindowBody}
              </p>
              <Link href={`/login?next=${encodeURIComponent(router.asPath)}`} className="btn btn-ember">
                {c.signIn}
                <ArrowRight size={16} style={{ transform: isRTL ? "scaleX(-1)" : "none" }} />
              </Link>
            </div>
          </Reveal>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Inline editorial header: eyebrow (Messages) + human title ── */}
      <div
        className="page-container chat-inline-header"
        style={{ maxWidth: "760px", paddingBlock: "clamp(36px, 5vw, 56px) clamp(20px, 3vw, 28px)" }}
      >
        <header className="chat-inline-header__inner chat-inline-header__inner--window">
          <div>
            <span className="eyebrow chat-inline-header__eyebrow">{c.inlineHeader.eyebrow}</span>
            <h1 className="chat-inline-header__title">
              {otherParticipant ? otherName : c.titleFallback}
            </h1>
          </div>
          <Link
            href="/chats"
            className="btn btn-outline btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexShrink: 0 }}
          >
            <BackArrow size={16} />
            {c.allChats.replace(/^[←→]\s*/, "")}
          </Link>
        </header>
      </div>

      <div
        className="page-container"
        style={{
          maxWidth: "760px",
          paddingBlock: "var(--sp-6) var(--sp-9)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-4)",
        }}
      >
        {/* ── Conversation panel: scrolling feed + sticky composer ── */}
        <Reveal>
          <div
            className="card"
            style={{
              padding: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Panel header strip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-3)",
                paddingInline: "var(--sp-5)",
                paddingBlock: "var(--sp-4)",
                borderBlockEnd: "1px solid var(--hair)",
                background: "var(--sky-3)",
              }}
            >
              {otherParticipant ? (
                renderAvatar(otherName, otherParticipant.avatarUrl, "md")
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "40px",
                    height: "40px",
                    borderRadius: "var(--radius)",
                    background: "var(--white)",
                    color: "var(--ember)",
                    border: "1px solid var(--hair)",
                  }}
                >
                  <MessageCircle size={20} />
                </span>
              )}
              <div style={{ textAlign: "start", minWidth: 0 }}>
                <p
                  className="eyebrow"
                  style={{
                    margin: 0,
                    color: "var(--gray-600)",
                  }}
                >
                  {c.inlineHeader.eyebrow}
                </p>
                <p
                  style={{
                    fontFamily: "Frank Ruhl Libre, Georgia, serif",
                    fontSize: "var(--fs-body)",
                    color: "var(--ink)",
                    margin: "3px 0 0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {otherParticipant ? otherName : c.titleFallback}
                </p>
              </div>
            </div>

            {/* Message feed */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                minHeight: "42vh",
                maxHeight: "58vh",
                padding: "var(--sp-5)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--sp-3)",
                background:
                  "linear-gradient(var(--paper), var(--paper)) padding-box",
              }}
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
                const isMine = msg.senderId === user?.uid;
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
                        {renderAvatar(senderName, sender?.avatarUrl ?? null, "sm")}
                      </span>
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isMine ? "flex-end" : "flex-start",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "100%",
                          background: isMine ? "var(--ink)" : "var(--white)",
                          color: isMine ? "var(--cream)" : "var(--gray-700)",
                          border: isMine ? "1px solid var(--ink)" : "1px solid var(--hair)",
                          borderRadius: isMine
                            ? "var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)"
                            : "var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)",
                          padding: "10px 14px",
                          fontSize: "var(--fs-sm)",
                          lineHeight: 1.6,
                          wordBreak: "break-word",
                          boxShadow: isMine ? "var(--shadow-sm)" : "var(--shadow-xs)",
                          direction: isRtl ? "rtl" : "ltr",
                          textAlign: "start",
                        }}
                      >
                        {msg.content}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--fs-xs)",
                          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                          letterSpacing: "0.04em",
                          color: "var(--gray-500)",
                          marginBlockStart: "4px",
                          marginInline: "4px",
                        }}
                      >
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Composer — sticks to the bottom of the panel */}
            <form
              onSubmit={handleSend}
              style={{
                display: "flex",
                gap: "var(--sp-3)",
                alignItems: "center",
                paddingInline: "var(--sp-5)",
                paddingBlock: "var(--sp-4)",
                borderBlockStart: "1px solid var(--hair)",
                background: "var(--white)",
                direction: isRtl ? "rtl" : "ltr",
              }}
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={c.inputPH}
                disabled={sending}
                aria-label={c.inputPH}
                style={{
                  flex: 1,
                  paddingInline: "var(--sp-4)",
                  paddingBlock: "12px",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${inputFocused ? "var(--ember)" : "var(--hair)"}`,
                  background: "var(--paper)",
                  color: "var(--ink)",
                  fontSize: "var(--fs-sm)",
                  outline: "none",
                  boxShadow: inputFocused ? "var(--ring)" : "none",
                  transition: "border-color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)",
                  direction: isRtl ? "rtl" : "ltr",
                  textAlign: "start",
                }}
              />
              <button
                type="submit"
                className="btn btn-ember"
                disabled={sending || !inputText.trim()}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexShrink: 0 }}
              >
                {sending ? c.sending : c.send}
                <Send size={15} style={{ transform: isRTL ? "scaleX(-1)" : "none" }} />
              </button>
            </form>
          </div>
        </Reveal>

        {sendError && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              padding: "12px var(--sp-4)",
              borderRadius: "var(--radius)",
              background: "var(--danger-soft)",
              border: "1px solid var(--danger)",
              color: "var(--danger)",
              fontSize: "var(--fs-sm)",
              direction: isRtl ? "rtl" : "ltr",
              textAlign: "start",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{c.sendError}</span>
          </div>
        )}
      </div>
    </>
  );
}
