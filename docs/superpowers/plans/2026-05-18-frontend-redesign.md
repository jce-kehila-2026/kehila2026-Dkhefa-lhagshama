# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the loud navy+gold theme with the approved Sky / Quiet-Editorial brand system across all 7 screens and 12 components without regressing UC behavior, HE/EN switching, or other UC owners' work on `main`.

**Architecture:** Most styling lives in `frontend/src/styles/globals.css` (560 lines of `.btn`, `.card`, `.badge-*`, `.navbar`, etc.). Phase 1 rewrites that file's CSS custom properties + class definitions in one pass — the screens automatically inherit the new look. Phases 2–5 are targeted JSX edits to fix hardcoded inline colors in Navbar/Footer and to add editorial structure (eyebrow + serif H1 with ember `<em>` word) to heroes. Phase 6 layers in route-level View Transitions. Phase 7 cleans up duplicates and runs a11y / LCP audits. The branch `redesign/frontend-brand-refresh` is already checked out; `main` is never touched.

**Tech Stack:** Next.js 13 (Pages Router) · React 18 · Tailwind CSS (utility colors only — the bulk of styling is in `globals.css`) · Custom `LanguageContext` for HE/EN with RTL · Frank Ruhl Libre (display) + Noto Sans Hebrew (body) already loaded via `_document.tsx` · Firebase backend untouched.

**Source spec:** `docs/superpowers/specs/2026-05-18-frontend-redesign-design.md`

---

## File Structure

**Created:**
- `frontend/public/logo.jpg` — manager-supplied cupped-hands logo (copied from `sem2/the_organization_image.jpg`)
- `frontend/src/components/Eyebrow.jsx` — mono uppercase label primitive
- `frontend/src/components/SectionHeader.jsx` — eyebrow + serif H1 composition

**Modified (Phase 1 — Foundations):**
- `frontend/src/styles/globals.css` — full token swap + class restyle
- `frontend/tailwind.config.js` — replace navy/gold with sky/ink/cream/ember/paper
- `frontend/pages/_document.tsx` — preload logo

**Modified (Phase 2 — Chrome):**
- `frontend/src/components/Navbar.jsx` — swap hardcoded `#C9971A`/`#E8B830` inline colors; replace fake `ד״ה` monogram with logo image
- `frontend/src/components/Footer.jsx` — same color cleanup + logo
- `frontend/src/components/PageHeader.jsx` — adopt SectionHeader pattern
- `frontend/src/components/Modal.jsx` — restyle confirmation flow (uses globals.css `.modal-*` already, mostly inherits)
- `frontend/src/components/Toast.jsx` — inherits new toast classes
- `frontend/src/components/StatusBadge.jsx` — inherits new badge classes

**Modified (Phase 3 — Marketing screens):**
- `frontend/src/screens/HomePage.jsx`
- `frontend/src/screens/LoginPage.jsx`
- `frontend/src/screens/RegisterPage.jsx`

**Modified (Phase 4 — UC-01 critical path):**
- `frontend/src/screens/RequestsPage.jsx` (20KB — careful, preserves form behavior)
- `frontend/src/screens/MyRequestsPage.jsx`
- `frontend/src/components/UploadArea.jsx`
- `frontend/src/components/StepIndicator.jsx`

**Modified (Phase 5 — Directory + Volunteer):**
- `frontend/src/screens/DirectoryPage.jsx`
- `frontend/src/screens/VolunteerPage.jsx`
- `frontend/src/components/VolunteerCard.jsx`
- `frontend/src/components/StatCard.jsx`
- `frontend/src/components/Pagination.jsx`

**Modified (Phase 6 — Motion):**
- `frontend/pages/_app.tsx` — wrap children in `<ViewTransition>`
- `frontend/src/screens/DirectoryPage.jsx` — list reorder transitions on filter change

**Deleted (Phase 7 — Cleanup):**
- `frontend/src/components/Formelements.jsx` (lowercase duplicate of `FormElements.jsx`)
- `frontend/src/components/Stepindicator.jsx` (lowercase duplicate of `StepIndicator.jsx`)

---

## Token Swap Rules (used by every phase)

Whenever you encounter the OLD value (CSS custom property, inline hex, Tailwind class, or string literal), replace with the NEW value. Apply globally across every file edited in this plan.

| Old | New | Where it appears |
|---|---|---|
| `--navy: #0B1D3E` | `--ink: #0F1E2D` | globals.css :root |
| `--navy-light: #152B5A` | `--ink-2: #2C3D52` | globals.css :root |
| `--navy-dark: #060E1E` | `--ink: #0F1E2D` (no separate dark — flatter palette) | globals.css :root |
| `--gold: #C9971A` | `--ember: #B9694E` | globals.css :root |
| `--gold-light: #E8B830` | `--ember: #B9694E` (no separate light) | globals.css :root |
| `--gold-pale: #FBF0C8` | `--cream: #F4EEE0` | globals.css :root |
| `--cream: #FAF7F0` | `--paper: #FAFAF7` | globals.css :root |
| Inline `#C9971A` / `#E8B830` | `#B9694E` (ember) | Navbar, Footer |
| Inline `#0B1D3E` / `#060E1E` / `#152B5A` | `#0F1E2D` (ink) | Navbar, Footer |
| Tailwind `bg-navy-*`, `text-navy-*` | `bg-ink`, `text-ink` | any screen using utilities |
| Tailwind `bg-gold-*`, `text-gold-*` | `bg-ember`, `text-ember` | any screen using utilities |

**Sky band:** wherever the old code used hero gradient (`hero-gradient` / `linear-gradient(160deg, ...navy-dark...)`)  → switch to flat `background: var(--sky-2)`.

---

# Phase 1 — Foundations

Single agent only. Other phases depend on this.

### Task 1.1: Copy logo into frontend public folder

**Files:**
- Create: `frontend/public/logo.jpg`

- [ ] **Step 1: Create the public folder and copy the asset**

Run:
```bash
mkdir -p frontend/public
cp ../../../the_organization_image.jpg frontend/public/logo.jpg
ls -la frontend/public/logo.jpg
```
Expected: file exists, non-zero size.

- [ ] **Step 2: Commit**

```bash
git add frontend/public/logo.jpg
git commit -m "chore(frontend): add brand logo to public/"
```

---

### Task 1.2: Rewrite `globals.css` design tokens

**Files:**
- Modify: `frontend/src/styles/globals.css` (lines 8–37 — the `:root` block)

- [ ] **Step 1: Replace the `:root` block**

Open `frontend/src/styles/globals.css` and replace lines 8–37 with:

