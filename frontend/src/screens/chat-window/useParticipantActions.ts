import { useState } from "react";

import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/apiClient";
import type { ChatParticipant } from "./shared";

/**
 * Participant management + admin self-join (feedback round 2). Owns the busy /
 * dialog state and the three write handlers; the live chat-doc listener (in
 * useChatWindowData) flips membership once the writes land.
 */
export function useParticipantActions(chatId: string | string[] | undefined) {
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
      for (const uid of uids) {
        const res = await apiFetch(`/api/chats/${chatId}/participants`, {
          method: "POST",
          body: JSON.stringify({ uid }),
        });
        if (!res.ok) {
          setAddError(c.addPersonError);
          return;
        }
      }
      setAddOpen(false);
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
