import {
  MessageCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus,
  X,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import Reveal from "@/components/motion/Reveal";
import { ChatAvatar } from "./ChatAvatar";
import type { ChatParticipant, LinkedRequest } from "./shared";

interface ChatRailProps {
  isRtl: boolean;
  currentUid: string | undefined;
  participants: Record<string, ChatParticipant>;
  isGroup: boolean;
  canManageParticipants: boolean;
  isAdmin: boolean;
  groupName: string;
  otherParticipant: ChatParticipant | null;
  otherName: string;
  linkedRequest: LinkedRequest | null;
  linkedRequestId: string | null;
  railRequestRef: string;
  statusDotClass: string;
  canMarkDone: boolean;
  markingDone: boolean;
  onMarkDone: () => void;
  canUseCloseConsent: boolean;
  closeReq: LinkedRequest["closeRequest"];
  otherProposed: boolean;
  iProposed: boolean;
  closeProposerName: string;
  closeBusy: boolean;
  onCloseAction: (action: "propose" | "approve" | "decline") => void;
  onRemoveTarget: (p: ChatParticipant) => void;
  onAddOpen: () => void;
}

export function ChatRail({
  isRtl,
  currentUid,
  participants,
  isGroup,
  canManageParticipants,
  isAdmin,
  groupName,
  otherParticipant,
  otherName,
  linkedRequest,
  linkedRequestId,
  railRequestRef,
  statusDotClass,
  canMarkDone,
  markingDone,
  onMarkDone,
  canUseCloseConsent,
  closeReq,
  otherProposed,
  iProposed,
  closeProposerName,
  closeBusy,
  onCloseAction,
  onRemoveTarget,
  onAddOpen,
}: ChatRailProps) {
  const { t } = useLanguage();
  const c = t.chat;
  const lc = t.lifecycle;

  return (
    <aside className="chat-window-rail">
      <Reveal>
        {/* Identity — two-person chats keep the single-face headline;
            groups / direct chats (and managers) get a participants list
            with per-person remove + an add control when permitted. */}
        {isGroup || canManageParticipants ? (
          <div className="chat-rail-identity">
            <h1 className="chat-rail-name">{groupName}</h1>
            {linkedRequestId && (
              <p className="chat-rail-sub">
                {c.request} {railRequestRef}
              </p>
            )}
            <p className="chat-rail-people-label">{c.participantsTitle}</p>
            <ul className="chat-rail-people">
              {Object.values(participants).map((p) => {
                const name =
                  (p.displayName && p.displayName.trim()) ||
                  p.uid.slice(0, 6);
                const isSelf = p.uid === currentUid;
                return (
                  <li key={p.uid} className="chat-rail-person">
                    <ChatAvatar name={name} avatarUrl={p.avatarUrl} size="sm" />
                    <span className="chat-rail-person__name">
                      {name}
                      {isSelf && (
                        <span className="chat-rail-person__you">
                          {" "}
                          ({c.youTag})
                        </span>
                      )}
                    </span>
                    {canManageParticipants && !isSelf && (
                      <button
                        type="button"
                        className="chat-rail-person__remove"
                        onClick={() => onRemoveTarget(p)}
                        aria-label={`${c.removePerson}: ${name}`}
                        title={c.removePerson}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {/* Add control: admin-only (the picker reads the admin user
                roster; non-admin direct-chat creators have no source). */}
            {canManageParticipants && isAdmin && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onAddOpen}
              >
                <UserPlus size={15} aria-hidden="true" />
                {c.addPerson}
              </button>
            )}
          </div>
        ) : (
          <div className="chat-rail-identity">
            {otherParticipant ? (
              <ChatAvatar name={otherName} avatarUrl={otherParticipant.avatarUrl} size="lg" />
            ) : (
              <span
                aria-hidden="true"
                className="chat-avatar chat-avatar--lg"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ember)",
                }}
              >
                <MessageCircle size={24} />
              </span>
            )}
            <h1 className="chat-rail-name">
              {otherParticipant ? otherName : c.titleFallback}
            </h1>
            {linkedRequestId && (
              <p className="chat-rail-sub">
                {c.request} {railRequestRef}
              </p>
            )}
          </div>
        )}

        {/* ── Note 6 / req 25 — linked-request status + lifecycle actions ── */}
        {linkedRequest && (
          <div
            className={`chat-rail-status${
              linkedRequest.status === "closed" ? " chat-rail-status--closed" : ""
            }`}
            style={{ direction: isRtl ? "rtl" : "ltr" }}
          >
            <span className="chat-status">
              <span className={`chat-status__dot ${statusDotClass}`} aria-hidden="true" />
              <span className="chat-status__label">
                {lc.statusLabels[
                  linkedRequest.status as keyof typeof lc.statusLabels
                ] ?? linkedRequest.status}
              </span>
            </span>

            {(canMarkDone ||
              canUseCloseConsent ||
              linkedRequest.status === "closed") && (
              <div className="chat-rail-actions">
                {canMarkDone && (
                  <button
                    type="button"
                    className="btn btn-ember btn-sm"
                    onClick={onMarkDone}
                    disabled={markingDone}
                    aria-busy={markingDone}
                  >
                    {markingDone ? (
                      <Loader2 size={15} className="chat-action-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 size={15} aria-hidden="true" />
                    )}
                    {lc.actions.markDone}
                  </button>
                )}

                {/* ── req 25 — mutual-consent close handshake ──────────── */}
                {canUseCloseConsent && !closeReq && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onCloseAction("propose")}
                    disabled={closeBusy}
                    aria-busy={closeBusy}
                  >
                    {closeBusy ? (
                      <Loader2 size={15} className="chat-action-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 size={15} aria-hidden="true" />
                    )}
                    {c.requestClose}
                  </button>
                )}

                {canUseCloseConsent && closeReq && otherProposed && (
                  <>
                    <span className="chat-rail-note">
                      {c.otherAskedToClose(closeProposerName)}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ember btn-sm"
                      onClick={() => onCloseAction("approve")}
                      disabled={closeBusy}
                      aria-busy={closeBusy}
                    >
                      {closeBusy ? (
                        <Loader2 size={15} className="chat-action-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 size={15} aria-hidden="true" />
                      )}
                      {c.confirmClose}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onCloseAction("decline")}
                      disabled={closeBusy}
                    >
                      <XCircle size={15} aria-hidden="true" />
                      {c.declineClose}
                    </button>
                  </>
                )}

                {canUseCloseConsent && closeReq && iProposed && (
                  <>
                    <span className="chat-rail-note">
                      <Clock
                        size={14}
                        aria-hidden="true"
                        style={{ verticalAlign: "-2px", marginInlineEnd: "6px" }}
                      />
                      {c.waitingToClose}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onCloseAction("decline")}
                      disabled={closeBusy}
                      aria-busy={closeBusy}
                    >
                      {closeBusy ? (
                        <Loader2 size={15} className="chat-action-spin" aria-hidden="true" />
                      ) : (
                        <XCircle size={15} aria-hidden="true" />
                      )}
                      {c.cancelCloseRequest}
                    </button>
                  </>
                )}

                {linkedRequest.status === "closed" && (
                  <span className="chat-rail-note">{c.closed}</span>
                )}
              </div>
            )}
          </div>
        )}
      </Reveal>
    </aside>
  );
}