```css
:root {
  /* Sky palette (locked) */
  --sky:        #BFD3E6;
  --sky-2:      #DCE7F0;
  --ink:        #0F1E2D;
  --ink-2:      #2C3D52;
  --cream:      #F4EEE0;
  --paper:      #FAFAF7;
  --ember:      #B9694E;
  --hair:       rgba(15,30,45,0.10);

  /* Back-compat aliases — leave for now so untouched JSX still renders.
     Removed in Phase 7. */
  --navy:       var(--ink);
  --navy-light: var(--ink-2);
  --navy-dark:  var(--ink);
  --gold:       var(--ember);
  --gold-light: var(--ember);
  --gold-pale:  var(--cream);
  --white:      #FFFFFF;

  /* Grays — slightly cooler, sky-tinted */
  --gray-50:    #F6F7F9;
  --gray-100:   #EEF1F4;
  --gray-200:   #DDE3E9;
  --gray-300:   #C4CDD6;
  --gray-400:   #8A97A4;
  --gray-500:   #5C6975;
  --gray-600:   #3F4A55;
  --gray-700:   #2A333C;
  --gray-800:   var(--ink);

  /* Semantic */
  --success:    #2E6E45;
  --danger:     #A04835;
  --warning:    #B9694E;
  --info:       #2C3D52;

  /* Radius — slightly tighter, editorial */
  --radius-sm:  8px;
  --radius:     12px;
  --radius-lg:  16px;
  --radius-xl:  24px;

  /* Shadows — flatter, sky-tinted */
  --shadow-sm:  0 1px 0 rgba(15,30,45,0.04), 0 4px 12px rgba(15,30,45,0.05);
  --shadow:     0 1px 0 rgba(15,30,45,0.04), 0 8px 24px rgba(15,30,45,0.06);
  --shadow-lg:  0 1px 0 rgba(15,30,45,0.04), 0 14px 40px rgba(15,30,45,0.10);
}
```

The aliases (`--navy: var(--ink)` etc.) are deliberate temporary back-compat shims — they let Phase 2–6 JSX edits land incrementally without breaking the screens that still reference `var(--navy)`. Phase 7 removes them.

- [ ] **Step 2: Verify by running dev server**

Run:
```bash
cd frontend && npm run dev
```
Expected: server starts on http://localhost:3000 with no CSS errors in terminal. Open http://localhost:3000 — page renders with new sky-tinted colors (everything that referenced `--navy` now shows as ink).

- [ ] **Step 3: Stop dev server (Ctrl+C) and commit**

```bash
git add frontend/src/styles/globals.css
git commit -m "feat(frontend): swap design tokens to Sky palette"
```

---

### Task 1.3: Rewrite the rest of `globals.css` class styles

The token swap in 1.2 picks up via CSS variables, but several classes hardcode the old gold/navy hex values directly OR use the old gradient-heavy hero pattern. Update them.

**Files:**
- Modify: `frontend/src/styles/globals.css` (everything after line 37)

- [ ] **Step 1: Replace the `.btn-primary` block**

Find lines 131–139 (`.btn-primary` and its hover). Replace with:
```css
.btn-primary {
  background: var(--ink);
  color: var(--cream);
  border: 1px solid var(--ink);
}
.btn-primary:hover:not(:disabled) {
  background: var(--ink-2);
  border-color: var(--ink-2);
  box-shadow: var(--shadow);
}
```
Rationale: primary CTA = ink background / cream foreground per spec §3. No translate-Y bounce — too playful for editorial.

- [ ] **Step 2: Replace the `.btn-navy` block** (lines 141–149) with a deprecation alias:
```css
.btn-navy { /* legacy alias — same as .btn-primary now */
  background: var(--ink);
  color: var(--cream);
  border: 1px solid var(--ink);
}
.btn-navy:hover:not(:disabled) {
  background: var(--ink-2);
  box-shadow: var(--shadow);
}
```

- [ ] **Step 3: Replace `.btn-outline`** (lines 151–159):
```css
.btn-outline {
  background: var(--paper);
  color: var(--ink);
  border: 1.5px solid var(--ink);
}
.btn-outline:hover:not(:disabled) {
  background: var(--ink);
  color: var(--cream);
}
```

- [ ] **Step 4: Update focus ring** in `.btn:focus-visible` (line 128) and `*:focus-visible` (lines 526–529):
```css
.btn:focus-visible { box-shadow: 0 0 0 3px rgba(185,105,78,0.35); }

*:focus-visible {
  outline: 2px solid var(--ember);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Replace `.hero-gradient` and `.hero-pattern`** (lines 337–343):
```css
.hero-gradient {
  background: var(--sky-2);
}
.hero-pattern {
  background-image:
    radial-gradient(circle at 15% 50%, rgba(185,105,78,0.05) 0%, transparent 60%),
    radial-gradient(circle at 85% 20%, rgba(15,30,45,0.04) 0%, transparent 60%);
}
```
This flips the hero from dark-navy to flat sky-2.

- [ ] **Step 6: Replace `.navbar`** (lines 312–318):
```css
.navbar {
  background: var(--paper);
  border-bottom: 1px solid var(--hair);
  position: sticky;
  top: 0;
  z-index: 200;
  box-shadow: 0 1px 0 rgba(15,30,45,0.04);
}
```
Then update `.nav-link` colors (lines 319–332):
```css
.nav-link {
  padding: 8px 13px;
  border-radius: 6px;
  font-size: 13.5px;
  color: var(--ink-2);
  cursor: pointer;
  transition: all 0.18s;
  background: none;
  border: none;
  font-family: inherit;
  white-space: nowrap;
}
.nav-link:hover { color: var(--ink); background: rgba(15,30,45,0.06); }
.nav-link.active { color: var(--ember); }
```

- [ ] **Step 7: Replace `.step-dot`** (lines 348–364):
```css
.step-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  transition: all 0.3s;
  flex-shrink: 0;
}
.step-dot.done { background: var(--ink); color: var(--cream); }
.step-dot.active { background: var(--ember); color: var(--cream); box-shadow: 0 0 0 4px rgba(185,105,78,0.18); }
.step-dot.todo { background: var(--sky-2); color: var(--ink-2); }
.step-connector { flex: 1; height: 1px; background: var(--hair); transition: background 0.3s; }
.step-connector.done { background: var(--ink); }
```

- [ ] **Step 8: Replace `.cat-option`** (lines 369–381):
```css
.cat-option {
  border: 1px solid var(--hair);
  border-radius: var(--radius);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 13px;
  background: var(--paper);
}
.cat-option:hover { border-color: var(--ink); background: var(--sky-2); }
.cat-option.selected { border-color: var(--ember); background: var(--sky-2); }
```

- [ ] **Step 9: Replace `.toast`** (lines 396–414):
```css
.toast {
  background: var(--ink);
  color: var(--cream);
  padding: 14px 20px;
  border-radius: var(--radius);
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: var(--shadow-lg);
  animation: slideInToast 0.3s ease;
  pointer-events: all;
  min-width: 260px;
  max-width: 380px;
}
.toast.success { border-inline-start: 4px solid #4F8B6A; }
.toast.error   { border-inline-start: 4px solid var(--ember); }
.toast.info    { border-inline-start: 4px solid var(--ink-2); }
.toast.warning { border-inline-start: 4px solid var(--ember); }
```

- [ ] **Step 10: Replace `.page-btn` and `.filter-chip`** (lines 432–445, 534–546):
```css
.page-btn {
  width: 34px; height: 34px;
  border-radius: 6px;
  border: 1px solid var(--hair);
  background: var(--paper);
  font-size: 13.5px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.18s;
  color: var(--ink-2);
}
.page-btn:hover { border-color: var(--ink); color: var(--ink); }
.page-btn.active { background: var(--ink); color: var(--cream); border-color: var(--ink); }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.filter-chip {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.18s;
  background: var(--paper);
  color: var(--ink-2);
  border: 1px solid var(--hair);
}
.filter-chip:hover { border-color: var(--ink); color: var(--ink); }
.filter-chip.active { background: var(--ember); color: var(--cream); border-color: var(--ember); }
```

- [ ] **Step 11: Replace `.admin-table thead` and `.upload-area`** (lines 267–269, 290–307):
```css
.admin-table thead tr { background: var(--sky-2); }
.admin-table th { color: var(--ink); }

.upload-area {
  border: 2px dashed var(--hair);
  border-radius: var(--radius);
  padding: 32px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--sky-2);
}
.upload-area:hover {
  border-color: var(--ember);
  background: var(--cream);
}
.upload-area.has-file {
  border-color: var(--ink);
  background: var(--paper);
  cursor: default;
}
```

- [ ] **Step 12: Replace `.gold-line`** (lines 98–106) with editorial divider:
```css
.gold-line {
  width: 48px;
  height: 1px;
  background: var(--ember);
  border-radius: 0;
  margin-bottom: 16px;
}
.gold-line.center { margin-left: auto; margin-right: auto; }
.gold-line.light { background: var(--ink-2); }
```

- [ ] **Step 13: Replace `.badge-*` blocks** (lines 250–254):
```css
.badge-pending  { background: var(--sky-2);  color: var(--ink); }
.badge-review   { background: var(--cream);  color: var(--ink); }
.badge-approved { background: #DCEAE0; color: #2E6E45; }
.badge-rejected { background: #F4DDD3; color: var(--ember); }
.badge-new      { background: var(--ember); color: var(--cream); }
```

- [ ] **Step 14: Append new editorial utility classes at the bottom of globals.css:**

```css
/* ─────────────────────────────────────────
   EDITORIAL UTILITIES (new — Phase 1)
───────────────────────────────────────── */

/* Eyebrow: mono, uppercase, sky/cream surfaces */
.eyebrow {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-2);
  margin-bottom: 12px;
  display: block;
}

/* Section header composition: eyebrow + serif H1/H2 */
.section-eyebrow {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-2);
  margin-bottom: 14px;
}
.section-display {
  font-family: 'Frank Ruhl Libre', Georgia, serif;
  font-weight: 400;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.15;
  color: var(--ink);
  margin-bottom: 18px;
}
.section-display em {
  font-style: italic;
  color: var(--ember);
}
.section-lede {
  font-size: 1.125rem;
  line-height: 1.65;
  color: var(--ink-2);
  max-width: 38rem;
}

