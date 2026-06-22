import { useLanguage } from "@/contexts/LanguageContext";
import { toInitials } from "./shared";

// ── Note 11 — avatar: photo when available, initials circle otherwise ──
export function ChatAvatar({
  name,
  avatarUrl,
  size,
}: {
  name: string;
  avatarUrl: string | null;
  size: "sm" | "md" | "lg";
}) {
  const { t } = useLanguage();
  const c = t.chat;
  const px = size === "sm" ? 28 : size === "lg" ? 52 : 40;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={c.avatarAlt(name)}
        width={px}
        height={px}
        className={`chat-avatar chat-avatar--${size}`}
      />
    );
  }
  return (
    <span
      className={`chat-avatar chat-avatar--initials chat-avatar--${size}`}
      role="img"
      aria-label={c.avatarAlt(name)}
    >
      {toInitials(name)}
    </span>
  );
}
