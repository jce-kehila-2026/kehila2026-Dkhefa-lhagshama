import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
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

import Reveal from "../components/motion/Reveal";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { firebaseDb } from "../lib/firebase";
import { apiJson } from "../lib/apiClient";
import { formatDate } from "../utils/helpers";

// A chat row as projected from the Firestore `chats` collection for this list.
interface ChatListItem {
  id: string;
  requestId: string;
  participants: string[];
  lastMessageAt: string | null;
}

// req 13b — a chat counts as "past" when its linked request is closed/rejected
// or archived; everything else (incl. unknown status) stays "active".
const PAST_STATUSES = new Set(["closed", "rejected"]);

export default function ChatListPage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const c = t.chat;

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // req 13b — linked-request status per requestId, fetched lazily through
  // Express. `null` while in flight; absence ⇒ treated as active (fail-open
  // toward visibility). Drives the active/past split + tab.
  const [reqStatus, setReqStatus] = useState<Record<string, string | null>>({});
  const [tab, setTab] = useState<"active" | "past">("active");

  // req 13b / req 3 — ?requestId=<id> arrives from a my-requests card's chat
  // shortcut; we highlight (and, if it's the only match, auto-open) that chat.
  const focusRequestId =
    typeof router.query.requestId === "string" ? router.query.requestId : null;
  const autoOpenedRef = useRef(false);

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

  // req 13b — for every chat we don't yet have a status for, fetch the linked
  // request's status once. Lightweight + idempotent; failures fail-open to
  // "active" so a chat is never wrongly hidden.
  useEffect(() => {
    if (!user) return;
    const missing = chats
      .map((ch) => ch.requestId)
      .filter((rid): rid is string => !!rid && !(rid in reqStatus));
    if (missing.length === 0) return;

    let alive = true;
    // Mark as in-flight so we don't refetch on the next render.
    setReqStatus((prev) => {
      const next = { ...prev };
      for (const rid of missing) next[rid] = next[rid] ?? null;
      return next;
    });

    missing.forEach((rid) => {
      apiJson<{ status?: string }>(`/api/requests/${rid}`)
        .then((data) => {
          if (alive) setReqStatus((prev) => ({ ...prev, [rid]: data?.status ?? "" }));
        })
        .catch(() => {
          // Permission/network error — leave as null (treated as active).
        });
    });

    return () => { alive = false; };
  }, [chats, user, reqStatus]);

  // req 13b — split active vs. past from the resolved request statuses.
  const isPastChat = (chat: ChatListItem) => {
    const s = chat.requestId ? reqStatus[chat.requestId] : null;
    return typeof s === "string" && PAST_STATUSES.has(s);
  };
  const activeChats = chats.filter((ch) => !isPastChat(ch));
  const pastChats = chats.filter((ch) => isPastChat(ch));
  const visibleChats = tab === "active" ? activeChats : pastChats;

  // req 3 / req 13b — when arriving with ?requestId=, switch to the tab that
  // contains the match and (if it's the only one) open it directly.
  useEffect(() => {
    if (!focusRequestId || loading || autoOpenedRef.current) return;
    const matches = chats.filter((ch) => ch.requestId === focusRequestId);
    if (matches.length === 0) return;
    autoOpenedRef.current = true;
    if (matches.length === 1) {
      router.replace(`/chats/${matches[0].id}`);
      return;
    }
    // Multiple matches — reveal the tab holding them and let highlight guide.
    setTab(isPastChat(matches[0]) ? "past" : "active");
  }, [focusRequestId, loading, chats, reqStatus, router]);

  // Conversation count is only meaningful once the list has resolved.
  const showCount = !authLoading && !!user && !loading && !error;

  // ── Shared presentational helpers ──────────────────────────────
  const stateCardStyle: CSSProperties = {
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

  const stateIconWrap = (fill: string, color: string): CSSProperties => ({
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

  const stateTitleStyle: CSSProperties = {
    fontFamily: "'Frank Ruhl Libre', Georgia, serif",
    fontSize: "var(--fs-h3)",
    fontWeight: 500,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
    margin: 0,
  };

  const stateBodyStyle: CSSProperties = {
    color: "var(--gray-600)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.65,
    maxWidth: "34rem",
    margin: "0 0 8px",
  };

  const eyebrowStyle: CSSProperties = {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: "var(--fs-xs)",
    fontWeight: 500,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--gray-400)",
  };

  // Skeleton placeholder row for the loading state.
  const SkeletonRow = ({ last }: { last: boolean }) => (
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
      <>
        {/* req 13b — active / past tab toggle */}
        <div className="chat-tabs" role="tablist" aria-label={c.inlineHeader.title}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "active"}
            className={`chat-tab${tab === "active" ? " chat-tab--active" : ""}`}
            onClick={() => setTab("active")}
          >
            {c.activeTab}
            <span className="chat-tab__count">{activeChats.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "past"}
            className={`chat-tab${tab === "past" ? " chat-tab--active" : ""}`}
            onClick={() => setTab("past")}
          >
            {c.pastTab}
            <span className="chat-tab__count">{pastChats.length}</span>
          </button>
        </div>

        {visibleChats.length === 0 ? (
          <div style={stateCardStyle}>
            <span style={stateIconWrap("var(--sky-3)", "var(--ink-2)")}>
              <MessagesSquare size={26} strokeWidth={1.75} />
            </span>
            <p style={stateBodyStyle}>
              {tab === "active" ? c.activeEmpty : c.pastEmpty}
            </p>
          </div>
        ) : (
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
          {visibleChats.map((chat, index) => {
            const highlighted = !!focusRequestId && chat.requestId === focusRequestId;
            return (
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
                  background: highlighted ? "var(--ember-soft)" : "transparent",
                  boxShadow: highlighted ? "inset 3px 0 0 var(--ember)" : "none",
                  transition: "background var(--dur-2) var(--ease-out)",
                  outline: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sky-3)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = highlighted ? "var(--ember-soft)" : "transparent")}
                onFocus={(e) => {
                  e.currentTarget.style.background = "var(--sky-3)";
                  e.currentTarget.style.boxShadow = "inset 0 0 0 2px var(--ember)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = highlighted ? "var(--ember-soft)" : "transparent";
                  e.currentTarget.style.boxShadow = highlighted ? "inset 3px 0 0 var(--ember)" : "none";
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
                      {isPastChat(chat) && (
                        <span className="chat-past-badge">{c.pastBadge}</span>
                      )}
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
            );
          })}
        </ul>
      </div>
        )}
      </>
    );
  };

  return (
    <>
      {/* ── Inline editorial header (eyebrow → serif title → count) ── */}
      <div
        className="page-container chat-inline-header"
        style={{
          maxWidth: "820px",
          paddingBlock: "clamp(36px, 5vw, 56px) clamp(20px, 3vw, 28px)",
        }}
      >
        <Reveal>
          <header className="chat-inline-header__inner">
            <span className="eyebrow chat-inline-header__eyebrow">
              {c.inlineHeader.eyebrow}
            </span>
            <h1 className="chat-inline-header__title">{c.inlineHeader.title}</h1>
            {showCount && (
              <p className="chat-inline-header__count">
                {c.conversationCount(chats.length)}
              </p>
            )}
          </header>
        </Reveal>
      </div>

      <div
        className="page-container"
        style={{
          maxWidth: "820px",
          paddingBlock: "0 clamp(56px, 8vw, 88px)",
        }}
      >
        <Reveal>{renderBody()}</Reveal>
      </div>
    </>
  );
}
