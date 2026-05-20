import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { apiFetch } from "../lib/apiClient";
import { useMessages } from "../hooks/useMessages";

export default function ChatWindowPage() {
  const { lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id: chatId } = router.query;

  // Only attach the listener once auth is resolved AND a user exists,
  // so logged-out visitors never trigger a permission-denied snapshot.
  const listenChatId = !authLoading && user && typeof chatId === "string" ? chatId : null;
  const { messages, loading: msgsLoading, error: msgsError } = useMessages(listenChatId);

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef(null);

  const isRtl = lang === "he";

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function handleSend(e) {
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

  function formatTime(date) {
    if (!date) return "";
    return date.toLocaleTimeString(isRtl ? "he-IL" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const title = isRtl ? "שיחה" : "Chat";

  // Auth gate: don't render the chat UI for logged-out users.
  if (!authLoading && !user) {
    return (
      <>
        <PageHeader title={title} subtitle="" />
        <div className="page-container" style={{ maxWidth: "760px", padding: "32px 1.5rem 72px" }}>
          <div className="card" style={{ padding: "34px", textAlign: "center" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--ink)", marginBottom: "10px" }}>
              {isRtl ? "כניסה נדרשת" : "Sign in required"}
            </h2>
            <p style={{ color: "var(--gray-500)", marginBottom: "22px", lineHeight: 1.7 }}>
              {isRtl
                ? "כדי לפתוח את השיחה הזו, יש להתחבר תחילה."
                : "You need to be signed in to open this chat."}
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(router.asPath)}`}
              className="btn btn-primary"
            >
              {isRtl ? "התחבר/י" : "Sign in"}
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={title} subtitle={typeof chatId === "string" ? chatId : ""}>
        <div style={{ marginTop: "12px" }}>
          <Link href="/chats" className="btn btn-primary btn-sm">
            {isRtl ? "← כל השיחות" : "← All chats"}
          </Link>
        </div>
      </PageHeader>

      <div
        className="page-container"
        style={{
          maxWidth: "760px",
          padding: "32px 1.5rem 72px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Message feed */}
        <div
          className="card"
          style={{
            padding: "0",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              maxHeight: "55vh",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {msgsLoading && (
              <p style={{ textAlign: "center", color: "var(--gray-400)" }}>
                {isRtl ? "טוען הודעות..." : "Loading messages..."}
              </p>
            )}
            {msgsError === "permission" && (
              <p style={{ textAlign: "center", color: "var(--gray-500)" }}>
                {isRtl
                  ? "אין לך הרשאה לצפות בשיחה זו."
                  : "You don't have permission to view this chat."}
              </p>
            )}
            {msgsError && msgsError !== "permission" && (
              <p style={{ textAlign: "center", color: "var(--red, #c0392b)" }}>
                {isRtl ? "שגיאה בטעינת ההודעות" : "Could not load messages"}
              </p>
            )}
            {!msgsLoading && !msgsError && messages.length === 0 && (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--gray-400)",
                  paddingTop: "24px",
                }}
              >
                {isRtl
                  ? "אין הודעות עדיין. שלח/י הודעה ראשונה!"
                  : "No messages yet. Send the first one!"}
              </p>
            )}
            {messages.map((msg) => {
              const isMine = msg.senderId === user?.uid;
              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMine ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "72%",
                      background: isMine ? "var(--navy, #1a3a5c)" : "var(--gray-100, #f3f4f6)",
                      color: isMine ? "#fff" : "var(--gray-800)",
                      borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      padding: "10px 14px",
                      fontSize: "14px",
                      lineHeight: 1.6,
                      wordBreak: "break-word",
                      direction: isRtl ? "rtl" : "ltr",
                    }}
                  >
                    {msg.content}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--gray-400)",
                      marginTop: "3px",
                    }}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Send form */}
        <form
          onSubmit={handleSend}
          style={{
            display: "flex",
            gap: "10px",
            direction: isRtl ? "rtl" : "ltr",
          }}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isRtl ? "הקלד/י הודעה..." : "Type a message..."}
            disabled={sending}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--gray-200)",
              fontSize: "14px",
              outline: "none",
              direction: isRtl ? "rtl" : "ltr",
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || !inputText.trim()}
          >
            {sending
              ? isRtl ? "שולח..." : "Sending..."
              : isRtl ? "שלח" : "Send"}
          </button>
        </form>

        {sendError && (
          <p style={{ color: "var(--red, #c0392b)", fontSize: "13px" }}>
            {isRtl ? "שגיאה בשליחת ההודעה. נסה/י שוב." : "Failed to send. Please try again."}
          </p>
        )}
      </div>
    </>
  );
}
