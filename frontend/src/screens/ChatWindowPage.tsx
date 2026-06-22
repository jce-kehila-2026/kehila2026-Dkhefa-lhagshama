import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  AlertCircle,
  FileText,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { formatRequestRef } from "@/lib/requestRef";
import { useMessages } from "../hooks/useMessages";
import Reveal from "../components/motion/Reveal";
import ConfirmDialog from "../components/feedback/ConfirmDialog";
import UserPickerDialog from "../components/chat/UserPickerDialog";
import { useChatWindowData } from "./chat-window/useChatWindowData";
import { useRequestLifecycle } from "./chat-window/useRequestLifecycle";
import { useParticipantActions } from "./chat-window/useParticipantActions";
import { useChatMessaging } from "./chat-window/useChatMessaging";
import { MessageFeed } from "./chat-window/MessageFeed";
import { ChatComposer } from "./chat-window/ChatComposer";
import { ChatRail } from "./chat-window/ChatRail";
import styles from "./ChatWindowPage.module.css";

export default function ChatWindowPage() {
  const { t, lang, isRTL } = useLanguage();
  const { user, loading: authLoading, hasRole } = useAuth();
  const c = t.chat;
  const router = useRouter();
  const { id: chatId } = router.query;

  // Only attach the listener once auth is resolved AND a user exists,
  // so logged-out visitors never trigger a permission-denied snapshot.
  const listenChatId = !authLoading && user && typeof chatId === "string" ? chatId : null;
  const { messages, loading: msgsLoading, error: msgsError } = useMessages(listenChatId);

  // ── Data layer (chat-doc projection, participants, linked request) ─────
  const {
    chatMeta,
    participants,
    linkedRequest,
    setLinkedRequest,
    linkedRequestId,
    refetchLinkedRequest,
  } = useChatWindowData(listenChatId);

  // ── Note 6 / req 25 — mark-done + mutual-consent close handshake ───────
  const {
    canMarkDone,
    markingDone,
    handleMarkDone,
    canUseCloseConsent,
    closeReq,
    iProposed,
    otherProposed,
    closeBusy,
    handleCloseAction,
  } = useRequestLifecycle({ linkedRequest, setLinkedRequest, refetchLinkedRequest });

  // WS-3 — friendly reference for the rail. Prefer the fetched linkedRequest's
  // displayId; fall back to a short slice of the UUID id we already mirror.
  const railRequestRef = formatRequestRef({
    displayId: linkedRequest?.displayId ?? null,
    id: linkedRequestId,
  });

  // ── Membership / group semantics (feedback round 2) ────────────────────
  // membershipKnown gates the staff-view UI so participants never see a
  // "join" flash while the chat doc resolves.
  const membershipKnown = chatMeta !== null;
  const isMember =
    !!user && !!chatMeta && chatMeta.participantUids.includes(user.uid);
  // Admin viewing a chat they're not in: rules allow reading; the composer is
  // replaced by a "join to write" control.
  const isStaffViewer = membershipKnown && !isMember && hasRole("admin");

  const participantCount =
    chatMeta?.participantUids.length ?? Object.keys(participants).length;
  const isGroup = chatMeta?.kind === "direct" || participantCount >= 3;

  // Participant management: any admin manages any chat; the creator manages
  // their own direct chats. (Backend enforces the same guard.)
  const canManageParticipants =
    !!user &&
    (hasRole("admin") ||
      (chatMeta?.kind === "direct" && chatMeta.createdBy === user.uid));

  // The "other" participant (the one who isn't the signed-in user) — used to
  // headline two-person conversations with a human name + face.
  const otherParticipant =
    Object.values(participants).find((p) => p.uid !== user?.uid) ?? null;
  const otherName =
    (otherParticipant?.displayName && otherParticipant.displayName.trim()) ||
    c.participantFallback;

  // Headline for group/direct chats: title, else the other participants'
  // names, else the generic fallback.
  const groupName =
    chatMeta?.title ||
    Object.values(participants)
      .filter((p) => p.uid !== user?.uid)
      .map((p) => (p.displayName && p.displayName.trim()) || p.uid.slice(0, 6))
      .join(", ") ||
    (chatMeta?.kind === "direct" ? c.directChatFallback : c.titleFallback);

  // req 25 — who asked to close, attributed from closeRequest.proposedBy
  // (NOT "the first other participant", which misnames the proposer in
  // 3+-person chats). Falls back to the proposer's role, then a generic label.
  const closeProposer = closeReq?.proposedBy
    ? participants[closeReq.proposedBy]
    : undefined;
  const closeProposerName =
    (closeProposer?.displayName && closeProposer.displayName.trim()) ||
    (closeReq
      ? closeReq.proposedRole === "beneficiary"
        ? c.proposerBeneficiary
        : c.proposerVolunteer
      : c.otherPartyFallback);

  // ── Participant management + admin join (feedback round 2) ─────────────
  const {
    joinBusy,
    addOpen,
    setAddOpen,
    addBusy,
    addError,
    setAddError,
    removeTarget,
    setRemoveTarget,
    removeBusy,
    handleJoin,
    handleAddPeople,
    handleRemoveParticipant,
  } = useParticipantActions(chatId);

  // ── Read-only composer states ───────────────────────────────────────────
  // A paused chat (admin toggle / request end state) and an ended linked
  // request both lock the composer; the server enforces this too (409).
  const chatPaused = !!chatMeta && !chatMeta.active;
  const requestEnded =
    !!linkedRequest &&
    (linkedRequest.status === "closed" ||
      linkedRequest.status === "rejected" ||
      linkedRequest.status === "referred");
  const composerLocked = chatPaused || requestEnded;

  // Composer + attachment messaging (req 26).
  const {
    inputText,
    setInputText,
    sending,
    sendError,
    uploading,
    downloading,
    handleSend,
    handleFilePick,
    handleDownload,
  } = useChatMessaging(chatId);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const isRtl = lang === "he";
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  // Keep the message FEED pinned to its latest message — scroll only the feed
  // container, never the page (scrollIntoView would scroll every ancestor incl.
  // the window, yanking the whole page down when a chat opens). Jump instantly
  // on first paint and under reduced motion; glide only for live arrivals.
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior =
      !didInitialScrollRef.current || prefersReduced ? "auto" : "smooth";
    didInitialScrollRef.current = true;
    feed.scrollTo({ top: feed.scrollHeight, behavior });
  }, [messages]);

  // Auth gate: don't render the chat UI for logged-out users.
  if (!authLoading && !user) {
    return (
      <div className={`page-container chat-window-shell ${styles.signInShell}`}>
        <Reveal>
          <div className="chat-state chat-state--card">
            <span aria-hidden="true" className="chat-state__icon chat-state__icon--ember">
              <Lock size={26} />
            </span>
            <h1 className="chat-state__title">{c.signInRequired}</h1>
            <p className="chat-state__body">{c.signInWindowBody}</p>
            <div className="chat-state__action">
              <Link href={`/login?next=${encodeURIComponent(router.asPath)}`} className="btn btn-ember">
                {c.signIn}
                <ArrowRight size={16} style={{ transform: isRTL ? "scaleX(-1)" : "none" }} />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    );
  }

  // Status-driven dot color for the rail. Maps only the canonical
  // RequestStatus set (types/index.ts): terminal states (closed/rejected/
  // referred) → done, active work (in_progress/awaiting_review) → active, and
  // pending (or anything unknown) → open. The retired 'resolved'/'done'
  // strings are intentionally not handled — they are not part of the contract.
  const statusDotClass = (() => {
    const s = linkedRequest?.status;
    if (s === "closed" || s === "rejected" || s === "referred") return "chat-status__dot--done";
    if (s === "in_progress" || s === "awaiting_review") return "chat-status__dot--active";
    return "chat-status__dot--open";
  })();

  // Role-aware destination for the "Open request" link (see usage below). The
  // beneficiary's request lives on /my-requests; staff/volunteer never see it
  // there, so route them to a surface that does.
  const openRequestHref = (() => {
    const id = linkedRequest?.id ?? "";
    if (linkedRequest && user && linkedRequest.beneficiaryId === user.uid) {
      return `/my-requests?focus=${encodeURIComponent(id)}`;
    }
    if (hasRole("admin")) return `/admin/requests/${encodeURIComponent(id)}`;
    // Assigned volunteer / handler — their work surface is the assigned board.
    return "/volunteer-hub/assigned";
  })();

  return (
    <div className="page-container chat-window-shell">
      {/* ── Slim top bar: back to list + open linked request ── */}
      <div className="chat-window-bar">
        <Link href="/chats" className="btn btn-outline btn-sm">
          <BackArrow size={16} />
          {c.allActiveChats}
        </Link>
        {linkedRequest && (
          <div className="chat-window-bar__actions">
            {/* req 9 — bidirectional link back to the request. Role-aware: the
                beneficiary owns the request on /my-requests, but the assigned
                volunteer and an admin never see it there (GET /requests/mine is
                beneficiary-scoped), so route them to the surface that actually
                shows the request — admin detail for admins, the volunteer hub
                assigned board for the assigned volunteer/handler. */}
            <Link
              href={openRequestHref}
              className="btn btn-ghost btn-sm"
              aria-label={c.openRequest}
              title={c.openRequest}
            >
              <FileText size={16} aria-hidden="true" />
              {c.openRequest}
            </Link>
          </div>
        )}
      </div>

      <div className="chat-window-layout">
        {/* ── Conversation (wide column): scrolling feed + composer ── */}
        <div className="chat-window-main">
          <Reveal>
            <div className="card chat-conv">
              {/* Message feed — live region so screen readers announce
                  incoming messages; focusable so it can be scrolled by keyboard. */}
              <MessageFeed
                ref={feedRef}
                messages={messages}
                msgsLoading={msgsLoading}
                msgsError={msgsError}
                currentUid={user?.uid}
                participants={participants}
                isGroup={isGroup}
                isRtl={isRtl}
                downloading={downloading}
                onDownload={handleDownload}
              />

              {/* Composer — sticks to the bottom of the panel. Read-only when
                  the chat is paused / its request ended; admins who are not
                  participants get a "join to write" control instead. */}
              <ChatComposer
                composerLocked={composerLocked}
                chatPaused={chatPaused}
                isStaffViewer={isStaffViewer}
                isRtl={isRtl}
                isRTL={isRTL}
                joinBusy={joinBusy}
                onJoin={handleJoin}
                uploading={uploading}
                sending={sending}
                inputText={inputText}
                onInputChange={setInputText}
                onSend={handleSend}
                onFilePick={handleFilePick}
              />
            </div>
          </Reveal>

          {sendError && (
            <div
              className="chat-send-error"
              role="alert"
              style={{ direction: isRtl ? "rtl" : "ltr" }}
            >
              <AlertCircle size={16} className={styles.sendErrorIcon} />
              <span>{c.sendError}</span>
            </div>
          )}
        </div>

        {/* ── Context rail (offset inline-end): identity + status + actions ── */}
        <ChatRail
          isRtl={isRtl}
          currentUid={user?.uid}
          participants={participants}
          isGroup={isGroup}
          canManageParticipants={canManageParticipants}
          isAdmin={hasRole("admin")}
          groupName={groupName}
          otherParticipant={otherParticipant}
          otherName={otherName}
          linkedRequest={linkedRequest}
          linkedRequestId={linkedRequestId}
          railRequestRef={railRequestRef}
          statusDotClass={statusDotClass}
          canMarkDone={canMarkDone}
          markingDone={markingDone}
          onMarkDone={handleMarkDone}
          canUseCloseConsent={canUseCloseConsent}
          closeReq={closeReq}
          otherProposed={otherProposed}
          iProposed={iProposed}
          closeProposerName={closeProposerName}
          closeBusy={closeBusy}
          onCloseAction={handleCloseAction}
          onRemoveTarget={setRemoveTarget}
          onAddOpen={() => {
            setAddError(null);
            setAddOpen(true);
          }}
        />
      </div>

      {/* Remove-participant confirmation (409 = protected core pair). */}
      <ConfirmDialog
        open={!!removeTarget}
        variant="danger"
        title={c.removeConfirmTitle}
        message={
          removeTarget
            ? c.removeConfirmBody(
                (removeTarget.displayName && removeTarget.displayName.trim()) ||
                  removeTarget.uid.slice(0, 6),
              )
            : ""
        }
        confirmLabel={c.removePerson}
        cancelLabel={t.common.cancel}
        busy={removeBusy}
        onConfirm={handleRemoveParticipant}
        onCancel={() => {
          if (!removeBusy) setRemoveTarget(null);
        }}
      />

      {/* Add-participant picker (admin-only data source). */}
      {hasRole("admin") && (
        <UserPickerDialog
          open={addOpen}
          heading={c.addPerson}
          confirmLabel={c.addPerson}
          busyLabel={c.addingPerson}
          busy={addBusy}
          error={addError}
          excludeUids={chatMeta?.participantUids ?? []}
          onConfirm={(uids) => handleAddPeople(uids)}
          onClose={() => {
            if (!addBusy) setAddOpen(false);
          }}
        />
      )}
    </div>
  );
}
