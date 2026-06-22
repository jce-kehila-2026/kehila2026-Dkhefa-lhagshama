import { Search, X } from "lucide-react";

import type { LucideIcon } from "lucide-react";

import Reveal from "@/components/motion/Reveal";

import { RequestCard } from "./RequestCard";
import { labelStyle } from "./shared";
import type { Translations, RequestRecord } from "./shared";

type ColKey = "open" | "inProgress" | "done";

interface BoardColumn {
  key: ColKey;
  title: string;
  items: RequestRecord[];
}

export function RequestBoard({
  t,
  lang,
  activeItems,
  archivedItems,
  columns,
  q,
  search,
  setSearch,
  cursorByCol,
  setCursorByCol,
  expandedId,
  handleToggle,
  focusId,
  focusCardRef,
  PrevIcon,
  NextIcon,
}: {
  t: Translations;
  lang: string;
  activeItems: RequestRecord[];
  archivedItems: RequestRecord[];
  columns: BoardColumn[];
  q: string;
  search: string;
  setSearch: (v: string) => void;
  cursorByCol: Record<ColKey, number>;
  setCursorByCol: (updater: (c: Record<ColKey, number>) => Record<ColKey, number>) => void;
  expandedId: string | null;
  handleToggle: (id: string) => void;
  focusId: string | null;
  focusCardRef: React.MutableRefObject<HTMLDivElement | null>;
  PrevIcon: LucideIcon;
  NextIcon: LucideIcon;
}) {
  return (
    <>
      {/* Active requests — archived ones are grouped separately below.
          The count + a shared search sit on one row. */}
      <div className="myreq-toolbar">
        <span style={{ ...labelStyle }} aria-live="polite">
          {activeItems.length} · {t.myRequests.title}
        </span>
        <div className="myreq-search">
          <Search size={16} aria-hidden="true" className="myreq-search-icon" />
          <input
            type="search"
            className="myreq-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.myRequests.searchPlaceholder}
            aria-label={t.myRequests.searchLabel}
          />
          {search && (
            <button
              type="button"
              className="myreq-search-clear"
              onClick={() => setSearch("")}
              aria-label={t.myRequests.searchClear}
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {q && activeItems.length === 0 && archivedItems.length === 0 ? (
        <p className="myreq-col-empty" style={{ paddingBlock: "32px" }}>
          {t.myRequests.noMatches}
        </p>
      ) : (
      /* req 10 — three status columns. Each column is a one-at-a-time
         carousel: a single card plus ◀ ▶ arrows (mirrors the admin
         candidate carousel). CSS collapses the grid to stacked sections
         on narrow screens. */
      <div className="myreq-board">
        {columns.map((col) => {
          const len = col.items.length;
          const idx = Math.min(cursorByCol[col.key], Math.max(0, len - 1));
          const item = col.items[idx];
          return (
            <section key={col.key} className="myreq-col" aria-label={col.title}>
              <div className="myreq-col-head">
                <h2 className="myreq-col-title" style={labelStyle}>{col.title}</h2>
                <span className="myreq-col-count">{len}</span>
              </div>
              <div className="myreq-col-body">
                {len === 0 || !item ? (
                  <p className="myreq-col-empty">{t.myRequests.columns.empty}</p>
                ) : (
                  <>
                    <Reveal key={item.id}>
                      <RequestCard
                        item={item}
                        t={t}
                        lang={lang}
                        expandedId={expandedId}
                        onToggle={handleToggle}
                        isFocused={focusId === item.id}
                        focusRef={focusId === item.id ? (el) => { focusCardRef.current = el; } : undefined}
                      />
                    </Reveal>
                    {len > 1 && (
                      <div className="myreq-carousel-nav">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          aria-label={t.myRequests.carouselPrev}
                          disabled={idx === 0}
                          onClick={() =>
                            setCursorByCol((c) => ({ ...c, [col.key]: Math.max(0, idx - 1) }))
                          }
                        >
                          <PrevIcon size={16} aria-hidden="true" />
                        </button>
                        <span className="myreq-carousel-counter" aria-live="polite">
                          {idx + 1} / {len}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          aria-label={t.myRequests.carouselNext}
                          disabled={idx >= len - 1}
                          onClick={() =>
                            setCursorByCol((c) => ({ ...c, [col.key]: Math.min(len - 1, idx + 1) }))
                          }
                        >
                          <NextIcon size={16} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
      )}

      {/* Past / archived requests — de-emphasized, not hidden (Note 6) */}
      {archivedItems.length > 0 && (
        <section className="myreq-archived-group" aria-label={t.lifecycle.archivedLabel}>
          <h2 className="myreq-archived-heading" style={labelStyle}>
            {t.lifecycle.archivedLabel}
          </h2>
          <div style={{ display: "grid", gap: "16px" }}>
            {archivedItems.map((item, i) => (
              <Reveal key={item.id} delay={Math.min(i * 0.05, 0.3)}>
                <RequestCard
                  item={item}
                  t={t}
                  lang={lang}
                  expandedId={expandedId}
                  onToggle={handleToggle}
                  isFocused={focusId === item.id}
                  focusRef={focusId === item.id ? (el) => { focusCardRef.current = el; } : undefined}
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
