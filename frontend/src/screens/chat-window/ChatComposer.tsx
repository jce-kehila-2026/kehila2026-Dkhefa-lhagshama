import { useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Lock, Eye, Loader2, UserPlus, Send, Paperclip } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";

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
  const c = t.chat;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Composer — sticks to the bottom of the panel. Read-only when
  // the chat is paused / its request ended; admins who are not
  // participants get a "join to write" control instead.
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
        style={{ display: "none" }}
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
        disabled={sending}
        aria-label={c.inputPH}
        style={{ direction: isRtl ? "rtl" : "ltr" }}
      />
      <button
        type="submit"
        className="btn btn-ember"
        disabled={sending || !inputText.trim()}
        style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexShrink: 0 }}
      >
        {sending ? c.sending : c.send}
        <Send size={15} style={{ transform: isRTL ? "scaleX(-1)" : "none" }} />
      </button>
    </form>
  );
}
