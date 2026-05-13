import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { apiJson } from "../lib/apiClient";
import { formatDate, truncate } from "../utils/helpers";

export default function MyRequestsPage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    return () => {
      alive = false;
    };
  }, [authLoading, user, router]);

  const categoryLabel = (category) =>
    t.myRequests.categories[category] || category;
  const urgencyLabel = (urgency) => t.myRequests.urgencies[urgency] || urgency;

  return (
    <>
      <PageHeader title={t.myRequests.title} subtitle={t.myRequests.subtitle}>
        <div
          style={{
            marginTop: "22px",
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <Link href="/requests" className="btn btn-primary btn-sm">
            {t.myRequests.submitCta}
          </Link>
        </div>
      </PageHeader>

      <div
        className="page-container"
        style={{ maxWidth: "1100px", padding: "42px 1.5rem 72px" }}
      >
        {loading || authLoading ? (
          <div
            className="card"
            style={{ padding: "28px", textAlign: "center" }}
          >
            {t.myRequests.loading}
          </div>
        ) : error ? (
          <div className="card" style={{ padding: "28px" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--navy)",
                marginBottom: "8px",
              }}
            >
              {lang === "he"
                ? "אירעה שגיאה בטעינת הבקשות"
                : "We could not load your requests"}
            </h2>
            <p
              style={{
                color: "var(--gray-500)",
                marginBottom: "18px",
                lineHeight: 1.7,
              }}
            >
              {lang === "he"
                ? "נסה/י לרענן את הדף או לחזור שוב מאוחר יותר."
                : "Try refreshing the page or come back again in a moment."}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              {lang === "he" ? "רענון" : "Refresh"}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div
            className="card"
            style={{ padding: "34px", textAlign: "center" }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--navy)",
                marginBottom: "10px",
              }}
            >
              {t.myRequests.empty}
            </h2>
            <p
              style={{
                color: "var(--gray-500)",
                marginBottom: "22px",
                lineHeight: 1.7,
              }}
            >
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
                  <tr style={{ background: "var(--gray-50)" }}>
                    <th style={thStyle}>{t.myRequests.table.id}</th>
                    <th style={thStyle}>{t.myRequests.table.category}</th>
                    <th style={thStyle}>{t.myRequests.table.urgency}</th>
                    <th style={thStyle}>{t.myRequests.table.status}</th>
                    <th style={thStyle}>{t.myRequests.table.date}</th>
                    <th style={thStyle}>{t.myRequests.table.attachments}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.id}
                      style={{
                        borderTop: "1px solid var(--gray-200)",
                        background:
                          index % 2 ? "var(--white)" : "rgba(250,250,250,0.55)",
                      }}
                    >
                      <td style={tdStyle}>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: "13px",
                            color: "var(--navy)",
                          }}
                        >
                          {item.id}
                        </div>
                        <div
                          style={{
                            marginTop: "6px",
                            color: "var(--gray-500)",
                            fontSize: "13px",
                          }}
                        >
                          {truncate(item.description || "", 72)}
                        </div>
                      </td>
                      <td style={tdStyle}>{categoryLabel(item.category)}</td>
                      <td style={tdStyle}>{urgencyLabel(item.urgency)}</td>
                      <td style={tdStyle}>
                        <StatusBadge status={item.status} />
                      </td>
                      <td style={tdStyle}>
                        {formatDate(item.createdAt, lang) || "—"}
                      </td>
                      <td style={tdStyle}>
                        {Array.isArray(item.attachmentPaths)
                          ? item.attachmentPaths.length
                          : 0}
                      </td>
                    </tr>
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
  padding: "16px 18px",
  fontSize: "13px",
  color: "var(--gray-500)",
  fontWeight: 700,
  letterSpacing: "0.02em",
  borderBottom: "1px solid var(--gray-200)",
};

const tdStyle = {
  padding: "16px 18px",
  verticalAlign: "top",
  fontSize: "14px",
  color: "var(--gray-800)",
};
