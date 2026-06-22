/*
 * RequestTimeline — the per-request event history shown on the beneficiary's
 * my-requests screen (feature #68). Self-fetching leaf: given a requestId it
 * pulls GET /api/requests/:id/events and renders an ordered, RTL-safe vertical
 * timeline (rail + dots) of lifecycle events (created/assigned/closed/etc).
 * Event type labels and the empty/loading copy come from the shared HE/EN
 * translations; dates are localized via formatDate. Fails silent (renders
 * nothing) on fetch error so a broken events endpoint never blocks the page.
 */
import { useEffect, useState } from "react";

import { apiJson } from "@/lib/apiClient";
import { formatDate } from "@/utils/helpers";

import type { Translations, TimelineEvent } from "./shared";
import styles from "./RequestTimeline.module.css";

// ── Request Timeline (#68) ────────────────────────────────────
// requestId selects which request's events to load; t carries lang + copy.
export function RequestTimeline({ requestId, t }: { requestId: string; t: Translations }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null); // null = loading, [] = empty (loaded, no events)
  const [error, setError] = useState(false);

  // fetch this request's events; refetch when requestId changes. `alive` guard
  // drops the result if the component unmounts (or requestId changes) mid-flight
  // so we never setState on a stale/unmounted instance.
  useEffect(() => {
    let alive = true;
    apiJson<{ events?: TimelineEvent[] }>(`/api/requests/${requestId}/events`)
      .then((data) => { if (alive) setEvents(Array.isArray(data.events) ? data.events : []); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [requestId]);

  const tl = t.myRequests.timeline;

  // fail silent: a broken/forbidden events endpoint must not break my-requests.
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
            // fall back to the raw type string when no translation exists for it.
            const typeLabel = tl.types[ev.type] || ev.type;
            const dateStr = ev.createdAt ? formatDate(ev.createdAt, t.lang) : "";
            const isLast = i === events.length - 1;
            return (
              <li key={ev.id} className="timeline-item">
                {/* rail connects an item to the next one, so the last item omits it */}
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
