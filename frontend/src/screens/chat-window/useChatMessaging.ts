import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { useApp } from "@/contexts/AppContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/apiClient";
import { getIdToken } from "@/lib/auth";
import type { ChatMessage } from "@/hooks/useMessages";
import {
  API_BASE,
  MAX_ATTACHMENT_BYTES,
  ALLOWED_ATTACHMENT_TYPES,
  ALLOWED_ATTACHMENT_EXTS,
} from "./shared";

/**
 * Composer + attachment messaging (req 26). Owns the input / send / upload /
 * download state and their handlers; the realtime message listener renders the
 * resulting messages, so no optimistic inserts are needed.
 */
export function useChatMessaging(chatId: string | string[] | undefined) {
  const { toast } = useApp();
  const { t } = useLanguage();
  const c = t.chat;

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // ── req 26 — file attachments ──────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  // Attachment names currently being fetched a signed URL for (per-bubble busy).
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  async function handleSend(e: FormEvent<HTMLFormElement>) {
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

  // req 26 — validate then raw-upload a picked file. The realtime listener
  // renders the resulting attachment message; no optimistic insert needed.
  async function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    // Reset the input so picking the same file again re-fires onChange.
    e.target.value = "";
    if (!file || uploading || typeof chatId !== "string") return;

    const lowerName = file.name.toLowerCase();
    const typeOk =
      ALLOWED_ATTACHMENT_TYPES.has(file.type) ||
      ALLOWED_ATTACHMENT_EXTS.some((ext) => lowerName.endsWith(ext));
    if (!typeOk) {
      toast(c.badFileType, "error");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast(c.fileTooLarge, "error");
      return;
    }

    setUploading(true);
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        toast(c.uploadFailed, "error");
        return;
      }
      const url = `${API_BASE}/api/chats/${encodeURIComponent(
        chatId,
      )}/attachments?filename=${encodeURIComponent(file.name)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!res.ok) {
        toast(c.uploadFailed, "error");
        return;
      }
    } catch {
      toast(c.uploadFailed, "error");
    } finally {
      setUploading(false);
    }
  }

  // req 26 — open an attachment: mint a short-lived signed URL, then open it
  // in a new tab. Works for both mine and incoming messages.
  async function handleDownload(att: NonNullable<ChatMessage["attachment"]>) {
    if (typeof chatId !== "string" || downloading[att.name]) return;
    setDownloading((d) => ({ ...d, [att.name]: true }));
    // Open the tab synchronously, inside the click's transient activation:
    // Safari (and strict popup settings) block window.open after an await.
    // Detach it from this page, then point it at the signed URL once minted;
    // close it again on any failure so no blank tab is left behind.
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    try {
      const res = await apiFetch(
        `/api/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(att.name)}`,
      );
      if (!res.ok) {
        win?.close();
        toast(c.downloadFailed, "error");
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data?.url) {
        win?.close();
        toast(c.downloadFailed, "error");
        return;
      }
      if (win) {
        win.location.replace(data.url);
      } else {
        // Popup denied even synchronously — best-effort fallback.
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      win?.close();
      toast(c.downloadFailed, "error");
    } finally {
      setDownloading((d) => {
        const next = { ...d };
        delete next[att.name];
        return next;
      });
    }
  }

  return {
    inputText,
    setInputText,
    sending,
    sendError,
    uploading,
    downloading,
    handleSend,
    handleFilePick,
    handleDownload,
  };
}
