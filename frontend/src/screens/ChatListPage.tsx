import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  Plus,
} from "lucide-react";

import Reveal from "../components/motion/Reveal";
import UserPickerDialog from "../components/chat/UserPickerDialog";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { firebaseDb } from "../lib/firebase";
import { apiJson, apiFetch } from "../lib/apiClient";
import { formatRequestRef } from "../lib/requestRef";
import { formatDate } from "../utils/helpers";
import type { ChatKind } from "../types";

// A chat row as projected from the Firestore `chats` collection for this list.
interface ChatListItem {
  id: string;
  requestId: string;
  participants: string[];
  lastMessageAt: string | null;
  /** Request-bound vs. direct staff chat (legacy docs count as `request`). */
  kind: ChatKind;
  /** Optional direct-chat title. */
  title: string | null;
  /** False when the chat was paused / its request ended (read-only). */
  active: boolean;
}

// req 13b — a chat counts as "past" when its linked request is in a terminal
// state (closed/rejected/referred) or archived; everything else (incl. unknown
// status) stays "active". These mirror the backend chat end-states
// (adminRequests CHAT_END_STATES) so the status backstop covers all three even
// if the best-effort chat.active flip never landed.
const PAST_STATUSES = new Set(["closed", "rejected", "referred"]);

export default function ChatListPage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading, hasRole } = useAuth();
  const router = useRouter();
  const c = t.chat;

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // req 13b — linked-request status per requestId, fetched lazily through
  // Express. Absent key ⇒ in flight / failed, treated as active (fail-open
  // toward visibility). Drives the active/past split + tab.
  const [reqStatus, setReqStatus] = useState<Record<string, string>>({});
  // WS-3 — friendly reference per linked requestId, filled by the same lazy
  // /api/requests/:id fan-out that resolves status below. Absent key ⇒ in
  // flight / failed; the row falls back to a short UUID slice.
  const [reqDisplayId, setReqDisplayId] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"active" | "past">("active");

  // Direct-chat row labels: comma-joined other-participant names, fetched
  // lazily per chat (mirrors the request-status fan-out). Absent key ⇒ in
  // flight / failed — the row falls back to the generic staff-chat label.
  const [directNames, setDirectNames] = useState<Record<string, string>>({});

  // Admin-only "new chat" dialog (direct/staff chats, feedback round 2).
  const isAdminUser = hasRole("admin");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
            // Tolerant reads: docs created before the direct-chat feature
            // carry no kind/title/active — treat them as live request chats.
            kind: (d.kind === "direct" ? "direct" : "request") as ChatKind,
            title:
              typeof d.title === "string" && d.title.trim() ? d.title : null,
            active: d.active !== false,
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
  // request's status once. The requested-id set lives in a ref, NOT in state:
  // depending on `reqStatus` made each run's setState re-trigger the effect,
  // whose cleanup flipped the previous run's alive flag and threw away every
  // response. The .then handlers use functional updates, which are safe (a
  // no-op) after unmount in React 18, so no alive flag is needed. Failures
  // fail-open to "active" so a chat is never wrongly hidden.
  const reqStatusRequested = useRef(new Set<string>());
  useEffect(() => {
    if (!user) return;
    const missing = chats
      .map((ch) => ch.requestId)
      .filter((rid): rid is string => !!rid && !reqStatusRequested.current.has(rid));

    missing.forEach((rid) => {
      reqStatusRequested.current.add(rid);
      apiJson<{ status?: string; displayId?: string | null }>(`/api/requests/${rid}`)
        .then((data) => {
          setReqStatus((prev) => ({ ...prev, [rid]: data?.status ?? "" }));
          if (typeof data?.displayId === "string" && data.displayId) {
            setReqDisplayId((prev) => ({ ...prev, [rid]: data.displayId as string }));
          }
        })
        .catch(() => {
          reqStatusRequested.current.delete(rid);
        });
    });
  }, [chats, user]);

  // Direct-chat labels — for every untitled direct chat we don't yet have
  // names for, fetch its participants once and cache the joined "other
  // participant" names. Same ref-based dedupe as the status fan-out above;
  // failures stay absent (generic staff-chat label).
  const directNamesRequested = useRef(new Set<string>());
  useEffect(() => {
    if (!user) return;
    const missing = chats
      .filter(
        (ch) =>
          ch.kind === "direct" && !ch.title && !directNamesRequested.current.has(ch.id),
      )
      .map((ch) => ch.id);

    missing.forEach((id) => {
      directNamesRequested.current.add(id);
      apiJson<{ uid: string; displayName: string | null }[]>(
        `/api/chats/${id}/participants`,
      )
        .then((list) => {
          if (!Array.isArray(list)) return;
          const names = list
            .filter((p) => p && p.uid !== user.uid)
            .map(
              (p) =>
                (p.displayName && p.displayName.trim()) || p.uid.slice(0, 6),
            )
            .join(", ");
          if (names) setDirectNames((prev) => ({ ...prev, [id]: names }));
        })
        .catch(() => {
          // Permission/network error — keep the generic label.
        });
    });
  }, [chats, user]);

  // req 13b — split active vs. past. A paused chat (active === false, set on
  // all request end states and by the admin toggle) is always "past"; direct
  // chats have no request, so that flag is their only signal.
  const isPastChat = useCallback(
    (chat: ChatListItem) => {
      if (!chat.active) return true;
      if (chat.kind === "direct") return false;
      const s = chat.requestId ? reqStatus[chat.requestId] : null;
      return typeof s === "string" && PAST_STATUSES.has(s);
    },
    [reqStatus],
  );
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
  }, [focusRequestId, loading, chats, isPastChat, router]);

  // Create a direct (staff/group) chat, then jump straight into it.
  async function handleCreateDirect(uids: string[], title: string) {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await apiFetch("/api/chats/direct", {
        method: "POST",
        body: JSON.stringify({
          participantUids: uids,
          ...(title ? { title } : {}),
        }),
      });
      if (!res.ok) {
        setCreateError(c.newChatError);
        return;
      }
      const data = (await res.json().catch(() => null)) as { id?: string } | null;
      if (data?.id) {
        router.push(`/chats/${data.id}`);
        return;
      }
      setCreateError(c.newChatError);
    } catch {
      setCreateError(c.newChatError);
    } finally {
      setCreating(false);
    }
  }

  // Conversation count is only meaningful once the list has resolved.
  const showCount = !authLoading && !!user && !loading && !error;

  const showTabs = showCount && chats.length > 0;

  // ── Shared state shell (loading / empty / error / permission) ──────
  const renderState = (opts: {
    icon: ReactNode;
    tone?: "ember" | "danger" | "warning" | "muted" | "info";
    title?: ReactNode;
    body?: ReactNode;
    action?: ReactNode;
  }) => (
    <div
      className="chat-state chat-state--card"
      role={opts.tone === "danger" ? "alert" : undefined}
    >
      <span
        aria-hidden="true"
        className={`chat-state__icon chat-state__icon--${opts.tone ?? "ember"}`}
      >
        {opts.icon}
      </span>
      {opts.title && <h2 className="chat-state__title">{opts.title}</h2>}
      {opts.body && <p className="chat-state__body">{opts.body}</p>}
      {opts.action && <div className="chat-state__action">{opts.action}</div>}
    </div>
  );

  // Skeleton list for the loading state — mirrors the row shape.
  const skeletonList = (srLabel?: string) => (
    <div className="chat-list-card">
      {[0, 1, 2].map((i) => (
        <div key={i} className="chat-skel-row">
          <div className="chat-skel-row__lead">
            <div className="skeleton chat-skel-row__avatar" />
            <div className="chat-skel-row__lines">
              <div className="skeleton chat-skel-row__l1" />
              <div className="skeleton chat-skel-row__l2" />
            </div>
          </div>
          <div className="skeleton chat-skel-row__l3" />
        </div>
      ))}
      {srLabel && <span className="sr-only">{srLabel}</span>}
    </div>
  );

  const renderBody = () => {
    if (authLoading) return skeletonList();

    if (!user) {
      return renderState({
        tone: "ember",
        icon: <Lock size={26} strokeWidth={1.75} />,
        title: c.signInRequired,
        body: c.signInListBody,
        action: (
          <Link
            href={`/login?next=${encodeURIComponent("/chats")}`}
            className="btn btn-ember"
          >
            {c.signIn}
          </Link>
        ),
      });
    }

    if (loading) return skeletonList(c.loadingChats);

    if (error === "permission") {
      return renderState({
        tone: "warning",
        icon: <Lock size={26} strokeWidth={1.75} />,
        title: c.signInRequired,
        body: c.permissionList,
        action: (
          <Link
            href={`/login?next=${encodeURIComponent("/chats")}`}
            className="btn btn-ember"
          >
            {c.signInAgain}
          </Link>
        ),
      });
    }

    if (error) {
      return renderState({
        tone: "danger",
        icon: <AlertTriangle size={26} strokeWidth={1.75} />,
        body: c.loadError,
        action: (
          <button
            className="btn btn-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={16} />
            {c.refresh}
          </button>
        ),
      });
    }

    if (chats.length === 0) {
      return renderState({
        tone: "ember",
        icon: <MessagesSquare size={28} strokeWidth={1.75} />,
        title: c.emptyTitle,
        body: c.emptyBody,
        action: (
          <Link href="/requests" className="btn btn-ember">
            {c.submitRequest}
          </Link>
        ),
      });
    }

    if (visibleChats.length === 0) {
      // If we arrived via ?requestId= with no chat for it, explain that rather
      // than showing the generic tab-empty copy.
      const focusHasNoChatHere =
        !!focusRequestId && chats.every((ch) => ch.requestId !== focusRequestId);
      return renderState({
        tone: "info",
        icon: <MessagesSquare size={26} strokeWidth={1.75} />,
        body: focusHasNoChatHere
          ? c.focusNoChat
          : tab === "active" ? c.activeEmpty : c.pastEmpty,
      });
    }

    // Arrived via ?requestId= but no chat exists for it yet (e.g. a still-
    // pending request). The auto-open effect can't navigate anywhere, so show a
    // clear notice instead of silently dropping the user on the full list.
    const focusHasNoChat =
      !!focusRequestId && chats.every((ch) => ch.requestId !== focusRequestId);

    return (
      <div className="chat-list-card">
        {focusHasNoChat && (
          <p className="chat-state__body" role="status" style={{ padding: "12px 16px", margin: 0 }}>
            {c.focusNoChat}
          </p>
        )}
        <ul className="chat-list-card__ul">
          {visibleChats.map((chat) => {
            const highlighted =
              !!focusRequestId && chat.requestId === focusRequestId;
            const isDirect = chat.kind === "direct";
            // Direct rows: title, else the other participants' names, else a
            // generic staff-chat label while names load.
            const directLabel =
              chat.title || directNames[chat.id] || c.directChatFallback;
            const RowIcon = isDirect ? Users : MessageCircle;
            const requestRef = formatRequestRef({
              displayId: chat.requestId ? reqDisplayId[chat.requestId] : null,
              id: chat.requestId,
            });
            return (
              <li key={chat.id}>
                <Link
                  href={`/chats/${chat.id}`}
                  aria-label={
                    isDirect ? directLabel : `${c.request} ${requestRef}`
                  }
                  className={`chat-row${highlighted ? " chat-row--focus" : ""}`}
                >
                  <div className="chat-row__lead">
                    <span className="chat-row__icon" aria-hidden="true">
                      <RowIcon size={21} strokeWidth={1.9} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="chat-row__title">
                        {isDirect ? (
                          directLabel
                        ) : (
                          <>
                            {c.request}{" "}
                            <span className="chat-row__id">
                              {requestRef}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="chat-row__meta">
                        <Users size={14} strokeWidth={1.9} aria-hidden="true" />
                        {chat.participants.length} {c.participants}
                        {isPastChat(chat) && (
                          <span className="chat-past-badge">{c.pastBadge}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="chat-row__end">
                    <span className="chat-row__time">
                      <Clock size={13} strokeWidth={1.9} aria-hidden="true" />
                      {chat.lastMessageAt
                        ? formatDate(chat.lastMessageAt, lang)
                        : "-"}
                    </span>
                    <ChevronIcon
                      size={18}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="chat-row__chevron"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="page-container chat-list-shell">
      <div className="chat-list-layout">
        {/* ── Title + filter rail (offset inline-start) ── */}
        <aside className="chat-list-rail">
          <Reveal>
            <span className="eyebrow chat-list-rail__eyebrow">
              {c.inlineHeader.eyebrow}
            </span>
            <h1 className="chat-list-rail__title">{c.inlineHeader.title}</h1>
            {showCount && (
              <p className="chat-list-rail__count">
                {c.conversationCount(chats.length)}
              </p>
            )}

            {/* Admin-only: start a direct (staff/group) chat. */}
            {isAdminUser && !authLoading && !!user && (
              <button
                type="button"
                className="btn btn-ember btn-sm chat-newchat-btn"
                onClick={() => {
                  setCreateError(null);
                  setNewChatOpen(true);
                }}
              >
                <Plus size={15} aria-hidden="true" />
                {c.newChat}
              </button>
            )}

            {showTabs && (
              <div
                className="chat-filter"
                role="tablist"
                aria-label={c.inlineHeader.title}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "active"}
                  className={`chat-filter__tab${tab === "active" ? " chat-filter__tab--active" : ""}`}
                  onClick={() => setTab("active")}
                >
                  <span>{c.activeTab}</span>
                  <span className="chat-filter__count">{activeChats.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "past"}
                  className={`chat-filter__tab${tab === "past" ? " chat-filter__tab--active" : ""}`}
                  onClick={() => setTab("past")}
                >
                  <span>{c.pastTab}</span>
                  <span className="chat-filter__count">{pastChats.length}</span>
                </button>
              </div>
            )}
          </Reveal>
        </aside>

        {/* ── Conversation list (wide column) ── */}
        <div className="chat-list-main">
          <Reveal>{renderBody()}</Reveal>
        </div>
      </div>

      {isAdminUser && (
        <UserPickerDialog
          open={newChatOpen}
          heading={c.newChatTitle}
          confirmLabel={c.newChatCreate}
          busyLabel={c.newChatCreating}
          busy={creating}
          error={createError}
          excludeUids={user ? [user.uid] : []}
          withTitleField
          onConfirm={handleCreateDirect}
          onClose={() => setNewChatOpen(false)}
        />
      )}
    </div>
  );
}
