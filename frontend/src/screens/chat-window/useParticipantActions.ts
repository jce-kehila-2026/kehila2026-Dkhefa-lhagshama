import { useState } from "react";

import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/apiClient";
import type { ChatParticipant } from "./shared";

/**
 * Chat participant management hook (feedback round 2). Backs the chat-window UI:
 * admin self-join, adding people, and removing a participant, all hitting
 * /api/chats/:id/participants. Owns only the busy/dialog/error state and the
 * three write handlers; it does NOT update the roster itself. The live chat-doc
 * listener in useChatWindowData re-derives membership once a write lands, so
 * these handlers are fire-and-toast. Consumed by the chat-window screen.
 */
export function useParticipantActions(chatId: string | string[] | undefined) {
  // chatId arrives straight from the router param, hence string | string[] |
  // undefined; every handler guards `typeof chatId !== "string"` before writing.
  const { user } = useAuth();
  const { toast } = useApp();
  const { t } = useLanguage();
  const c = t.chat;

  const [joinBusy, setJoinBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ChatParticipant | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  // Admin self-join: POST own uid; the live chat-doc listener flips
  // membership (and re-fetches the participant map) once the write lands.
  async function handleJoin() {
    if (!user || typeof chatId !== "string" || joinBusy) return;
    setJoinBusy(true);
    try {
      const res = await apiFetch(`/api/chats/${chatId}/participants`, {
        method: "POST",
        body: JSON.stringify({ uid: user.uid }),
      });
      if (!res.ok) toast(c.joinError, "error");
    } catch {
      toast(c.joinError, "error");
    } finally {
      setJoinBusy(false);
    }
  }

  // Add the picked users one by one (the endpoint takes a single uid).
  async function handleAddPeople(uids: string[]) {
    if (typeof chatId !== "string" || addBusy) return;
    setAddBusy(true);
    setAddError(null);
    try {
      let failed = 0;
      for (const uid of uids) {
        const res = await apiFetch(`/api/chats/${chatId}/participants`, {
          method: "POST",
          body: JSON.stringify({ uid }),
        });
        if (!res.ok) failed++;
      }
      if (failed > 0) setAddError(c.addPersonError);
      else setAddOpen(false);
    } catch {
      setAddError(c.addPersonError);
    } finally {
      setAddBusy(false);
    }
  }

  // Remove a participant (confirmed via dialog). A 409 means the backend is
  // protecting the request's beneficiary / assigned volunteer.
  async function handleRemoveParticipant() {
    if (!removeTarget || typeof chatId !== "string" || removeBusy) return;
    setRemoveBusy(true);
    try {
      const res = await apiFetch(
        `/api/chats/${chatId}/participants/${encodeURIComponent(removeTarget.uid)}`,
        { method: "DELETE" },
      );
      if (res.status === 409) {
        toast(c.protectedParticipant, "error");
      } else if (!res.ok) {
        toast(c.removePersonError, "error");
      }
      setRemoveTarget(null);
    } catch {
      toast(c.removePersonError, "error");
    } finally {
      setRemoveBusy(false);
    }
  }

  return {
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
  };
}