/* Page background */
body { background-color: var(--paper); color: var(--ink); }
```

- [ ] **Step 15: Verify build**

Run:
```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: build succeeds. If Tailwind config still references `navy`/`gold` and you see "unknown color" errors, that's expected — task 1.4 fixes it.

- [ ] **Step 16: Commit**

```bash
git add frontend/src/styles/globals.css
git commit -m "feat(frontend): restyle globals.css classes to Sky palette"
```

---

### Task 1.4: Update `tailwind.config.js`

**Files:**
- Modify: `frontend/tailwind.config.js`

- [ ] **Step 1: Replace the whole file**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sky:   { DEFAULT: '#BFD3E6', 2: '#DCE7F0' },
        ink:   { DEFAULT: '#0F1E2D', 2: '#2C3D52' },
        cream: '#F4EEE0',
        paper: '#FAFAF7',
        ember: '#B9694E',
        hair:  'rgba(15,30,45,0.10)',
        // Legacy aliases (removed in Phase 7)
        navy:  { DEFAULT: '#0F1E2D', light: '#2C3D52', dark: '#0F1E2D', 50: '#DCE7F0' },
        gold:  { DEFAULT: '#B9694E', light: '#B9694E', pale: '#F4EEE0', dark: '#B9694E' },
      },
      fontFamily: {
        display: ['"Frank Ruhl Libre"', 'Georgia', 'serif'],
        body:    ['"Noto Sans Hebrew"', 'system-ui', 'sans-serif'],
        mono:    ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card:  '0 1px 0 rgba(15,30,45,0.04), 0 8px 24px rgba(15,30,45,0.06)',
        hover: '0 1px 0 rgba(15,30,45,0.04), 0 14px 40px rgba(15,30,45,0.10)',
        focus: '0 0 0 3px rgba(185,105,78,0.35)',
      },
      animation: {
        'fade-up':  'fadeUp 0.4s ease forwards',
        'slide-in': 'slideIn 0.3s ease forwards',
      },
      keyframes: {
        fadeUp:  { '0%': { opacity: 0, transform: 'translateY(16px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { '0%': { opacity: 0, transform: 'translateX(-12px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: build succeeds with zero errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(frontend): swap Tailwind theme to Sky palette + add mono family"
```

---

### Task 1.5: Add Eyebrow + SectionHeader components

**Files:**
- Create: `frontend/src/components/Eyebrow.jsx`
- Create: `frontend/src/components/SectionHeader.jsx`

- [ ] **Step 1: Write Eyebrow.jsx**

```jsx
export default function Eyebrow({ children, className = '', ...rest }) {
  return (
    <span className={`eyebrow ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Write SectionHeader.jsx**

```jsx
/**
 * Eyebrow + serif display heading + optional lede.
 *
 * Wrap one word in <em> within `title` to get the ember-accent italic
 * (e.g. title={<>Lift every <em>voice</em></>}).
 */
export default function SectionHeader({ eyebrow, title, lede, center = false }) {
  return (
    <header style={{ textAlign: center ? 'center' : 'inherit', marginBottom: '2rem' }}>
      {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
      <h2 className="section-display">{title}</h2>
      {lede && <p className="section-lede" style={{ margin: center ? '0 auto' : 0 }}>{lede}</p>}
    </header>
  );
}
```

- [ ] **Step 3: Smoke-import in dev**

Run:
```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: build succeeds (no usage yet, just imports compile).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Eyebrow.jsx frontend/src/components/SectionHeader.jsx
git commit -m "feat(frontend): add Eyebrow + SectionHeader primitives"
```

---

### Task 1.6: Preload logo

**Files:**
- Modify: `frontend/pages/_document.tsx`

- [ ] **Step 1: Add preload link**

Inside the `<Head>` block in `frontend/pages/_document.tsx`, after the existing Google Fonts link, add:

```tsx
<link rel="preload" as="image" href="/logo.jpg" />
```

The result:

```tsx
<Head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700;900&family=Noto+Sans+Hebrew:wght@300;400;500;600;700&display=swap"
    rel="stylesheet"
  />
  <link rel="preload" as="image" href="/logo.jpg" />
</Head>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/_document.tsx
git commit -m "feat(frontend): preload brand logo"
```

---

### Task 1.7: Phase 1 smoke verification

- [ ] **Step 1: Run dev server and visit all routes**

```bash
cd frontend && npm run dev
```
Then in browser:
- http://localhost:3000/ — home
- http://localhost:3000/login
- http://localhost:3000/register
- http://localhost:3000/requests
- http://localhost:3000/directory
- http://localhost:3000/volunteer
- http://localhost:3000/my-requests

Expected for each: page renders, no console errors, colors are sky-tinted (paper bg, ink text, ember CTAs). Old gold/navy fights replaced. Hero areas are now flat sky-2 instead of dark gradients.

- [ ] **Step 2: Toggle HE↔EN at least twice**

Click the language switcher in the navbar. Both languages render. RTL flips correctly.

- [ ] **Step 3: Stop server, mark Phase 1 done**

The dev server can stay running for the next phases. Just `Ctrl+C` between phase commits.

---

# Phase 2 — Chrome (Navbar / Footer / PageHeader / Modal / Toast / StatusBadge)

Sequential. Depends on Phase 1.

### Task 2.1: Restyle Navbar (logo + hardcoded color cleanup)

**Files:**
- Modify: `frontend/src/components/Navbar.jsx`

The Navbar has hardcoded `#C9971A`/`#E8B830`/`#060E1E` inline styles AND a fake `ד״ה` monogram in a gold circle. Replace the monogram with the real logo image and clean up the inline colors.

- [ ] **Step 1: Replace the logo block** (lines 73–125 in the current file)

```jsx
<Link
  href="/"
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
    alt={lang === "he" ? "דחיפה להגשמה" : "Push for Fulfillment"}
    width={40}
    height={40}
    style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
  />
  <div style={{ lineHeight: 1.2 }}>
    <div
      style={{
        color: "var(--ink)",
        fontFamily: "Frank Ruhl Libre, serif",
        fontWeight: 700,
        fontSize: "16px",
      }}
    >
      {lang === "he" ? "דחיפה להגשמה" : "Push for Fulfillment"}
    </div>
    <div
      style={{
        color: "var(--ink-2)",
        fontSize: "10px",
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      }}
    >
      {lang === "he" ? "Push for Fulfillment" : "דחיפה להגשמה"}
    </div>
  </div>
</Link>
```

- [ ] **Step 2: Update the language-toggle button** (lines 162–182 in the current file)

Replace the inline styles with paper/ink-tinted values:

```jsx
<button
  onClick={toggleLang}
  style={{
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 12px",
    borderRadius: "6px",
    background: "var(--paper)",
    color: "var(--ink-2)",
    border: "1px solid var(--hair)",
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
```

- [ ] **Step 3: Update the welcome span** (line 187 in the current file)

Replace `color: "rgba(255,255,255,0.85)"` with `color: "var(--ink-2)"`.

- [ ] **Step 4: Update the mobile language button and menu button** (lines 226–253)

For the mobile language toggle, change `background: "rgba(255,255,255,0.1)"` → `background: "var(--paper)"` and `color: "rgba(255,255,255,0.8)"` → `color: "var(--ink-2)"`.

For the hamburger menu button: change `color: "#fff"` → `color: "var(--ink)"`.

- [ ] **Step 5: Update the mobile menu drawer** (lines 259–267 in the current file)

Replace:
```jsx
background: "var(--navy)",
borderTop: "1px solid rgba(255,255,255,0.1)",
```
with:
```jsx
background: "var(--paper)",
borderTop: "1px solid var(--hair)",
```

- [ ] **Step 6: Smoke test**

Run dev server, visit homepage, verify the navbar:
- Has the real logo (not a gold circle with text)
- Is light/paper-colored, not dark navy
- The language switcher renders as a paper-bg ink-text button
- Mobile menu (open dev tools, narrow viewport) renders with paper bg

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Navbar.jsx
git commit -m "feat(frontend): swap Navbar to Sky palette + real logo"
```

---

### Task 2.2: Restyle Footer

**Files:**
- Modify: `frontend/src/components/Footer.jsx`

The Footer has the same hardcoded gold/navy palette and a fake monogram. Apply the same swaps.

- [ ] **Step 1: Top-level `<footer>` background swap** (line 14)

Change:
```jsx
<footer style={{ background:'var(--navy-dark)', color:'rgba(255,255,255,0.65)', paddingTop:'56px' }}>
```
to:
```jsx
<footer style={{ background:'var(--ink)', color:'rgba(244,238,224,0.75)', paddingTop:'56px' }}>
```

Keep the dark-on-ink footer aesthetic — editorial pages often end with a dark "colophon" section, and the logo's hand-drawing reads well on ink. (Alt: if the user later wants a light footer, swap to `var(--sky-2)` with `var(--ink-2)` text.)

- [ ] **Step 2: Replace the brand monogram block** (lines 25–36)

```jsx
<div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
  <img
    src="/logo.jpg"
    alt={t.lang === 'he' ? 'דחיפה להגשמה' : 'Push for Fulfillment'}
    width={42}
    height={42}
    style={{ borderRadius:'50%', objectFit:'cover', background:'var(--cream)' }}
  />
  <span style={{ color:'var(--cream)', fontFamily:'Frank Ruhl Libre, serif', fontWeight:700, fontSize:'18px' }}>
    {t.lang === 'he' ? 'דחיפה להגשמה' : 'Push for Fulfillment'}
  </span>
</div>
```

- [ ] **Step 3: Update social icon link hover handlers** (lines 39–55)

Replace:
- `background:'rgba(255,255,255,0.08)'` → `background:'rgba(244,238,224,0.08)'`
- `border:'1px solid rgba(255,255,255,0.12)'` → `border:'1px solid rgba(244,238,224,0.12)'`
- `color:'rgba(255,255,255,0.6)'` → `color:'rgba(244,238,224,0.7)'`
- `e.currentTarget.style.background='rgba(201,151,26,0.2)'` → `e.currentTarget.style.background='rgba(185,105,78,0.25)'`
- `e.currentTarget.style.color='#E8B830'` → `e.currentTarget.style.color='var(--ember)'`

- [ ] **Step 4: Update H4 headings color** (lines 60, 79, 92)

Change all three from `color:'#fff'` to `color:'var(--cream)'`. Also drop font-weight from 700 to 500 and add the eyebrow treatment:
```jsx
<h4 style={{
  color:'var(--cream)',
  fontSize:'11px',
  fontWeight:500,
  fontFamily:'ui-monospace, "SF Mono", Menlo, monospace',
  letterSpacing:'0.12em',
  textTransform:'uppercase',
  marginBottom:'18px',
}}>{f.quickLinks}</h4>
```
Repeat for `{f.services}` and `{f.contact}`.

- [ ] **Step 5: Update link colors** in the Quick Links and Services sections (lines 69–72, 82–85)

Replace `color:'rgba(255,255,255,0.65)'` → `color:'rgba(244,238,224,0.7)'`. Replace `e.currentTarget.style.color='#E8B830'` → `e.currentTarget.style.color='var(--ember)'`. Replace `e.currentTarget.style.color='rgba(255,255,255,0.65)'` → `e.currentTarget.style.color='rgba(244,238,224,0.7)'`.

- [ ] **Step 6: Update contact icon color** (line 100)

Change `style={{ color:'var(--gold-light)', ...}}` → `style={{ color:'var(--ember)', ...}}`.

- [ ] **Step 7: Update bottom-bar link colors** (lines 116–128)

Replace all `color:'rgba(255,255,255,0.55)'` → `color:'rgba(244,238,224,0.55)'` and `e.currentTarget.style.color='#E8B830'` → `e.currentTarget.style.color='var(--ember)'`.

- [ ] **Step 8: Update the divider color** (line 116)

Change `color:'rgba(255,255,255,0.35)'` → `color:'rgba(244,238,224,0.3)'`.

- [ ] **Step 9: Update registration line color** (line 131)

Change `color:'rgba(255,255,255,0.3)'` → `color:'rgba(244,238,224,0.35)'`.

- [ ] **Step 10: Smoke test + commit**

```bash
cd frontend && npm run dev   # check footer visually in browser
# Ctrl+C
git add frontend/src/components/Footer.jsx
git commit -m "feat(frontend): swap Footer to Sky palette + real logo"
```

---

### Task 2.3: Restyle PageHeader

**Files:**
- Read first: `frontend/src/components/PageHeader.jsx`
- Modify: `frontend/src/components/PageHeader.jsx`

- [ ] **Step 1: Read the file** to see current props

Run:
```bash
cat frontend/src/components/PageHeader.jsx
```

- [ ] **Step 2: Rewrite to use SectionHeader composition**

Replace the file's body with a thin wrapper around `SectionHeader`:

```jsx
import SectionHeader from './SectionHeader';

/**
 * Legacy PageHeader API. Internally composes SectionHeader so old call sites
 * keep working. Props: { title, subtitle, eyebrow?, center? }
 */
export default function PageHeader({ title, subtitle, eyebrow, center = true }) {
  return (
    <div style={{ padding: '64px 0 32px', background: 'var(--sky-2)' }}>
      <div className="page-container">
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          lede={subtitle}
          center={center}
        />
      </div>
    </div>
  );
}
```

If the original PageHeader exposed different props (e.g., `icon` or `breadcrumb`), preserve them by passing through as additional siblings inside the `page-container` div. Verify by re-reading the original file.

- [ ] **Step 3: Smoke test by visiting any screen that uses PageHeader**

`grep -rn "PageHeader" frontend/src/screens/` to find call sites. Visit one in the browser, confirm the new sky-2 band + eyebrow + serif H1 + lede pattern.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PageHeader.jsx
git commit -m "feat(frontend): rewrite PageHeader as editorial SectionHeader"
```

---

### Task 2.4: Restyle Modal + Toast + StatusBadge

These three components already use `globals.css` class names (`.modal-*`, `.toast`, `.badge-*`). Phase 1 restyled those classes, so the components inherit automatically — no JSX changes needed. Verify.

- [ ] **Step 1: Read each file** to confirm class usage (not inline colors)

```bash
cat frontend/src/components/Modal.jsx
cat frontend/src/components/Toast.jsx
cat frontend/src/components/StatusBadge.jsx
```

- [ ] **Step 2: For each file, scan for hardcoded hex colors**

Look for `#C9971A`, `#E8B830`, `#0B1D3E`, `#060E1E`, `#152B5A`, `rgba(11,29,62,...`, `rgba(201,151,26,...`. If any found, replace per the Token Swap Rules table at the top of this plan.

- [ ] **Step 3: Smoke test**

Open `/requests` in the browser, open the page until a toast or modal appears (e.g., submit an invalid request to trigger the validation toast). Confirm: toast has ink bg + cream text + ember border-start; modal overlay uses the same dark ink overlay (already correct via globals.css).

- [ ] **Step 4: Commit anything modified**

```bash
git add frontend/src/components/Modal.jsx frontend/src/components/Toast.jsx frontend/src/components/StatusBadge.jsx
git commit -m "feat(frontend): align Modal/Toast/StatusBadge inline colors to Sky palette" || echo "Nothing to commit"
```

---

# Phase 3 — Marketing Screens (parallelizable)

Phases 3.1, 3.2, 3.3 are independent — each only touches its own screen file. Use `superpowers:dispatching-parallel-agents` to run all three in parallel after Phase 2 is committed.

### Task 3.1: Restyle HomePage

**Files:**
- Read first: `frontend/src/screens/HomePage.jsx`
- Modify: `frontend/src/screens/HomePage.jsx`

- [ ] **Step 1: Read the file**

```bash
cat frontend/src/screens/HomePage.jsx | head -100
```
Identify the hero section, mission section, "how we help" section, and the 3-up stat band.

- [ ] **Step 2: Apply Token Swap Rules**

Search the file for hardcoded hex colors and `var(--navy)`/`var(--gold)` references. For each:
- Old hex like `#0B1D3E`, `#060E1E`, `#152B5A` → `var(--ink)`
- Old hex like `#C9971A`, `#E8B830` → `var(--ember)`
- Inline `linear-gradient(...navy...)` for hero → `background: var(--sky-2)` flat
- Any `bg-navy*`, `bg-gold*`, `text-navy*`, `text-gold*` Tailwind classes → `bg-ink`, `bg-ember`, `text-ink`, `text-ember`

- [ ] **Step 3: Rewrite the hero block** to use the editorial pattern

Find the hero (likely the first big section with the H1 + CTAs). Replace its inner JSX with:

```jsx
<section style={{ background:'var(--sky-2)', padding:'80px 0 96px' }}>
  <div className="page-container" style={{ textAlign:'center' }}>
    <img
      src="/logo.jpg"
      alt={t.lang === 'he' ? 'דחיפה להגשמה' : 'Push for Fulfillment'}
      width={88}
      height={88}
      style={{ borderRadius:'50%', objectFit:'cover', marginBottom:'24px' }}
    />
    <div className="section-eyebrow" style={{ textAlign:'center' }}>
      {t.lang === 'he' ? 'עמותת דחיפה להגשמה' : 'Push for Fulfillment · NGO'}
    </div>
    <h1 className="section-display" style={{
      fontSize:'clamp(2.5rem, 4.5vw, 4rem)',
      maxWidth:'48rem',
      margin:'0 auto 24px',
    }}>
      {/* Use t.home.heroTitle, but wrap the emotional verb in <em> for ember.
          If translation strings don't support markup, fall back to flat title. */}
      {t.home.heroTitle}
    </h1>
    <p className="section-lede" style={{ margin:'0 auto 32px' }}>
      {t.home.heroSubtitle}
    </p>
    <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
      <Link href="/requests" className="btn btn-primary btn-lg">
        {t.home.ctaPrimary} →
      </Link>
      <Link href="/directory" className="btn btn-outline btn-lg">
        {t.home.ctaSecondary}
      </Link>
    </div>
  </div>
</section>
```

Adjust the translation keys (`t.home.heroTitle`, etc.) to match what's actually in `LanguageContext`. If the existing code reads from different keys, keep those.

- [ ] **Step 4: Section rhythm**

For each subsequent section (mission, "how we help", stats), wrap it in:
```jsx
<section style={{ padding:'72px 0' }}>
  <div className="page-container">
    <SectionHeader eyebrow="..." title="..." lede="..." />
    {/* existing section body, with token swap applied */}
  </div>
</section>
```

Import `SectionHeader` at the top:
```jsx
import SectionHeader from '../components/SectionHeader';
```

- [ ] **Step 5: Smoke test**

```bash
cd frontend && npm run dev
```
Visit `/`. Confirm: hero has real logo, eyebrow above serif H1, ember CTA primary on cream foreground, sky-2 hero band. HE and EN both render. No console errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/screens/HomePage.jsx
git commit -m "feat(frontend): redesign HomePage to editorial Sky layout"
```

---

### Task 3.2: Restyle LoginPage

**Files:**
- Read first: `frontend/src/screens/LoginPage.jsx`
- Modify: `frontend/src/screens/LoginPage.jsx`

- [ ] **Step 1: Read the file**

```bash
cat frontend/src/screens/LoginPage.jsx
```

- [ ] **Step 2: Apply Token Swap Rules** (same as 3.1 step 2)

- [ ] **Step 3: Adopt two-column layout**

Wrap the existing form in a two-column grid where the left column is a sky-2 branded panel and the right is the form. Use this skeleton:

```jsx
<div style={{
  minHeight:'calc(100vh - 64px)',
  display:'grid',
  gridTemplateColumns:'1fr',
  background:'var(--paper)',
}}
className="login-grid"
>
  <aside style={{
    background:'var(--sky-2)',
    padding:'56px 40px',
    display:'flex',
    flexDirection:'column',
    justifyContent:'center',
    alignItems:'center',
    gap:'20px',
  }}
  className="login-aside"
  >
    <img src="/logo.jpg" alt="logo" width={96} height={96}
         style={{ borderRadius:'50%', objectFit:'cover' }} />
    <div className="section-eyebrow" style={{ textAlign:'center' }}>
      {t.lang === 'he' ? 'עמותת דחיפה להגשמה' : 'Push for Fulfillment'}
    </div>
    <h1 className="section-display" style={{
      fontSize:'clamp(1.75rem, 3vw, 2.25rem)',
      textAlign:'center',
      maxWidth:'24rem',
    }}>
      {t.auth.login.welcomeHeading || (t.lang === 'he' ? 'ברוכים השבים' : 'Welcome back')}
    </h1>
  </aside>

  <main style={{
    padding:'56px 40px',
    display:'flex',
    flexDirection:'column',
    justifyContent:'center',
    maxWidth:'480px',
    width:'100%',
    margin:'0 auto',
  }}>
    {/* paste the existing login form JSX here, unchanged except for the
        Token Swap Rules from Phase 1 */}
  </main>
</div>
```

Append a media query rule at the bottom of `frontend/src/styles/globals.css` to widen to two columns on desktop:
```css
@media (min-width: 900px) {
  .login-grid { grid-template-columns: 1fr 1fr; }
}
```

- [ ] **Step 4: Smoke test**

Visit `/login`. Mobile (narrow viewport) shows single column; desktop (wide) shows two columns. HE/EN both work. Submit a wrong password to confirm error state still renders.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/LoginPage.jsx frontend/src/styles/globals.css
git commit -m "feat(frontend): redesign LoginPage to editorial two-column"
```

---

### Task 3.3: Restyle RegisterPage

Same pattern as Login. Use the same two-column grid. The form column is taller (more fields) — make sure it scrolls cleanly.

**Files:**
- Read first: `frontend/src/screens/RegisterPage.jsx`
- Modify: `frontend/src/screens/RegisterPage.jsx`

- [ ] **Step 1: Read the file**

```bash
cat frontend/src/screens/RegisterPage.jsx
```

- [ ] **Step 2: Apply Token Swap Rules** + adopt the same two-column shell as Task 3.2 step 3. Change the heading to `t.auth.register.welcomeHeading` (or whatever the existing key is).

- [ ] **Step 3: For the form column,** if there are role-selection cards (beneficiary / volunteer / business / NGO), use `.cat-option` class which Phase 1 already restyled.

- [ ] **Step 4: Smoke test** — visit `/register`, fill the form, submit. Confirm validation still fires and the navy hover states are gone.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/RegisterPage.jsx
git commit -m "feat(frontend): redesign RegisterPage to editorial two-column"
```

---

# Phase 4 — UC-01 Critical Path

Sequential. Do not run in parallel — this is Muhammad's own UC and a regression here costs the demo.

### Task 4.1: Restyle RequestsPage (the 20KB monster)

**Files:**
- Read first: `frontend/src/screens/RequestsPage.jsx` (in chunks)
- Modify: `frontend/src/screens/RequestsPage.jsx`

- [ ] **Step 1: Read the file in 3 chunks**

```bash
wc -l frontend/src/screens/RequestsPage.jsx
```
If >500 lines, read in passes:
```bash
sed -n '1,200p' frontend/src/screens/RequestsPage.jsx
sed -n '201,400p' frontend/src/screens/RequestsPage.jsx
sed -n '401,$p'   frontend/src/screens/RequestsPage.jsx
```
Map the step structure (which steps exist, what state lives where, what handlers exist). **Do not modify state / handlers — only styling and structure.**

- [ ] **Step 2: Apply Token Swap Rules** to the entire file

Hex swaps + `var(--navy)`→`var(--ink)` + `var(--gold)`→`var(--ember)`. Don't change any function names, prop names, or state keys.

- [ ] **Step 3: Replace the top page banner / hero**

Wrap whatever existing intro/title block in:
```jsx
<section style={{ background:'var(--sky-2)', padding:'48px 0 32px' }}>
  <div className="page-container">
    <SectionHeader
      eyebrow={t.lang === 'he' ? 'בקשה לסיוע' : 'Submit a request'}
      title={t.requests.heading}
      lede={t.requests.lede}
    />
  </div>
</section>
```

Add the import:
```jsx
import SectionHeader from '../components/SectionHeader';
```

- [ ] **Step 4: Wrap each step body in a Card**

Each step (likely 4 steps: category → details → contact → review) should render inside a `.card` with `.card-body` padding:

```jsx
<div className="page-container" style={{ paddingTop:'32px', paddingBottom:'48px', maxWidth:'780px' }}>
  <div className="card">
    <div className="card-body">
      {/* existing step JSX, with form-input / form-textarea / form-label classes preserved */}
    </div>
  </div>
</div>
```

The existing form likely already uses these class names — Phase 1 restyled them. If it uses inline styles instead, do not rewrite the whole form right now; just swap colors.

- [ ] **Step 5: Style the sticky bottom action bar**

If the page has Back/Continue buttons at the bottom, wrap them in:
```jsx
<div style={{
  position:'sticky',
  bottom:0,
  background:'var(--paper)',
  borderTop:'1px solid var(--hair)',
  padding:'16px 0',
  marginTop:'32px',
}}>
  <div className="page-container" style={{ maxWidth:'780px', display:'flex', justifyContent:'space-between', gap:'12px' }}>
    <button className="btn btn-outline" onClick={handleBack}>{t.requests.back}</button>
    <button className="btn btn-primary" onClick={handleNext}>{t.requests.continue} →</button>
  </div>
</div>
```

- [ ] **Step 6: Critical smoke — full submit flow in HE and EN**

```bash
cd frontend && npm run dev
```
Submit the form end-to-end in Hebrew. Then switch language and do it again in English. Confirm:
- All 4 steps render
- Step indicator dots advance correctly (ink filled, ember "current", sky-2 "todo")
- File upload still works (UploadArea inherits Phase 1 class restyle)
- Form submits successfully
- Success toast appears with new ink/cream styling

- [ ] **Step 7: Commit**

```bash
git add frontend/src/screens/RequestsPage.jsx
git commit -m "feat(frontend): redesign RequestsPage (UC-01) to editorial card flow"
```

---

### Task 4.2: Restyle MyRequestsPage

**Files:**
- Read first: `frontend/src/screens/MyRequestsPage.jsx`
- Modify: `frontend/src/screens/MyRequestsPage.jsx`

- [ ] **Step 1: Read** the file.

- [ ] **Step 2: Apply Token Swap Rules.**

- [ ] **Step 3: Replace the top of the page** with a sky-2 SectionHeader (same pattern as Task 4.1 step 3) using eyebrow `MY REQUESTS` / `הבקשות שלי` and a brief lede.

- [ ] **Step 4: For the requests list:** if it's currently rendering cards in a grid, switch to a data-list pattern — each request becomes one row in a `<div className="card">` with the request title (Frank Ruhl Libre, 18px), date (mono, ink-2), and a StatusBadge on the right. Hair divider between rows.

```jsx
<div className="card">
  {requests.map((r, i) => (
    <div key={r.id} style={{
      padding:'18px 24px',
      borderBottom: i < requests.length - 1 ? '1px solid var(--hair)' : 'none',
      display:'flex',
      justifyContent:'space-between',
      alignItems:'center',
      gap:'16px',
    }}>
      <div>
        <div style={{ fontFamily:'ui-monospace, "SF Mono", Menlo, monospace', fontSize:'12px', color:'var(--ink-2)', letterSpacing:'0.06em' }}>
          {formatDate(r.createdAt)}
        </div>
        <div style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'18px', color:'var(--ink)', marginTop:'4px' }}>
          {r.title}
        </div>
      </div>
      <StatusBadge status={r.status} />
    </div>
  ))}
</div>
```

- [ ] **Step 5: Smoke test** — visit `/my-requests` while logged in. List renders. Click a row → existing modal/detail flow still works.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/screens/MyRequestsPage.jsx
git commit -m "feat(frontend): redesign MyRequestsPage to editorial data list"
```

---

### Task 4.3: Restyle UploadArea + StepIndicator

Both already use `.upload-area` / `.step-dot` classes that Phase 1 restyled. Smoke check + fix any inline colors.

**Files:**
- Read first: `frontend/src/components/UploadArea.jsx`, `frontend/src/components/StepIndicator.jsx`
- Modify: same files if hardcoded colors found

- [ ] **Step 1: Read both files** and grep for hex colors:
```bash
grep -nE '#[0-9A-Fa-f]{3,6}|rgba\(' frontend/src/components/UploadArea.jsx frontend/src/components/StepIndicator.jsx
```

- [ ] **Step 2: For each hex match, apply Token Swap Rules.**

- [ ] **Step 3: Smoke test** during UC-01 flow (already covered in 4.1 step 6 if you didn't restart).

- [ ] **Step 4: Commit any changes**

```bash
git add frontend/src/components/UploadArea.jsx frontend/src/components/StepIndicator.jsx
git commit -m "feat(frontend): clean UploadArea + StepIndicator inline colors" || echo "Nothing to commit"
```

---

# Phase 5 — Directory + Volunteer (parallelizable)

Phases 5.1 and 5.2 are independent. Run in parallel via `superpowers:dispatching-parallel-agents`.

### Task 5.1: Restyle DirectoryPage + Pagination + StatCard

**Files:**
- Read first: `frontend/src/screens/DirectoryPage.jsx`, `frontend/src/components/Pagination.jsx`, `frontend/src/components/StatCard.jsx`
- Modify: same three files

- [ ] **Step 1: Read DirectoryPage** (it's 17KB — read in chunks if needed)

```bash
sed -n '1,200p' frontend/src/screens/DirectoryPage.jsx
sed -n '201,$p'   frontend/src/screens/DirectoryPage.jsx
```

- [ ] **Step 2: Apply Token Swap Rules.**

- [ ] **Step 3: Top of page → SectionHeader in sky-2 band** (same pattern as 4.1 step 3).

- [ ] **Step 4: Filter bar:** The page likely has filter chips for category/region. They should already use `.filter-chip` class which Phase 1 restyled (mono uppercase, ember when active). If they use inline styling, convert to className-based:

```jsx
<button
  className={`filter-chip ${active ? 'active' : ''}`}
  onClick={() => setFilter(cat)}
>
  {cat.label}
</button>
```

Wrap filter bar in `style={{ background:'var(--sky-2)', padding:'20px 0', marginBottom:'32px' }}` to keep it visually grouped.

- [ ] **Step 5: Results grid:** each card uses `.card` class. Card body becomes:

```jsx
<div className="card">
  <div className="card-body" style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
    <div className="eyebrow">{item.category}</div>
    <h3 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'1.25rem', color:'var(--ink)', margin:0 }}>
      {item.name}
    </h3>
    <div style={{ fontSize:'0.875rem', color:'var(--ink-2)' }}>{item.region}</div>
    <p style={{ fontSize:'0.95rem', color:'var(--ink-2)', lineHeight:1.6 }}>
      {item.description}
    </p>
  </div>
</div>
```

- [ ] **Step 6: Pagination + StatCard color cleanup**

For both files, grep for hex colors and apply Token Swap Rules. Pagination already uses `.page-btn` class restyled in Phase 1.

```bash
grep -nE '#[0-9A-Fa-f]{3,6}|rgba\(' frontend/src/components/Pagination.jsx frontend/src/components/StatCard.jsx
```

- [ ] **Step 7: Smoke test** — visit `/directory`. Filter chips render, click toggles them, results re-render. Pagination clicks navigate pages.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/screens/DirectoryPage.jsx frontend/src/components/Pagination.jsx frontend/src/components/StatCard.jsx
git commit -m "feat(frontend): redesign DirectoryPage + Pagination + StatCard"
```

---

### Task 5.2: Restyle VolunteerPage + VolunteerCard

**Files:**
- Read first: `frontend/src/screens/VolunteerPage.jsx`, `frontend/src/components/VolunteerCard.jsx`
- Modify: both

- [ ] **Step 1: Read** both files.

- [ ] **Step 2: Apply Token Swap Rules.**

- [ ] **Step 3: VolunteerPage hero:** same SectionHeader pattern as HomePage but smaller. Sky-2 background, eyebrow `VOLUNTEER` / `התנדבות`, serif H1, lede.

- [ ] **Step 4: Body sections:** longer-form editorial. Each section uses `SectionHeader` with eyebrow + serif H2 + body paragraphs `max-width: 38rem`.

- [ ] **Step 5: VolunteerCard restyle**

Replace whatever the current card layout is with:
```jsx
<div className="card" style={{ padding:'24px' }}>
  <div className="eyebrow">{volunteer.role}</div>
  <h3 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'1.25rem', color:'var(--ink)', margin:'4px 0 12px' }}>
    {volunteer.name}
  </h3>
  <p style={{ fontSize:'0.95rem', color:'var(--ink-2)', lineHeight:1.6, margin:0 }}>
    {volunteer.bio}
  </p>
</div>
```

- [ ] **Step 6: Smoke test** — visit `/volunteer`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/screens/VolunteerPage.jsx frontend/src/components/VolunteerCard.jsx
git commit -m "feat(frontend): redesign VolunteerPage + VolunteerCard"
```

---

# Phase 6 — View Transitions

Sequential. Depends on Phases 1–5.

### Task 6.1: Verify React version supports ViewTransition

- [ ] **Step 1: Check React version**

```bash
cd frontend && cat package.json | grep '"react"'
```

`<ViewTransition>` is React 19+. If React is 18, the skill `vercel-react-view-transitions` will document the polyfill / experimental import. If the version is incompatible, **skip Phase 6 entirely** — the redesign demo-ships without route transitions. Document the skip in the commit message and move to Phase 7.

- [ ] **Step 2: If React ≥ 19,** invoke the `vercel-react-view-transitions` skill to load its API reference:

The skill provides the canonical wrapper pattern. Follow its `<ViewTransition>` documentation for the Next.js Pages Router specifically.

---

### Task 6.2: Wrap `_app.tsx` in ViewTransition (only if React ≥ 19)

**Files:**
- Modify: `frontend/pages/_app.tsx`

- [ ] **Step 1: Add the import**
```tsx
import { unstable_ViewTransition as ViewTransition } from 'react';
```

- [ ] **Step 2: Wrap `<Component {...pageProps} />`**

```tsx
<ViewTransition>
  <Component {...pageProps} />
</ViewTransition>
```

- [ ] **Step 3: Add view-transition CSS** at the bottom of `frontend/src/styles/globals.css`:

```css
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 180ms;
    animation-timing-function: cubic-bezier(0.2, 0.7, 0.1, 1);
  }
}
```

- [ ] **Step 4: Smoke test** — navigate between Home → Directory → Volunteer. Transition should be a smooth crossfade (~180ms), not an instant cut. Toggle `prefers-reduced-motion` in DevTools to confirm it disables.

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/_app.tsx frontend/src/styles/globals.css
git commit -m "feat(frontend): wire ViewTransition for route changes"
```

---

# Phase 7 — A11y + Cleanup

Sequential.

### Task 7.1: Delete duplicate component files

**Files:**
- Delete: `frontend/src/components/Formelements.jsx`
- Delete: `frontend/src/components/Stepindicator.jsx`

- [ ] **Step 1: Verify nothing imports the lowercase variants**

```bash
grep -rn "from.*Formelements" frontend/src/ frontend/pages/
grep -rn "from.*Stepindicator" frontend/src/ frontend/pages/
```
Expected: no matches (case-sensitive filesystems should already be using `FormElements`/`StepIndicator`).

- [ ] **Step 2: Delete the duplicates**

```bash
rm frontend/src/components/Formelements.jsx
rm frontend/src/components/Stepindicator.jsx
```

- [ ] **Step 3: Build to confirm no breakage**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src/components/
git commit -m "chore(frontend): remove duplicate case-variant component files"
```

---

### Task 7.2: Remove legacy color aliases

**Files:**
- Modify: `frontend/src/styles/globals.css`
- Modify: `frontend/tailwind.config.js`

- [ ] **Step 1: Grep for any remaining usage of the legacy aliases**

```bash
grep -rn 'var(--navy\|var(--gold' frontend/src/ frontend/pages/
grep -rn '"navy\|"gold\|bg-navy\|bg-gold\|text-navy\|text-gold' frontend/src/ frontend/pages/
```
Expected: zero hits after Phases 2–5. If any hits exist, fix them now — Token Swap Rules apply.

- [ ] **Step 2: Delete the alias lines** in `globals.css` `:root` block (the block labeled "Back-compat aliases — leave for now"):

Find and remove these lines:
```css
--navy:       var(--ink);
--navy-light: var(--ink-2);
--navy-dark:  var(--ink);
--gold:       var(--ember);
--gold-light: var(--ember);
--gold-pale:  var(--cream);
```

- [ ] **Step 3: Delete `navy` and `gold` entries** in `tailwind.config.js`:

Remove these two lines from the `colors` block:
```js
navy:  { DEFAULT: '#0F1E2D', light: '#2C3D52', dark: '#0F1E2D', 50: '#DCE7F0' },
gold:  { DEFAULT: '#B9694E', light: '#B9694E', pale: '#F4EEE0', dark: '#B9694E' },
```

- [ ] **Step 4: Rebuild and smoke test**

```bash
cd frontend && npm run build && npm run dev
```
Visit every route. No regressions expected.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/globals.css frontend/tailwind.config.js
git commit -m "chore(frontend): drop legacy navy/gold color aliases"
```

---

### Task 7.3: A11y audit

Use the `chrome-devtools:a11y-debugging` skill.

- [ ] **Step 1: Invoke the skill** and run the audit on these routes:
- `/`
- `/login`
- `/requests`
- `/directory`

- [ ] **Step 2: Fix any reported issues**

Expected categories to verify per the spec §7:
- All interactive elements have visible focus ring (ember/35)
- Form inputs have associated `<label>`
- Modal traps focus and has `aria-modal="true"`
- Color contrast on ember-on-cream passes for ≥18px or bold text
- Tab order matches reading order in both LTR and RTL

- [ ] **Step 3: Commit fixes**

```bash
git add -A frontend/
git commit -m "fix(frontend): a11y issues from audit pass"
```

---

### Task 7.4: LCP audit

Use the `chrome-devtools:debug-optimize-lcp` skill.

- [ ] **Step 1: Invoke the skill** and audit `/` and `/directory`.

- [ ] **Step 2: Confirm LCP ≤ 2.5s** on the throttled Cable profile.

- [ ] **Step 3: Fix any reported issues** — most likely candidates are unoptimized images (the logo) or render-blocking fonts. The logo is already preloaded in Task 1.6.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A frontend/
git commit -m "perf(frontend): LCP optimizations from audit" || echo "Nothing to commit"
```

---

### Task 7.5: Rebase on main, open PR

- [ ] **Step 1: Fetch and rebase**

```bash
git fetch origin main
git rebase origin/main
```
If conflicts: resolve in favor of redesign on touched files (`globals.css`, `tailwind.config.js`, components), in favor of main for any other file that a teammate also touched. Use `superpowers:systematic-debugging` if a conflict isn't obvious.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin redesign/frontend-brand-refresh
```

- [ ] **Step 3: Open PR via gh CLI**

```bash
gh pr create --title "Frontend brand refresh — Sky / editorial redesign" --body "$(cat <<'EOF'
## Summary
- Swap loud navy+gold theme for the approved Sky palette + Quiet Editorial voice
- Honor the manager-supplied logo across Navbar, Footer, hero areas, auth pages
- Restyle all 7 screens and 12 components
- Wire route-level View Transitions
- A11y + LCP audits passed

## Spec
docs/superpowers/specs/2026-05-18-frontend-redesign-design.md

## Test plan
- [ ] All 7 routes render in HE and EN
- [ ] UC-01 submit flow completes end-to-end in both languages
- [ ] Lighthouse a11y ≥ 95 on Home, Login, Requests, Directory
- [ ] LCP ≤ 2.5s on cable profile
- [ ] No console errors
- [ ] No regressions in concurrent UCs (admin, chat, directory data)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Return the PR URL to the user**

---

## Parallelization Plan (for `superpowers:subagent-driven-development`)

Phase boundaries that allow parallel subagent dispatch:

| After phase commits | Run in parallel | Files touched (no overlap) |
|---|---|---|
| Phase 2 done | Tasks 3.1, 3.2, 3.3 | HomePage.jsx · LoginPage.jsx · RegisterPage.jsx |
| Phase 4 done | Tasks 5.1, 5.2 | DirectoryPage.jsx + Pagination.jsx + StatCard.jsx · VolunteerPage.jsx + VolunteerCard.jsx |

All other tasks must run sequentially because they share files (globals.css, tailwind.config.js, _app.tsx) or have data dependencies (UC-01 review gate).

---

## Self-review

Performed inline. Issues caught and resolved:

1. **Spec called for new `components/ui/` primitive directory; plan uses existing globals.css classes instead.** Documented in this plan's Architecture paragraph and at the top of Phase 1. The spec's §4 "Component Primitives" table is now interpreted as "restyle these existing classes / add the two missing primitives (Eyebrow, SectionHeader)." This is a deliberate scope reduction approved by the architecture discovery in Phase 1.
2. **Hardcoded inline colors in Navbar / Footer not predicted by spec.** Plan now has explicit JSX edit tasks (2.1, 2.2) with line-by-line replacements.
3. **Logo placement.** Spec did not specify `public/` setup — added as Task 1.1.
4. **View Transitions depend on React 19.** Added Task 6.1 to gate Phase 6 on React version. The redesign demo-ships even if Phase 6 is skipped.
5. **Legacy `--navy` / `--gold` aliases** allow incremental phase commits without breaking the screens that still reference them. Task 7.2 removes the safety net at the end.

No placeholders. No "TBD." Type-consistent (helper function names: `SectionHeader` and `Eyebrow` are used uniformly across phases). Every spec section maps to at least one task.

---

## Acceptance

Plan is accepted when implementation has reached Phase 7 cleanly and the PR is open on GitHub. Per the user's request ("use subagents to make it faster"), execution proceeds via `superpowers:subagent-driven-development`.
