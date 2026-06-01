import { Globe, Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function Navbar() {
  const { t, toggleLang } = useLanguage();
  const { user, role, logout, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const navigate = (to) => router.push(to);
  const isActivePath = (to) =>
    to === "/" ? router.pathname === "/" : router.pathname.startsWith(to);
  // NavLink shim: forwards `className` (optionally a fn of {isActive}) to next/link.
  const NavLink = ({ to, end, className, children, ...rest }) => {
    const active = end ? router.pathname === to : isActivePath(to);
    const resolved =
      typeof className === "function"
        ? className({ isActive: active })
        : className;
    return (
      <Link href={to} className={resolved} {...rest}>
        {children}
      </Link>
    );
  };

  // Build link set conditional on auth state.
  // Only pages that actually exist — /about, /contact, /track are not built.
  // Signed-in users reach the form via the prominent "+ Submit Request" button,
  // so the redundant "Submit Request" link is shown to guests only (their CTA).
  const links = user
    ? [
        { key: "home", to: "/" },
        { key: "directory", to: "/directory" },
        { key: "volunteers", to: "/volunteer" },
        ...(role === "beneficiary"
          ? [
              {
                key: "myRequests",
                to: "/my-requests",
                label: t.myRequests.navLink,
              },
            ]
          : []),
        { key: "chats", to: "/chats", label: t.nav.chats },
        ...(role === "admin" ? [{ key: "admin", to: "/admin" }] : []),
      ]
    : [
        { key: "home", to: "/" },
        { key: "requests", to: "/requests" },
        { key: "directory", to: "/directory" },
        { key: "volunteers", to: "/volunteer" },
      ];

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div
        className="page-container"
        style={{
          display: "flex",
          alignItems: "center",
          height: "64px",
          gap: "8px",
          // Wider than the 1120px content column so the full signed-in nav
          // (links + lang + account chip + Sign Out + CTA) never overflows.
          maxWidth: "1320px",
          // Positioning context for the centered logo badge (desktop).
          position: "relative",
        }}
      >
        {/* LOGO — inline on mobile only; desktop uses the centered badge below */}
        <Link
          href="/"
          className="hide-desktop"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <img
            src="/logo.jpg"
            alt={t.nav.brand}
            width={40}
            height={40}
            style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
          <div style={{ lineHeight: 1.2 }} className="nav-wordmark">
            <div
              style={{
                color: "var(--cream)",
                fontFamily: "Frank Ruhl Libre, serif",
                fontWeight: 700,
                fontSize: "16px",
                whiteSpace: "nowrap",
              }}
            >
              {t.nav.brand}
            </div>
          </div>
        </Link>

        {/* CENTERED LOGO BADGE — desktop: a circular mark centered in the bar
            that protrudes slightly below it (editorial NGO style). */}
        <Link
          href="/"
          className="nav-logo-badge hide-mobile"
          aria-label={t.nav.brand}
        >
          <img src="/logo.jpg" alt={t.nav.brand} />
        </Link>

        {/* DESKTOP GROUP — links pinned to the start, controls to the end, so
            the centered logo badge sits in the clear gap between them. */}
        <div
          className="hide-mobile"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            inlineSize: "100%",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
            }}
          >
            {links.map((l) => (
              <NavLink
                key={l.key}
                to={l.to}
                className={({ isActive }) =>
                  `nav-link${isActive ? " active" : ""}`
                }
                end={l.to === "/"}
              >
                {l.label || t.nav[l.key]}
              </NavLink>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {/* Language toggle — prominent pill, the demo switches HE/EN live */}
            <button
              onClick={toggleLang}
              className="nav-lang-toggle"
              aria-label={t.nav.langSwitch}
              title={t.nav.langSwitch}
            >
              <Globe size={14} aria-hidden="true" />
              <span style={{ fontWeight: 700 }}>{t.nav.langCode}</span>
            </button>

            {/* Auth controls */}
            {loading ? null : user ? (
              <>
                {/* Account chip — shows the user is signed in. Initial in a
                    circle + email-name as a tooltip. Click → My Requests. */}
                <Link
                  href="/my-requests"
                  title={user.email || ""}
                  aria-label={`Signed in as ${user.email || ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 10px 4px 4px",
                    borderRadius: "999px",
                    background: "rgba(244,238,224,0.08)",
                    border: "1px solid rgba(244,238,224,0.18)",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      background: "var(--ember)",
                      color: "var(--cream)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {(user.email || "?").charAt(0)}
                  </span>
                  <span
                    className="account-chip-name"
                    style={{
                      color: "var(--cream)",
                      fontSize: "13px",
                      maxWidth: "120px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(user.email || "").split("@")[0]}
                  </span>
                </Link>
                <button className="btn btn-nav-outline btn-sm" onClick={handleLogout}>
                  {t.auth.logout}
                </button>
                <button
                  className="btn btn-nav-primary btn-sm"
                  onClick={() => navigate("/requests")}
                >
                  {t.nav.submitBtn}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-nav-outline btn-sm">
                  {t.auth.login.title}
                </Link>
                <Link href="/register" className="btn btn-nav-primary btn-sm">
                  {t.auth.register.title}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* MOBILE CONTROLS */}
        <div
          className="hide-desktop"
          style={{
            marginInlineStart: "auto",
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <button
            onClick={toggleLang}
            className="nav-lang-toggle"
            aria-label={t.nav.langSwitch}
            style={{ padding: "6px 12px", fontWeight: 700 }}
          >
            {t.nav.langCode}
          </button>
          <button
            aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              background: "none",
              border: "none",
              color: "var(--cream)",
              cursor: "pointer",
              padding: "6px",
              display: "flex",
            }}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div
          className="hide-desktop nav-mobile-menu"
          style={{
            background: "var(--ink-2)",
            borderBlockStart: "1px solid rgba(244,238,224,0.12)",
            padding: "12px 16px 20px",
          }}
        >
          {/* Signed-in indicator for mobile */}
          {!loading && user && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                marginBottom: "8px",
                background: "rgba(244,238,224,0.06)",
                border: "1px solid rgba(244,238,224,0.14)",
                borderRadius: "8px",
              }}
            >
              <span
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "var(--ember)",
                  color: "var(--cream)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                {(user.email || "?").charAt(0)}
              </span>
              <span
                style={{
                  color: "var(--cream)",
                  fontSize: "13px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                  flex: 1,
                }}
                title={user.email || ""}
              >
                {user.email || ""}
              </span>
            </div>
          )}

          {links.map((l) => (
            <NavLink
              key={l.key}
              to={l.to}
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
              style={{
                display: "block",
                padding: "11px 14px",
                marginBottom: "4px",
              }}
              onClick={() => setMenuOpen(false)}
              end={l.to === "/"}
            >
              {l.label || t.nav[l.key]}
            </NavLink>
          ))}

          {/* Auth buttons for mobile */}
          {!loading && (user ? (
            <>
              <button
                className="btn btn-primary btn-full"
                style={{ marginTop: "12px" }}
                onClick={() => {
                  navigate("/requests");
                  setMenuOpen(false);
                }}
              >
                {t.nav.submitBtn}
              </button>
              <button
                className="btn btn-outline btn-full"
                style={{ marginTop: "8px" }}
                onClick={async () => {
                  setMenuOpen(false);
                  await handleLogout();
                }}
              >
                {t.auth.logout}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="btn btn-outline btn-full"
                style={{ marginTop: "12px", display: "block", textAlign: "center" }}
                onClick={() => setMenuOpen(false)}
              >
                {t.auth.login.title}
              </Link>
              <Link
                href="/register"
                className="btn btn-primary btn-full"
                style={{ marginTop: "8px", display: "block", textAlign: "center" }}
                onClick={() => setMenuOpen(false)}
              >
                {t.auth.register.title}
              </Link>
            </>
          ))}
        </div>
      )}
    </nav>
  );
}
