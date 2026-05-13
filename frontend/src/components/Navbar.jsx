import { Globe, Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function Navbar() {
  const { t, toggleLang, lang } = useLanguage();
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

  // Build link set conditional on auth state — admin + track only when signed in.
  const baseLinks = [
    { key: "home", to: "/" },
    { key: "requests", to: "/requests" },
    { key: "directory", to: "/directory" },
    { key: "volunteers", to: "/volunteer" },
    { key: "about", to: "/about" },
    { key: "contact", to: "/contact" },
  ];
  const links = user
    ? [
        ...baseLinks,
        ...(role === "beneficiary"
          ? [
              {
                key: "myRequests",
                to: "/my-requests",
                label: t.myRequests.navLink,
              },
            ]
          : []),
        { key: "track", to: "/track" },
        ...(role === "admin" ? [{ key: "admin", to: "/admin" }] : []),
      ]
    : baseLinks;

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
        }}
      >
        {/* LOGO */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              background: "linear-gradient(135deg, #C9971A, #E8B830)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Frank Ruhl Libre, serif",
              fontWeight: 900,
              color: "#060E1E",
              fontSize: "13px",
              letterSpacing: "-0.5px",
              flexShrink: 0,
            }}
          >
            ד״ה
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div
              style={{
                color: "#fff",
                fontFamily: "Frank Ruhl Libre, serif",
                fontWeight: 700,
                fontSize: "16px",
              }}
            >
              {lang === "he" ? "דחיפה להגשמה" : "Push for Fulfillment"}
            </div>
            <div
              style={{
                color: "rgba(232,184,48,0.85)",
                fontSize: "10px",
                fontWeight: 300,
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              {lang === "he" ? "Push for Fulfillment" : "דחיפה להגשמה"}
            </div>
          </div>
        </Link>

        {/* DESKTOP LINKS */}
        <div
          className="hide-mobile"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            marginInlineStart: "auto",
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

        {/* RIGHT CONTROLS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginInlineStart: "auto",
          }}
          className="hide-mobile"
        >
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: "pointer",
              fontSize: "13px",
              fontFamily: "inherit",
              transition: "all .2s",
            }}
            title={lang === "he" ? "Switch to English" : "החלף לעברית"}
          >
            <Globe size={14} />
            {lang === "he" ? "EN" : "עב"}
          </button>

          {/* Auth controls */}
          {loading ? null : user ? (
            <>
              <span
                style={{ color: "rgba(255,255,255,0.85)", fontSize: "13px" }}
                title={user.email || ""}
              >
                {t.auth.welcome}
                {user.email ? `, ${user.email.split("@")[0]}` : ""}
              </span>
              <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                {t.auth.logout}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate("/requests")}
              >
                {t.nav.submitBtn}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-outline btn-sm">
                {t.auth.login.title}
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                {t.auth.register.title}
              </Link>
            </>
          )}
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
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "rgba(255,255,255,0.8)",
              padding: "6px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "inherit",
            }}
          >
            {lang === "he" ? "EN" : "עב"}
          </button>
          <button
            aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
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
          className="hide-desktop"
          style={{
            background: "var(--navy)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            padding: "12px 16px 20px",
          }}
        >
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
        </div>
      )}
    </nav>
  );
}
