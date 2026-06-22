import { CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

import RatingForm from "@/components/forms/RatingForm";
import { apiJson } from "@/lib/apiClient";
import type { CaughtError } from "@/types";

import type { Translations } from "./shared";

import styles from "./RateExperienceCard.module.css";

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
    <div className={styles.card}>
      <div className={styles.title}>
        {r.cardTitle}
      </div>
      {alreadyRated ? (
        <div className={styles.thanks}>
          <CheckCircle size={16} aria-hidden="true" /> {r.thanks}
        </div>
      ) : (
        <>
          <p className={styles.subtitle}>
            {r.cardSubtitle}
          </p>
          <RatingForm onSubmit={handleSubmit} submitting={submitting} />
          {error && <div className={`form-error ${styles.errorSpacing}`}><span>{error}</span></div>}
        </>
      )}
    </div>
  );
}
