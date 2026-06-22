/**
 * Navbar — the app-wide top navigation, rendered on every page via the layout.
 *
 * Responsibility: present a role-aware + auth-aware nav. Link set, the primary
 * CTA, and the account menu all branch on auth state (useAuth: user/role/loading)
 * so each role only sees surfaces that work for them (beneficiaries submit
 * requests; volunteers/admins go to their workspace, never a refusal/empty page).
 * Bilingual via useLanguage (t/lang/setLang) with a built-in HE/EN switcher.
 *
 * Renders two parallel trees from the same `links`/`primaryCta` data: a desktop
 * group (with a centered logo badge between links and controls) and a mobile menu
 * (flat list, no nested popovers) toggled by `menuOpen`. Collaborates with the
 * shared Menu primitive for the desktop language/account dropdowns.
 */
import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, Globe, LogOut, Menu as MenuIcon, Shield, User as UserIcon, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { NextRouter } from "next/router";
import { useState } from "react";
import MenuPrimitive, { MenuItem } from "@/components/feedback/Menu";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import styles from "./Navbar.module.css";

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
  const isVolunteer = role === "volunteer";
  // Only a beneficiary can submit a request and owns a /my-requests board.
  // Admins land on a refusal screen at /requests and an empty /my-requests;
  // volunteers see an empty /my-requests. Gate those surfaces accordingly and
  // give staff/volunteers a CTA that actually does something for them.
  const isBeneficiary = role === "beneficiary";

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
        ...(role === "volunteer" || isAdmin
          ? [{ key: "volunteerHub", to: "/volunteer-hub", label: t.volunteerApp.navHub }]
          : []),
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

  // Role-appropriate primary CTA. Beneficiaries get "+ Submit Request"; admins
  // and volunteers can't submit (the form refuses admins and /my-requests is
  // empty for them), so they get a CTA into their actual workspace instead.
  const primaryCta = isAdmin
    ? { label: t.nav.menuAdmin, to: "/admin" }
    : isVolunteer
      ? { label: t.volunteerApp.navHub, to: "/volunteer-hub" }
      : { label: t.nav.submitBtn, to: "/requests" };

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
      {isBeneficiary && (
        <MenuItem icon={<UserIcon size={16} />} onSelect={() => navigate("/my-requests")}>
          {t.nav.menuMyRequests}
        </MenuItem>
      )}
      {(isVolunteer || isAdmin) && (
        <MenuItem icon={<UserIcon size={16} />} onSelect={() => navigate("/volunteer-hub")}>
          {t.volunteerApp.navHub}
        </MenuItem>
      )}
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
    <nav className="navbar" role="navigation" aria-label={t.nav.ariaMain}>
      <div className={`page-container ${styles.bar}`}>
        {/* LOGO — inline on mobile only; desktop uses the centered badge below */}
        <Link href="/" className={`hide-desktop ${styles.brandLink}`}>
          <img
            src="/logo.jpg"
            alt={t.nav.brand}
            width={40}
            height={40}
            className={styles.brandLogo}
          />
          <div className={`nav-wordmark ${styles.wordmarkWrap}`}>
            <div className={styles.wordmark}>{t.nav.brand}</div>
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
        <div className={`hide-mobile ${styles.desktopGroup}`}>
          <div className={styles.desktopLinks}>
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

          <div className={styles.desktopControls}>
            {/* Language menu — current language label + checkable option list. */}
            {languageMenu}

            {/* Auth controls */}
            {loading ? null : user ? (
              <>
                {/* Account menu — chip trigger; My Requests / Admin / Sign Out. */}
                {accountMenu}
                {/* Primary CTA stays OUTSIDE the account menu. Role-aware so it
                    never lands on a refusal/empty page (see primaryCta above). */}
                <button
                  className="btn btn-nav-primary btn-sm"
                  onClick={() => navigate(primaryCta.to)}
                >
                  {primaryCta.label}
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
        <div className={`hide-desktop ${styles.mobileControls}`}>
          <button
            aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
            onClick={() => setMenuOpen((o) => !o)}
            className={styles.mobileToggle}
          >
            {menuOpen ? <X size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU — flat list mirroring the desktop menus (no nested popovers). */}
      {menuOpen && (
        <div className={`hide-desktop nav-mobile-menu ${styles.mobileMenu}`}>
          {/* Signed-in indicator for mobile */}
          {!loading && user && (
            <div className={styles.mobileUser}>
              <span className="nav-account-avatar nav-account-avatar-lg">
                {accountInitial}
              </span>
              <span className={styles.mobileUserEmail} title={user.email || ""}>
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
                `nav-link${isActive ? " active" : ""} ${styles.mobileLink}`
              }
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
                className={`nav-link nav-mobile-option${l.code === lang ? " active" : ""} ${styles.mobileOption}`}
                aria-current={l.code === lang ? "true" : undefined}
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
                    `nav-link${isActive ? " active" : ""} ${styles.mobileLink}`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  {t.nav.menuAdmin}
                </NavLink>
              )}
              {/* Primary action. Admins already have a dedicated Admin link
                  above, so skip a redundant CTA for them; beneficiaries get
                  "+ Submit Request" and volunteers get the Volunteer hub. */}
              {!isAdmin && (
                <button
                  className={`btn btn-primary btn-full ${styles.mobileCta}`}
                  onClick={() => {
                    navigate(primaryCta.to);
                    setMenuOpen(false);
                  }}
                >
                  {primaryCta.label}
                </button>
              )}
              <button
                className={`btn btn-outline btn-full ${styles.mobileCtaSecondary}`}
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
                className={`btn btn-outline btn-full ${styles.mobileAuthLink}`}
                onClick={() => setMenuOpen(false)}
              >
                {t.auth.login.title}
              </Link>
              <Link
                href="/register"
                className={`btn btn-primary btn-full ${styles.mobileAuthLinkSecondary}`}
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
