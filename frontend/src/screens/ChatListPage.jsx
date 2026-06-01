import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  MessagesSquare,
  MessageCircle,
  Lock,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Users,
  Clock,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import Reveal from "../components/motion/Reveal";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { firebaseDb } from "../lib/firebase";
import { formatDate } from "../utils/helpers";

export default function ChatListPage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const c = t.chat;

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isRtl = lang === "he";
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

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

  const title = c.listTitle;
  const subtitle = c.listSubtitle;

  // ── Shared presentational helpers ──────────────────────────────
  const stateCardStyle = {
    padding: "clamp(40px, 6vw, 64px) clamp(28px, 5vw, 48px)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    border: "1px solid var(--hair)",
    borderRadius: "var(--radius-lg)",
    background: "var(--white)",
    boxShadow: "var(--shadow-sm)",
  };

  const stateIconWrap = (fill, color) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: fill,
    color: color,
    marginBlockEnd: "12px",
  });

  const stateTitleStyle = {
    fontFamily: "'Frank Ruhl Libre', Georgia, serif",
    fontSize: "var(--fs-h3)",
    fontWeight: 500,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
    margin: 0,
  };

  const stateBodyStyle = {
    color: "var(--gray-600)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.65,
    maxWidth: "34rem",
    margin: "0 0 8px",
  };

  const eyebrowStyle = {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: "var(--fs-xs)",
    fontWeight: 500,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--gray-400)",
  };

  // Skeleton placeholder row for the loading state.
  const SkeletonRow = ({ last }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 24px",
        borderBlockStart: last ? "none" : "1px solid var(--hair)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div
          className="skeleton"
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "var(--radius)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="skeleton" style={{ width: "160px", height: "13px", borderRadius: "999px" }} />
          <div className="skeleton" style={{ width: "96px", height: "11px", borderRadius: "999px" }} />
        </div>
      </div>
      <div className="skeleton" style={{ width: "64px", height: "11px", borderRadius: "999px" }} />
    </div>
  );

  const renderBody = () => {
    if (authLoading) {
      return (
        <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--hair)", borderRadius: "var(--radius-lg)" }}>
          {[0, 1, 2].map((i) => (
            <SkeletonRow key={i} last={i === 2} />
          ))}
        </div>
      );
    }

    if (!user) {
      return (
        <div style={stateCardStyle}>
          <span style={stateIconWrap("var(--sky-3)", "var(--ink-2)")}>
            <Lock size={26} strokeWidth={1.75} />
          </span>
          <span style={eyebrowStyle}>{c.signIn}</span>
          <h2 style={stateTitleStyle}>{c.signInRequired}</h2>
          <p style={stateBodyStyle}>{c.signInListBody}</p>
          <Link
            href={`/login?next=${encodeURIComponent("/chats")}`}
            className="btn btn-ember"
            style={{ marginBlockStart: "8px" }}
          >
            {c.signIn}
          </Link>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--hair)", borderRadius: "var(--radius-lg)" }}>
          {[0, 1, 2].map((i) => (
            <SkeletonRow key={i} last={i === 2} />
          ))}
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            {c.loadingChats}
          </span>
        </div>
      );
    }

    if (error === "permission") {
      return (
        <div style={stateCardStyle}>
          <span style={stateIconWrap("var(--warning-soft)", "var(--warning)")}>
            <Lock size={26} strokeWidth={1.75} />
          </span>
          <h2 style={stateTitleStyle}>{c.signInRequired}</h2>
          <p style={stateBodyStyle}>{c.permissionList}</p>
          <Link
            href={`/login?next=${encodeURIComponent("/chats")}`}
            className="btn btn-ember"
            style={{ marginBlockStart: "8px" }}
          >
            {c.signInAgain}
          </Link>
        </div>
      );
    }

    if (error) {
      return (
        <div style={stateCardStyle}>
          <span style={stateIconWrap("var(--danger-soft)", "var(--danger)")}>
            <AlertTriangle size={26} strokeWidth={1.75} />
          </span>
          <p style={stateBodyStyle}>{c.loadError}</p>
          <button
            className="btn btn-outline"
            style={{ marginBlockStart: "8px", display: "inline-flex", alignItems: "center", gap: "8px" }}
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={16} />
            {c.refresh}
          </button>
        </div>
      );
    }

    if (chats.length === 0) {
      return (
        <div style={stateCardStyle}>
          <span style={stateIconWrap("var(--ember-soft)", "var(--ember)")}>
            <MessagesSquare size={28} strokeWidth={1.75} />
          </span>
          <h2 style={stateTitleStyle}>{c.emptyTitle}</h2>
          <p style={stateBodyStyle}>{c.emptyBody}</p>
          <Link href="/requests" className="btn btn-ember" style={{ marginBlockStart: "8px" }}>
            {c.submitRequest}
          </Link>
        </div>
      );
    }

    return (
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          border: "1px solid var(--hair)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {chats.map((chat, index) => (
            <li key={chat.id}>
              <Link
                href={`/chats/${chat.id}`}
                aria-label={`${c.request} ${chat.requestId}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  padding: "18px 22px",
                  textDecoration: "none",
                  borderBlockStart: index > 0 ? "1px solid var(--hair)" : "none",
                  background: "transparent",
                  transition: "background var(--dur-2) var(--ease-out)",
                  outline: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sky-3)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onFocus={(e) => {
                  e.currentTarget.style.background = "var(--sky-3)";
                  e.currentTarget.style.boxShadow = "inset 0 0 0 2px var(--ember)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "44px",
                      height: "44px",
                      borderRadius: "var(--radius)",
                      background: "var(--ember-soft)",
                      color: "var(--ember)",
                    }}
                  >
                    <MessageCircle size={21} strokeWidth={1.9} />
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--ink)",
                        fontSize: "var(--fs-body)",
                        lineHeight: 1.35,
                      }}
                    >
                      {c.request}{" "}
                      <span
                        style={{
                          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                          fontSize: "var(--fs-sm)",
                          color: "var(--ember-700)",
                        }}
                      >
                        {chat.requestId}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "var(--gray-500)",
                        fontSize: "var(--fs-sm)",
                        marginBlockStart: "4px",
                      }}
                    >
                      <Users size={14} strokeWidth={1.9} aria-hidden="true" />
                      {chat.participants.length} {c.participants}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--gray-500)",
                      fontSize: "var(--fs-sm)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Clock size={13} strokeWidth={1.9} aria-hidden="true" />
                    {chat.lastMessageAt ? formatDate(chat.lastMessageAt, lang) : "—"}
                  </span>
                  <ChevronIcon
                    size={18}
                    strokeWidth={2}
                    aria-hidden="true"
                    style={{ color: "var(--gray-400)" }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />

      <div
        className="page-container"
        style={{
          maxWidth: "820px",
          paddingBlock: "clamp(36px, 5vw, 56px) clamp(56px, 8vw, 88px)",
        }}
      >
        <Reveal>{renderBody()}</Reveal>
      </div>
    </>
  );
}
