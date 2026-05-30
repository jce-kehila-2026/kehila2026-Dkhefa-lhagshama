import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { apiJson } from "../lib/apiClient";
import { formatDate, truncate } from "../utils/helpers";

// ── Deadline pill (#68) ───────────────────────────────────────
function DeadlinePill({ deadline, t }) {
  if (!deadline) return <span style={{ color: "var(--gray-400)" }}>—</span>;
  const days = Math.round((new Date(deadline) - Date.now()) / 86400000);
  const overdue = days < 0;
  const label = t.myRequests.dueIn(days);
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 500,
      background: overdue ? "#FEE2E2" : days <= 3 ? "#FEF3C7" : "var(--sky-2)",
      color: overdue ? "#991B1B" : days <= 3 ? "#92400E" : "var(--ink-2)",
      border: `1px solid ${overdue ? "#FECACA" : days <= 3 ? "#FDE68A" : "var(--hair)"}`,
    }}>
      {label}
    </span>
  );
}

// ── Request Timeline (#68) ────────────────────────────────────
function RequestTimeline({ requestId, t }) {
  const [events, setEvents] = useState(null); // null = loading, [] = empty
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    apiJson(`/api/requests/${requestId}/events`)
      .then((data) => { if (alive) setEvents(Array.isArray(data.events) ? data.events : []); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [requestId]);

  const tl = t.myRequests.timeline;

  if (error) return null;
  if (events === null) {
    return (
      <div style={{ padding: "12px 0", color: "var(--gray-400)", fontSize: "13px" }}>
        {t.common.loading}
      </div>
    );
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
        {tl.title}
      </div>
      {events.length === 0 ? (
        <div style={{ color: "var(--gray-400)", fontSize: "13px" }}>{tl.noEvents}</div>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
          {events.map((ev, i) => {
            const typeLabel = tl.types[ev.type] || ev.type;
            const dateStr = ev.createdAt ? formatDate(ev.createdAt, t.lang) : "";
            const isLast = i === events.length - 1;
            return (
              <li key={ev.id} style={{ display: "flex", gap: "12px", paddingBottom: isLast ? 0 : "14px", position: "relative" }}>
                {/* Connector line */}
                {!isLast && (
                  <div style={{
                    position: "absolute",
                    left: "9px",
                    top: "20px",
                    bottom: 0,
                    width: "2px",
                    background: "var(--hair)",
                  }} />
                )}
                {/* Dot */}
                <div style={{
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "var(--ember)", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 1,
                }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff" }} />
                </div>
                <div style={{ flex: 1, paddingTop: "1px" }}>
                  <div style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--ink)" }}>{typeLabel}</div>
                  {dateStr && <div style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "2px" }}>{dateStr}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ── Row with expandable timeline ──────────────────────────────
function RequestRow({ item, t, lang, expandedId, onToggle }) {
  const isExpanded = expandedId === item.id;
  const categoryLabel = (cat) => t.myRequests.categories[cat] || cat;
  const urgencyLabel  = (urg) => t.myRequests.urgencies[urg]  || urg;

  return (
    <>
      <tr
        style={{
          borderTop: "1px solid var(--hair)",
          background: isExpanded ? "var(--sky-2)" : "var(--paper)",
          cursor: "pointer",
        }}
        onClick={() => onToggle(item.id)}
      >
        <td style={tdStyle}>
          <div style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: "13px", color: "var(--ink)", letterSpacing: "0.04em",
          }}>
            {item.id}
          </div>
          <div style={{ marginTop: "6px", color: "var(--ink-2)", fontSize: "13px" }}>
            {truncate(item.description || "", 72)}
          </div>
        </td>
        <td style={tdStyle}>{categoryLabel(item.category)}</td>
        <td style={tdStyle}>{urgencyLabel(item.urgency)}</td>
        <td style={tdStyle}><StatusBadge status={item.status} /></td>
        <td style={tdStyle}>{formatDate(item.createdAt, lang) || "—"}</td>
        {/* #68 — deadline pill */}
        <td style={tdStyle}><DeadlinePill deadline={item.deadline} t={t} /></td>
        <td style={tdStyle}>{Array.isArray(item.attachmentPaths) ? item.attachmentPaths.length : 0}</td>
        <td style={{ ...tdStyle, color: "var(--gray-400)" }}>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </td>
      </tr>
      {/* Expanded timeline row (#68) */}
      {isExpanded && (
        <tr style={{ background: "var(--sky-2)", borderTop: "1px solid var(--hair)" }}>
          <td colSpan={8} style={{ padding: "16px 24px 20px" }}>
            <RequestTimeline requestId={item.id} t={t} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function MyRequestsPage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // #94 — detect ?new=<id> and show success banner
  const newId = router.query.new || null;

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent("/my-requests")}`);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;

    let alive = true;
    const loadRequests = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiJson("/api/requests/mine");
        if (!alive) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        // Auto-expand the newly submitted request so the user sees it (#94)
        if (newId) setExpandedId(newId);
      } catch (err) {
        if (!alive) return;
        if (err?.status === 401) {
          router.replace(`/login?next=${encodeURIComponent("/my-requests")}`);
          return;
        }
        setError(err?.status === 404 ? "not_found" : "load_failed");
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadRequests();
    return () => { alive = false; };
  }, [authLoading, user, router, newId]);

  const handleToggle = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <>
      <PageHeader title={t.myRequests.title} subtitle={t.myRequests.subtitle}>
        <div style={{ marginTop: "22px", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "10px" }}>
          <Link href="/requests" className="btn btn-primary btn-sm">
            {t.myRequests.submitCta}
          </Link>
        </div>
      </PageHeader>

      <div className="page-container" style={{ maxWidth: "1200px", padding: "42px 1.5rem 72px" }}>

        {/* #94 — New-request success banner */}
        {newId && !loading && (
          <div style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "14px 20px", marginBottom: "24px",
            background: "#ECFDF5", border: "1px solid #6EE7B7",
            borderRadius: "10px",
          }}>
            <CheckCircle size={20} color="#059669" />
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#065F46" }}>
                {t.stream2.newRequestBadge}
              </div>
              <div style={{ fontSize: "12.5px", color: "#047857", fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
                {newId}
              </div>
            </div>
          </div>
        )}

        {loading || authLoading ? (
          <div className="card" style={{ padding: "28px", textAlign: "center" }}>
            {t.myRequests.loading}
          </div>
        ) : error ? (
          <div className="card" style={{ padding: "28px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--ink)", marginBottom: "8px" }}>
              {lang === "he" ? "אירעה שגיאה בטעינת הבקשות" : "We could not load your requests"}
            </h2>
            <p style={{ color: "var(--gray-500)", marginBottom: "18px", lineHeight: 1.7 }}>
              {lang === "he"
                ? "נסה/י לרענן את הדף או לחזור שוב מאוחר יותר."
                : "Try refreshing the page or come back again in a moment."}
            </p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              {lang === "he" ? "רענון" : "Refresh"}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: "34px", textAlign: "center" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--ink)", marginBottom: "10px" }}>
              {t.myRequests.empty}
            </h2>
            <p style={{ color: "var(--gray-500)", marginBottom: "22px", lineHeight: 1.7 }}>
              {lang === "he"
                ? "כשתשלח/י בקשה חדשה, היא תופיע כאן עם מספר המעקב והסטטוס שלה."
                : "When you submit a new request, it will appear here with its tracking number and status."}
            </p>
            <Link href="/requests" className="btn btn-primary">
              {t.myRequests.submitCta}
            </Link>
          </div>
        ) : (
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--sky-2)" }}>
                    <th style={thStyle}>{t.myRequests.table.id}</th>
                    <th style={thStyle}>{t.myRequests.table.category}</th>
                    <th style={thStyle}>{t.myRequests.table.urgency}</th>
                    <th style={thStyle}>{t.myRequests.table.status}</th>
                    <th style={thStyle}>{t.myRequests.table.date}</th>
                    <th style={thStyle}>{t.myRequests.table.deadline}</th>
                    <th style={thStyle}>{t.myRequests.table.attachments}</th>
                    <th style={thStyle} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <RequestRow
                      key={item.id}
                      item={item}
                      t={t}
                      lang={lang}
                      expandedId={expandedId}
                      onToggle={handleToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const thStyle = {
  textAlign: "start",
  padding: "14px 18px",
  fontSize: "11px",
  color: "var(--ink-2)",
  fontWeight: 500,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--hair)",
};

const tdStyle = {
  padding: "16px 18px",
  verticalAlign: "top",
  fontSize: "14px",
  color: "var(--ink)",
};
