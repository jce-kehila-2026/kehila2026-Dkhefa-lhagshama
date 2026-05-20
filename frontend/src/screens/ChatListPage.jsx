import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { firebaseDb } from "../lib/firebase";
import { formatDate } from "../utils/helpers";

export default function ChatListPage() {
  const { lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isRtl = lang === "he";

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const q = query(
      collection(firebaseDb, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            requestId: d.requestId ?? "",
            participants: d.participants ?? [],
            lastMessageAt: d.lastMessageAt?.toDate?.()?.toISOString?.() ?? null,
          };
        });
        setChats(items);
        setLoading(false);
      },
      (err) => {
        console.error("[ChatListPage] onSnapshot error:", err);
        setError(err?.code === "permission-denied" ? "permission" : "load_failed");
        setLoading(false);
      }
    );

    return unsub;
  }, [authLoading, user]);

  const title = isRtl ? "השיחות שלי" : "My Chats";
  const subtitle = isRtl
    ? "כל השיחות עם הצוות שלנו"
    : "All conversations with our team";

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />

      <div
        className="page-container"
        style={{ maxWidth: "800px", padding: "42px 1.5rem 72px" }}
      >
        {authLoading ? (
          <div className="card" style={{ padding: "28px", textAlign: "center" }}>
            {isRtl ? "טוען..." : "Loading..."}
          </div>
        ) : !user ? (
          <div className="card" style={{ padding: "34px", textAlign: "center" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--ink)", marginBottom: "10px" }}>
              {isRtl ? "כניסה נדרשת" : "Sign in required"}
            </h2>
            <p style={{ color: "var(--gray-500)", marginBottom: "22px", lineHeight: 1.7 }}>
              {isRtl
                ? "כדי לראות את השיחות שלך, יש להתחבר תחילה."
                : "You need to be signed in to view your chats."}
            </p>
            <Link
              href={`/login?next=${encodeURIComponent("/chats")}`}
              className="btn btn-primary"
            >
              {isRtl ? "התחבר/י" : "Sign in"}
            </Link>
          </div>
        ) : loading ? (
          <div className="card" style={{ padding: "28px", textAlign: "center" }}>
            {isRtl ? "טוען שיחות..." : "Loading chats..."}
          </div>
        ) : error === "permission" ? (
          <div className="card" style={{ padding: "28px", textAlign: "center" }}>
            <p style={{ color: "var(--gray-500)", marginBottom: "16px" }}>
              {isRtl
                ? "אין לך הרשאה לצפות בשיחות. ייתכן שהפעלת הסתיימה."
                : "You don't have permission to view chats. Your session may have expired."}
            </p>
            <Link
              href={`/login?next=${encodeURIComponent("/chats")}`}
              className="btn btn-primary"
            >
              {isRtl ? "התחבר/י מחדש" : "Sign in again"}
            </Link>
          </div>
        ) : error ? (
          <div className="card" style={{ padding: "28px" }}>
            <p style={{ color: "var(--gray-500)" }}>
              {isRtl
                ? "אירעה שגיאה בטעינת השיחות. נסה/י לרענן."
                : "Could not load chats. Try refreshing."}
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: "14px" }}
              onClick={() => window.location.reload()}
            >
              {isRtl ? "רענון" : "Refresh"}
            </button>
          </div>
        ) : chats.length === 0 ? (
          <div
            className="card"
            style={{ padding: "34px", textAlign: "center" }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--navy)",
                marginBottom: "10px",
              }}
            >
              {isRtl ? "אין שיחות עדיין" : "No chats yet"}
            </h2>
            <p
              style={{
                color: "var(--gray-500)",
                marginBottom: "22px",
                lineHeight: 1.7,
              }}
            >
              {isRtl
                ? "לאחר שבקשתך תוקצה למטפל, תיפתח כאן שיחה אוטומטית."
                : "Once your request is assigned to a handler, a chat will appear here."}
            </p>
            <Link href="/requests" className="btn btn-primary">
              {isRtl ? "הגש בקשה" : "Submit a request"}
            </Link>
          </div>
        ) : (
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            {chats.map((chat, index) => (
              <Link
                key={chat.id}
                href={`/chats/${chat.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "18px 22px",
                    borderTop: index > 0 ? "1px solid var(--gray-200)" : "none",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--gray-50)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--navy)",
                        fontSize: "15px",
                      }}
                    >
                      {isRtl ? "בקשה" : "Request"}{" "}
                      <span style={{ fontFamily: "monospace", fontSize: "13px" }}>
                        {chat.requestId}
                      </span>
                    </div>
                    <div
                      style={{
                        color: "var(--gray-500)",
                        fontSize: "13px",
                        marginTop: "4px",
                      }}
                    >
                      {chat.participants.length}{" "}
                      {isRtl ? "משתתפים" : "participants"}
                    </div>
                  </div>
                  <div
                    style={{
                      color: "var(--gray-400)",
                      fontSize: "13px",
                      textAlign: isRtl ? "left" : "right",
                    }}
                  >
                    {chat.lastMessageAt
                      ? formatDate(chat.lastMessageAt, lang)
                      : "—"}
                    <div
                      style={{
                        marginTop: "6px",
                        color: "var(--navy)",
                        fontSize: "18px",
                      }}
                    >
                      {isRtl ? "›" : "›"}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
