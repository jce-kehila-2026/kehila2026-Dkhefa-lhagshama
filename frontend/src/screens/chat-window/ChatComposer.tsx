/*
 * ChatComposer — the bottom bar of a chat window (chat-window screen).
 * Pure presentational component: it holds no chat state and does no
 * network/business logic itself. The parent chat screen owns send/upload/
 * join state and passes everything in via props; this component only
 * decides WHICH of three mutually-exclusive UIs to render:
 *   1. locked  -> read-only note (chat paused or its request ended)
 *   2. staff viewer -> "join to write" control (admins who aren't participants)
 *   3. default -> the message form (attach + text input + send)
 * note: both isRtl (used for layout direction) and isRTL (used to mirror the
 * send icon) are distinct props from the parent and both are required.
 */
import { useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Lock, Eye, Loader2, UserPlus, Send, Paperclip } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import styles from "./ChatComposer.module.css";

interface ChatComposerProps {
  composerLocked: boolean;
  chatPaused: boolean;
  isStaffViewer: boolean;
  isRtl: boolean;
  isRTL: boolean;
  joinBusy: boolean;
  onJoin: () => void;
  uploading: boolean;
  sending: boolean;
  inputText: string;
  onInputChange: (value: string) => void;
  onSend: (e: FormEvent<HTMLFormElement>) => void;
  onFilePick: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function ChatComposer({
  composerLocked,
  chatPaused,
  isStaffViewer,
  isRtl,
  isRTL,
  joinBusy,
  onJoin,
  uploading,
  sending,
  inputText,
  onInputChange,
  onSend,
  onFilePick,
}: ChatComposerProps) {
  const { t } = useLanguage();
  const c = t.chat; // chat-scoped i18n strings (HE/EN)
  // drives the hidden <input type=file>; clicked indirectly via the paperclip btn
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // branch 1: chat is paused or its request ended -> show a read-only note,
  // distinct copy for the paused vs ended case.
  if (composerLocked) {
    return (
      <div
        className="chat-composer-note"
        role="status"
        style={{ direction: isRtl ? "rtl" : "ltr" }}
      >
        <Lock size={16} aria-hidden="true" />
        <span>{chatPaused ? c.chatPausedNote : c.chatEndedNote}</span>
      </div>
    );
  }

  // branch 2: admin/staff observing a chat they don't belong to -> can read
  // but not write until they join; onJoin is owned by the parent, joinBusy
  // toggles the spinner + disables the button.
  if (isStaffViewer) {
    return (
      <div
        className="chat-composer-note"
        role="status"
        style={{ direction: isRtl ? "rtl" : "ltr" }}
      >
        <Eye size={16} aria-hidden="true" />
        <span>{c.staffViewNote}</span>
        <button
          type="button"
          className="btn btn-ember btn-sm"
          onClick={onJoin}
          disabled={joinBusy}
          aria-busy={joinBusy}
        >
          {joinBusy ? (
            <Loader2 size={15} className="chat-action-spin" aria-hidden="true" />
          ) : (
            <UserPlus size={15} aria-hidden="true" />
          )}
          {joinBusy ? c.joining : c.joinChat}
        </button>
      </div>
    );
  }

  // branch 3 (default): the live message form. submit is gated on a
  // non-empty trimmed input; attach + text are disabled while sending,
  // and attach is additionally disabled while a prior upload is in flight.
  return (
    <form
      onSubmit={onSend}
      className="chat-composer"
      style={{ direction: isRtl ? "rtl" : "ltr" }}
    >
      {/* req 26 — file attach: hidden input driven by a paperclip btn */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={onFilePick}
        disabled={uploading || sending}
        className={styles.hiddenInput}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className="chat-attach-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || sending}
        aria-busy={uploading}
        aria-label={uploading ? c.uploading : c.attachFile}
        title={uploading ? c.uploading : c.attachFile}
      >
        {uploading ? (
          <Loader2 size={18} className="chat-attach-btn__spin" aria-hidden="true" />
        ) : (
          <Paperclip size={18} aria-hidden="true" />
        )}
      </button>
      <input
        type="text"
        name="message"
        autoComplete="off"
        enterKeyHint="send"
        className="chat-composer__input"
        value={inputText}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={c.inputPH}
        disabled={uploading || sending}
        aria-label={c.inputPH}
        style={{ direction: isRtl ? "rtl" : "ltr" }}
      />
      <button
        type="submit"
        className={`btn btn-ember ${styles.sendBtn}`}
        disabled={uploading || sending || !inputText.trim()}
      >
        {sending ? c.sending : c.send}
        <Send size={15} style={{ transform: isRTL ? "scaleX(-1)" : "none" }} />
      </button>
    </form>
  );
}
