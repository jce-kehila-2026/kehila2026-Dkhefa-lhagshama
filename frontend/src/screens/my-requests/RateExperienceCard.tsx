import { CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

import RatingForm from "@/components/forms/RatingForm";
import { apiJson } from "@/lib/apiClient";
import type { CaughtError } from "@/types";

import type { Translations } from "./shared";

// ── Rate-your-experience card (#80) ───────────────────────────
export function RateExperienceCard({ requestId, t }: { requestId: string; t: Translations }) {
  const r = t.ratings;
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<{ stars?: number } | null>(null); // null = unknown, {} = none

  // Check whether this request was already rated.
  useEffect(() => {
    let alive = true;
    apiJson<{ stars?: number }>(`/api/ratings/${requestId}`)
      .then((data) => { if (alive) setExisting(data); })
      .catch(() => { if (alive) setExisting({}); });
    return () => { alive = false; };
  }, [requestId]);

  const handleSubmit = async (stars: number, comment: string) => {
    setSubmitting(true);
    setError("");
    try {
      await apiJson("/api/ratings", {
        method: "POST",
        body: JSON.stringify({ requestId, stars, comment }),
      });
      setDone(true);
    } catch (err) {
      // Rating is only allowed once the request is `closed` (Note 6 — the
      // trigger moved off the retired `resolved` status). Accept either
      // backend error code so the "can only rate handled requests" message
      // shows regardless of the backend's exact wording.
      const code = (err as CaughtError)?.detail?.error;
      const notReady = code === "request_not_resolved" || code === "request_not_closed";
      setError(notReady ? r.errorNotResolved : r.error);
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyRated = done || (existing && typeof existing.stars === "number");

  return (
    <div
      style={{
        marginBlockStart: "20px",
        padding: "22px 24px",
        background: "var(--ember-soft)",
        border: "1px solid var(--ember-soft)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div style={{
        fontFamily: "Frank Ruhl Libre, Georgia, serif",
        fontSize: "1.15rem",
        fontWeight: 500,
        color: "var(--ink)",
        marginBlockEnd: "6px",
      }}>
        {r.cardTitle}
      </div>
      {alreadyRated ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--success)", fontSize: "14px", fontWeight: 600 }}>
          <CheckCircle size={16} aria-hidden="true" /> {r.thanks}
        </div>
      ) : (
        <>
          <p style={{ fontSize: "13px", color: "var(--gray-600)", marginBlockEnd: "16px", lineHeight: 1.6, maxWidth: "52ch" }}>
            {r.cardSubtitle}
          </p>
          <RatingForm onSubmit={handleSubmit} submitting={submitting} />
          {error && <div className="form-error" style={{ marginBlockStart: 10 }}><span>{error}</span></div>}
        </>
      )}
    </div>
  );
}
