import { useEffect, useState } from "react";

import { apiJson } from "@/lib/apiClient";
import { formatDate } from "@/utils/helpers";

import type { Translations, TimelineEvent } from "./shared";
import styles from "./RequestTimeline.module.css";

// ── Request Timeline (#68) ────────────────────────────────────
export function RequestTimeline({ requestId, t }: { requestId: string; t: Translations }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null); // null = loading, [] = empty
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    apiJson<{ events?: TimelineEvent[] }>(`/api/requests/${requestId}/events`)
      .then((data) => { if (alive) setEvents(Array.isArray(data.events) ? data.events : []); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [requestId]);

  const tl = t.myRequests.timeline;

  if (error) return null;
  if (events === null) {
    return (
      <div className={styles.loading}>
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.label}>
        {tl.title}
      </div>
      {events.length === 0 ? (
        <div className={styles.noEvents}>{tl.noEvents}</div>
      ) : (
        <ol className="timeline">
          {events.map((ev: TimelineEvent, i: number) => {
            const typeLabel = tl.types[ev.type] || ev.type;
            const dateStr = ev.createdAt ? formatDate(ev.createdAt, t.lang) : "";
            const isLast = i === events.length - 1;
            return (
              <li key={ev.id} className="timeline-item">
                {!isLast && <span className="timeline-rail" aria-hidden="true" />}
                <span className="timeline-dot" aria-hidden="true" />
                <div className={styles.itemBody}>
                  <div className="timeline-title">{typeLabel}</div>
                  {dateStr && <div className="timeline-time">{dateStr}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
