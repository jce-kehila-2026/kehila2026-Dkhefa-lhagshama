import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, Globe, LogOut, Menu as MenuIcon, Shield, User as UserIcon, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { NextRouter } from "next/router";
import { useState } from "react";
import MenuPrimitive, { MenuItem } from "@/components/feedback/Menu";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

/** className that can vary on active state (react-router-style shim). */
type NavClassName = string | ((s: { isActive: boolean }) => string);

interface NavLinkProps extends Omit<ComponentProps<typeof Link>, "href" | "className"> {
  router: NextRouter;
  to: string;
  end?: boolean;
  className?: NavClassName;
  children?: ReactNode;
}

/**
 * NavLink shim: forwards `className` (optionally a fn of {isActive}) to next/link.
 * Defined at module scope (not inside Navbar) so it is a stable component type
 * across renders; the active router is passed in as a prop.
 */
function NavLink({ router, to, end, className, children, ...rest }: NavLinkProps) {
  const isActivePath = (target: string) =>
    target === "/" ? router.pathname === "/" : router.pathname.startsWith(target);
  const active = end ? router.pathname === to : isActivePath(to);
  const resolved =
    typeof className === "function" ? className({ isActive: active }) : className;
  return (
    <Link href={to} className={resolved} {...rest}>
      {children}
    </Link>
  );
}

/** A single navigation entry. */
interface NavItem {
  key: string;
  to: string;
  label?: ReactNode;
}

export default function Navbar() {
  const { t, lang, setLang, languages } = useLanguage();
  const { user, role, logout, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const navigate = (to: string) => router.push(to);
  const isAdmin = role === "admin";

  // Build link set conditional on auth state.
  // Only pages that actually exist — /about, /contact, /track are not built.
  // Signed-in users reach the form via the prominent "+ Submit Request" button,
  // so the redundant "Submit Request" link is shown to guests only (their CTA).
  const navLabels = t.nav as Record<string, string>;
  const links: NavItem[] = user
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
        ...(isAdmin ? [{ key: "admin", to: "/admin" }] : []),
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

  const activeLang = languages.find((l) => l.code === lang) ?? languages[0];
  const accountInitial = (user?.email || "?").charAt(0);
  const accountName = (user?.email || "").split("@")[0];

  // Language menu — current label as trigger, both options listed with a check
  // on the active one. Selecting calls setLang(code).
  const languageMenu = (
    <MenuPrimitive
      align="end"
      label={t.nav.menuLanguageAria}
      trigger={
        <span className="nav-menu-trigger nav-lang-trigger">
          <Globe size={14} aria-hidden="true" />
          <span>{activeLang.label}</span>
          <ChevronDown size={14} aria-hidden="true" className="nav-menu-caret" />
        </span>
      }
    >
      {languages.map((l) => (
        <MenuItem
          key={l.code}
          selected={l.code === lang}
          onSelect={() => setLang(l.code)}
        >
          {l.label}
        </MenuItem>
      ))}
    </MenuPrimitive>
  );

  // Account menu — chip as trigger; My Requests / Admin (admin only) / Sign Out.
  const accountMenu = (
    <MenuPrimitive
      align="end"
      label={t.nav.menuAccountAria}
      trigger={
        <span className="nav-menu-trigger nav-account-chip">
          <span className="nav-account-avatar">{accountInitial}</span>
          <span className="account-chip-name">{accountName}</span>
          <ChevronDown size={14} aria-hidden="true" className="nav-menu-caret" />
        </span>
      }
    >
      <MenuItem icon={<UserIcon size={16} />} onSelect={() => navigate("/my-requests")}>
        {t.nav.menuMyRequests}
      </MenuItem>
      {isAdmin && (
        <MenuItem icon={<Shield size={16} />} onSelect={() => navigate("/admin")}>
          {t.nav.menuAdmin}
        </MenuItem>
      )}
      <MenuItem icon={<LogOut size={16} />} onSelect={handleLogout}>
        {t.nav.menuSignOut}
      </MenuItem>
    </MenuPrimitive>
  );

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
                router={router}
                to={l.to}
                className={({ isActive }) =>
                  `nav-link${isActive ? " active" : ""}`
                }
                end={l.to === "/"}
              >
                {l.label || navLabels[l.key]}
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
            {/* Language menu — current language label + checkable option list. */}
            {languageMenu}

            {/* Auth controls */}
            {loading ? null : user ? (
              <>
                {/* Account menu — chip trigger; My Requests / Admin / Sign Out. */}
                {accountMenu}
                {/* Primary CTA stays OUTSIDE the account menu. */}
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
            {menuOpen ? <X size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU — flat list mirroring the desktop menus (no nested popovers). */}
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
              <span className="nav-account-avatar nav-account-avatar-lg">
                {accountInitial}
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
              router={router}
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
              {l.label || navLabels[l.key]}
            </NavLink>
          ))}

          {/* Language — flat list of options (mirrors the desktop language menu). */}
          <div
            className="nav-mobile-section"
            role="group"
            aria-label={t.nav.menuLanguageAria}
          >
            <span className="nav-mobile-section-label">
              <Globe size={13} aria-hidden="true" /> {t.nav.menuLanguage}
            </span>
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`nav-link nav-mobile-option${l.code === lang ? " active" : ""}`}
                aria-current={l.code === lang ? "true" : undefined}
                style={{ display: "block", width: "100%", textAlign: "start", padding: "11px 14px" }}
                onClick={() => {
                  setLang(l.code);
                  setMenuOpen(false);
                }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Auth — flat items mirroring the account menu, plus the CTA. */}
          {!loading && (user ? (
            <>
              {isAdmin && (
                <NavLink
                  router={router}
                  to="/admin"
                  className={({ isActive }) =>
                    `nav-link${isActive ? " active" : ""}`
                  }
                  style={{ display: "block", padding: "11px 14px", marginBottom: "4px" }}
                  onClick={() => setMenuOpen(false)}
                >
                  {t.nav.menuAdmin}
                </NavLink>
              )}
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
                {t.nav.menuSignOut}
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
