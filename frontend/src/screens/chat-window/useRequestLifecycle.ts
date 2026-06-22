import { useState } from "react";

import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/apiClient";
import type { RequestStatus } from "@/types";
import type { LinkedRequest } from "./shared";

interface UseRequestLifecycleArgs {
  linkedRequest: LinkedRequest | null;
  setLinkedRequest: React.Dispatch<React.SetStateAction<LinkedRequest | null>>;
  refetchLinkedRequest: () => Promise<void>;
}

/**
 * Note 6 / req 25 — the volunteer's "Mark as done" control + the mutual-consent
 * close handshake. Derives the visibility guards from the linked request and the
 * signed-in user; lifecycle writes stay server-only.
 */
export function useRequestLifecycle({
  linkedRequest,
  setLinkedRequest,
  refetchLinkedRequest,
}: UseRequestLifecycleArgs) {
  const { user, hasRole } = useAuth();
  const { toast } = useApp();
  const { t } = useLanguage();
  const c = t.chat;
  const lc = t.lifecycle;

  const [markingDone, setMarkingDone] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);

  // Guard: show "Mark as done" only when the signed-in user is the request's
  // assigned volunteer/handler (admin is a superset of volunteer via hasRole)
  // and the request is currently `in_progress`. Lifecycle writes are
  // server-only; this only gates the control's visibility.
  const isAssignedHandler =
    !!linkedRequest &&
    !!user &&
    (linkedRequest.assignedVolunteerId === user.uid || linkedRequest.handler === user.uid);
  const canMarkDone =
    !!linkedRequest &&
    hasRole("volunteer") &&
    isAssignedHandler &&
    linkedRequest.status === "in_progress";

  async function handleMarkDone() {
    if (!linkedRequest || markingDone || !canMarkDone) return;
    if (typeof window !== "undefined" && !window.confirm(lc.actions.markDoneConfirm)) return;

    const prevStatus = linkedRequest.status;
    setMarkingDone(true);
    // Optimistic: reflect the new `awaiting_review` status immediately, which
    // also hides the button (canMarkDone requires `in_progress`).
    setLinkedRequest((r) => (r ? { ...r, status: "awaiting_review" } : r));

    try {
      const res = await apiFetch(`/api/requests/${linkedRequest.id}/done`, {
        method: "POST",
      });
      if (!res.ok) {
        setLinkedRequest((r) => (r ? { ...r, status: prevStatus } : r));
        toast(lc.actions.markDoneError, "error");
        return;
      }
      const updated = (await res.json().catch(() => null)) as Partial<LinkedRequest> | null;
      if (updated && typeof updated.status === "string") {
        setLinkedRequest((r) => (r ? { ...r, status: updated.status as RequestStatus } : r));
      }
      toast(lc.actions.markDoneSuccess, "success");
    } catch {
      setLinkedRequest((r) => (r ? { ...r, status: prevStatus } : r));
      toast(lc.actions.markDoneError, "error");
    } finally {
      setMarkingDone(false);
    }
  }

  // ── req 25 — mutual-consent close handshake ────────────────────────────
  // The caller's role is derived from the request: if the signed-in user owns
  // the request (beneficiaryId), they act as the beneficiary and hit the
  // beneficiary endpoint; the assigned volunteer/handler (which may be an
  // admin) acts as the volunteer side. This mirrors the server's CloseRole
  // split.
  const isBeneficiary =
    !!linkedRequest && !!user && linkedRequest.beneficiaryId === user.uid;
  const myCloseRole: "beneficiary" | "volunteer" = isBeneficiary
    ? "beneficiary"
    : "volunteer";
  // Only the beneficiary or the assigned handler may use the control. A
  // non-assigned admin is excluded on purpose: the backend's ownership check
  // 403s them, so showing the buttons would only produce error toasts.
  const canUseCloseConsent =
    !!linkedRequest &&
    !!user &&
    (isBeneficiary || isAssignedHandler) &&
    (linkedRequest.status === "in_progress" ||
      linkedRequest.status === "awaiting_review");

  const closeReq = linkedRequest?.closeRequest ?? null;
  // Did THIS side already propose / approve? (proposedRole is the initiator.)
  const iProposed =
    !!closeReq &&
    (myCloseRole === "beneficiary"
      ? closeReq.beneficiaryApproved === true
      : closeReq.volunteerApproved === true);
  // The other side initiated and is waiting on me to confirm.
  const otherProposed = !!closeReq && !iProposed;

  async function handleCloseAction(action: "propose" | "approve" | "decline") {
    if (!linkedRequest || closeBusy || !canUseCloseConsent) return;
    setCloseBusy(true);
    try {
      const endpoint =
        myCloseRole === "beneficiary"
          ? `/api/requests/${linkedRequest.id}/close`
          : `/api/volunteer/requests/${linkedRequest.id}/close`;
      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        toast(c.closeRequestError, "error");
        return;
      }
      // Always refetch so the strip reflects the authoritative server state
      // (closeRequest handshake fields and/or the new `closed` status).
      await refetchLinkedRequest();
    } catch {
      toast(c.closeRequestError, "error");
    } finally {
      setCloseBusy(false);
    }
  }

  return {
    canMarkDone,
    markingDone,
    handleMarkDone,
    canUseCloseConsent,
    closeReq,
    iProposed,
    otherProposed,
    closeBusy,
    handleCloseAction,
  };
}
