import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle, ChevronLeft, ChevronRight, Plus, UserCheck } from "lucide-react";

import SuggestCard from "@/components/SuggestCard";
import Reveal from "../components/motion/Reveal";
import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useCategories } from "../hooks/useCategories";
import { apiJson } from "../lib/apiClient";
import { formatRequestRef } from "../lib/requestRef";
import { RequestBoard } from "./my-requests/RequestBoard";
import { LoadingSkeleton, LoadErrorState, EmptyState } from "./my-requests/RequestStates";
import { SAVE_PROFILE_OFFER_KEY } from "./my-requests/shared";
import type { Translations, RequestRecord, SaveProfileOffer } from "./my-requests/shared";
import type { CaughtError, Suggestion } from "@/types";

// ── Main page ─────────────────────────────────────────────────
export default function MyRequestsPage() {
  const { t: tRaw, lang, isRTL } = useLanguage();
  const t = tRaw as unknown as Translations;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useApp();
  const router = useRouter();
  const { labelFor } = useCategories();
  // Mirror the carousel chevrons in RTL so "previous" points to the start of
  // the reading direction.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  const [items, setItems] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // One-at-a-time carousel: the visible card index per status column. A shared
  // search filters all three columns at once.
  const [search, setSearch] = useState("");
  const [cursorByCol, setCursorByCol] = useState<Record<"open" | "inProgress" | "done", number>>({
    open: 0,
    inProgress: 0,
    done: 0,
  });

  // Suggest-alternatives (UC-01 A1) — community answers in the new request's
  // category. Dismissible; only shown when there's at least one match.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestDismissed, setSuggestDismissed] = useState(false);

  // #94 — detect ?new=<id> and show success banner
  const newId = (typeof router.query.new === "string" ? router.query.new : null) || null;

  // req 9 — ?focus=<id> arrives from the chat window's "open request" link;
  // scroll to + highlight the matching card.
  const focusId = (typeof router.query.focus === "string" ? router.query.focus : null) || null;
  const focusCardRef = useRef<HTMLDivElement | null>(null);

  // #67 — save-to-profile offer (moved here from the request form, whose
  // post-submit redirect unmounted it before the offer could render).
  const [saveOffer, setSaveOffer] = useState<SaveProfileOffer | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const offerActedRef = useRef(false);

  // Read the stash only when we arrived via ?new= (i.e., straight from a
  // submit). The stash stays in sessionStorage until the user acts on it.
  useEffect(() => {
    if (!newId || !user) return;
    try {
      const raw = window.sessionStorage?.getItem(SAVE_PROFILE_OFFER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SaveProfileOffer;
      // uid-bound: a stash written by a different (or unknown) account — e.g.
      // a previous user on a shared computer — is dropped, never rendered.
      if (parsed.uid !== user.uid) {
        window.sessionStorage?.removeItem(SAVE_PROFILE_OFFER_KEY);
        return;
      }
      setSaveOffer(parsed);
    } catch { /* corrupt stash — ignore, never block the page */ }
  }, [newId, user]);

  // Either action (save or dismiss) clears the stash — PII hygiene: the
  // personal details live only until acted on.
  const clearSaveOffer = useCallback(() => {
    offerActedRef.current = true;
    try { window.sessionStorage?.removeItem(SAVE_PROFILE_OFFER_KEY); } catch { /* noop */ }
    setSaveOffer(null);
  }, []);

  // Belt-and-braces: if the page unmounts after an action, make sure the
  // stash is gone (clearSaveOffer already removed it; this covers any race).
  useEffect(() => () => {
    if (offerActedRef.current) {
      try { window.sessionStorage?.removeItem(SAVE_PROFILE_OFFER_KEY); } catch { /* noop */ }
    }
  }, []);

  // #67 — moved from RequestsPage.offerSaveProfile: PATCH the stashed fields
  // into the profile. apiJson throws on non-2xx, so failures surface as the
  // error toast. The stash is cleared either way (the user acted).
  const handleSaveOffer = useCallback(async () => {
    if (!saveOffer || savingProfile) return;
    setSavingProfile(true);
    try {
      await apiJson("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: saveOffer.firstName,
          lastName:  saveOffer.lastName,
          phone:     saveOffer.phone,
          city:      saveOffer.city,
          age:       Number(saveOffer.age) || undefined,
          gender:    saveOffer.gender || undefined,
        }),
      });
      toast(t.stream2.autoFill.saved, "success");
    } catch {
      toast(t.stream2.autoFill.saveError, "error");
    } finally {
      setSavingProfile(false);
    }
    clearSaveOffer();
  }, [saveOffer, savingProfile, toast, t, clearSaveOffer]);

  useEffect(() => {
    if (authLoading || user) return;
    // Grace window before redirecting on (authLoading=false, user=null):
    // Firebase can briefly emit a null user during a token refresh before
    // re-emitting the signed-in user, and redirecting on that transient null
    // bounced authenticated beneficiaries to /login while navigating
    // /requests -> /my-requests. Cancelled the moment the user reappears.
    const handle = setTimeout(() => {
      router.replace(`/login?next=${encodeURIComponent("/my-requests")}`);
    }, 600);
    return () => clearTimeout(handle);
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;

    let alive = true;
    const loadRequests = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiJson("/api/requests/mine") as { items?: RequestRecord[] };
        if (!alive) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        // Auto-expand the newly submitted request so the user sees it (#94)
        if (newId) setExpandedId(newId);
      } catch (err) {
        if (!alive) return;
        if ((err as CaughtError)?.status === 401) {
          router.replace(`/login?next=${encodeURIComponent("/my-requests")}`);
          return;
        }
        setError((err as CaughtError)?.status === 404 ? "not_found" : "load_failed");
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadRequests();
    return () => { alive = false; };
  }, [authLoading, user, router, newId]);

  // After the requests load, if we arrived via ?new=<id>, look up that
  // request's category and fetch up to 3 approved community answers in the
  // same category (public endpoint). Dismissal is handled locally below.
  useEffect(() => {
    if (!newId || items.length === 0) return;
    const fresh = items.find((it) => it.id === newId);
    const category = fresh?.category;
    if (!category) return;

    let alive = true;
    apiJson<{ items?: Suggestion[] }>(`/api/suggestions?category=${encodeURIComponent(category)}`)
      .then((data) => { if (alive) setSuggestions(Array.isArray(data.items) ? data.items : []); })
      .catch(() => { if (alive) setSuggestions([]); });
    return () => { alive = false; };
  }, [newId, items]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // req 9 — once the focused request is present, expand + scroll to it.
  useEffect(() => {
    if (!focusId || loading) return;
    if (!items.some((it) => it.id === focusId)) return;
    setExpandedId(focusId);
    const el = focusCardRef.current;
    if (el) {
      // Defer so the expand has laid out before we scroll.
      const id = window.setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      return () => window.clearTimeout(id);
    }
  }, [focusId, loading, items]);

  // Shared search — filters all three status columns (and the archived group)
  // at once. Matches the friendly REQ-#### ref, the category label, the raw
  // description, and the localized status label.
  const q = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (it: RequestRecord) => {
      if (!q) return true;
      const statusLabel = (t.lifecycle.statusLabels as Record<string, string>)[it.status] || it.status;
      const hay = [
        formatRequestRef(it),
        labelFor(it.category),
        it.category || "",
        it.description || "",
        statusLabel,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    },
    [q, t, labelFor],
  );

  // Active vs. archived split — archived requests stay visible to their owner
  // but are grouped/de-emphasized as "past" rather than hidden (Note 6).
  const activeItems = items.filter((it) => it.archived !== true && matchesSearch(it));
  const archivedItems = items.filter((it) => it.archived === true && matchesSearch(it));

  // req 10 — group active requests into 3 kanban-style status columns.
  // `done` is a CATCH-ALL: anything not explicitly "open" or "in progress"
  // (closed, rejected, the legacy `resolved`, or any unexpected status) lands
  // here so a request can never silently vanish from the board.
  const OPEN_STATUSES = ["pending", "referred"];
  const IN_PROGRESS_STATUSES = ["in_progress", "awaiting_review"];
  const columnFor = (status: string): "open" | "inProgress" | "done" => {
    if (OPEN_STATUSES.includes(status)) return "open";
    if (IN_PROGRESS_STATUSES.includes(status)) return "inProgress";
    return "done";
  };
  const columns = (["open", "inProgress", "done"] as const).map((key) => ({
    key,
    title: t.myRequests.columns[key],
    items: activeItems.filter((it) => columnFor(it.status) === key),
  }));

  return (
    <>
      {/* ── COMPACT INLINE HEADER — eyebrow → serif title → lede + CTA (start-aligned) ── */}
      <section className="myreq-header">
        <div className="page-container myreq-header-container myreq-header-container-compact">
          <Reveal>
            <div className="myreq-header-inner">
              <div className="myreq-header-copy">
                <span className="eyebrow myreq-header-eyebrow">{t.myRequests.inlineHeader.eyebrow}</span>
                <h1 className="section-display-bold myreq-header-title">{t.myRequests.inlineHeader.title}</h1>
                <p className="section-lede myreq-header-lede">{t.myRequests.inlineHeader.lede}</p>
              </div>
              <Link href="/requests" className="btn btn-ember myreq-header-cta">
                <Plus size={16} aria-hidden="true" />
                {t.myRequests.submitCta}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="page-container myreq-shell-compact">

        {/* WS-2 — consolidated post-submit banner: success + ref + save-to-profile
            on one compact surface (was three stacked blocks). */}
        {newId && !loading && (
          <Reveal>
            <div className="myreq-new-banner" role="status">
              <CheckCircle size={18} aria-hidden="true" className="myreq-new-banner-icon" />
              <div className="myreq-new-banner-body">
                <div className="myreq-new-banner-title">{t.stream2.newRequestBadge}</div>
                <div className="myreq-new-banner-ref">
                  {formatRequestRef(items.find((it) => it.id === newId) ?? { id: newId })}
                </div>
              </div>
              {/* #67 — save-to-profile offer, folded into the same banner. */}
              {saveOffer && (
                <div className="myreq-new-banner-save">
                  <span className="myreq-new-banner-save-text">
                    <UserCheck size={15} aria-hidden="true" style={{ marginInlineEnd: "6px", verticalAlign: "-3px", color: "var(--ember)" }} />
                    {t.stream2.autoFill.saveToProfile}
                  </span>
                  <div className="myreq-new-banner-save-actions">
                    <button
                      type="button"
                      className={`btn btn-outline btn-sm${savingProfile ? " is-loading" : ""}`}
                      onClick={handleSaveOffer}
                      disabled={savingProfile}
                      aria-busy={savingProfile}
                    >
                      {t.common.save}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={clearSaveOffer}
                      disabled={savingProfile}
                    >
                      {t.myRequests.suggest.dismiss}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        )}

        {/* UC-01 A1 — suggest-alternatives card (dismissible, below the status banner) */}
        {!suggestDismissed && suggestions.length > 0 && (
          <Reveal>
            <SuggestCard
              items={suggestions}
              lang={lang}
              heading={t.myRequests.suggest.heading}
              subtitle={t.myRequests.suggest.subtitle}
              openLabel={t.myRequests.suggest.open}
              callLabel={String(t.directory.modal["call"])}
              emailLabel={String(t.directory.modal["email"])}
              directoryLabel={String(t.myRequests.suggest.directory)}
              dismissLabel={t.myRequests.suggest.dismiss}
              onDismiss={() => setSuggestDismissed(true)}
            />
          </Reveal>
        )}

        {loading || authLoading ? (
          <LoadingSkeleton t={t} />
        ) : error ? (
          <LoadErrorState t={t} />
        ) : items.length === 0 ? (
          <Reveal>
            <EmptyState t={t} />
          </Reveal>
        ) : (
          <RequestBoard
            t={t}
            lang={lang}
            activeItems={activeItems}
            archivedItems={archivedItems}
            columns={columns}
            q={q}
            search={search}
            setSearch={setSearch}
            cursorByCol={cursorByCol}
            setCursorByCol={setCursorByCol}
            expandedId={expandedId}
            handleToggle={handleToggle}
            focusId={focusId}
            focusCardRef={focusCardRef}
            PrevIcon={PrevIcon}
            NextIcon={NextIcon}
          />
        )}
      </div>
    </>
  );
}
