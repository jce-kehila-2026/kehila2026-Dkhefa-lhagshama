# Frontend Redesign — Design Spec

**Date:** 2026-05-18
**Owner:** Muhammad Marmash
**Branch:** `redesign/frontend-brand-refresh`
**Status:** Draft — awaiting user review

---

## 1. Goal

Replace the loud navy + gold theme with a calm "Sky / Editorial" brand system that honors the manager-supplied logo (hand-drawn hands cradling a lotus on a pale sky). Apply to all 7 screens and 12 components in `frontend/src/` without regressing the existing UC-01 form, HE/EN switch, or other teammates' in-flight work on `main`.

**Non-goals:**
- No new features. UC behavior is unchanged.
- No backend changes.
- No mobile-app port.
- No swap of Firebase, Next.js, or Tailwind.

---

## 2. Constraints

- **Hard deadline:** Test Plan due **2026-05-24** (6 days). Redesign must not block other UC owners. Stay on the dedicated branch; rebase before merge.
- **Bilingual:** HE/EN switch must remain functional. RTL must not regress. Body font already handles Hebrew (Noto Sans Hebrew); display serif must have a Hebrew-readable fallback.
- **Stack lock:** Tailwind config only — no new CSS framework, no design-system import (no Radix, no shadcn install).
- **A11y:** WCAG 2.1 AA contrast minimum. `prefers-reduced-motion` honored. Focus states visible.
- **Bundle:** Net additional JS ≤ 0 (replacing styles, not adding deps). One Google Fonts request acceptable.

---

## 3. Design Tokens (locked)

### Colors

```js
// tailwind.config.js — extend.colors
sky:    { DEFAULT: '#BFD3E6', 2: '#DCE7F0' },  // page wash, hero band
ink:    { DEFAULT: '#0F1E2D', 2: '#2C3D52' },  // type, primary CTAs
cream:  '#F4EEE0',                              // CTA foreground, cards
paper:  '#FAFAF7',                              // page background
ember:  '#B9694E',                              // accent / emphasis only
hair:   'rgba(15,30,45,0.10)',                  // 1px dividers
```

**Usage rules:**
- `paper` is the page background. `sky-2` is the hero/section-band background.
- `ink` is type and primary CTAs (button bg). `cream` is the CTA *foreground* (button text).
- `ember` is reserved for emphasis (italic words in H1s, error/destructive states, "active" filter chip). Never used for body text or block backgrounds.
- The old `navy` and `gold` Tailwind keys are removed entirely. No back-compat shim.

### Typography

- **Display (H1/H2):** `"Frank Ruhl Libre", Georgia, serif` — already loaded.
- **Body:** `"Noto Sans Hebrew", system-ui, sans-serif` — already loaded.
- **Mono / eyebrow:** `ui-monospace, "SF Mono", Menlo, monospace` — system stack, **no new font download**. Used uppercased with 0.12em letter-spacing for section eyebrows, micro-labels, table headers, ≤12px.

Scale (clamp-based, fluid):

```
display-xl  clamp(2.5rem, 4.5vw, 4rem)      — hero H1
display-lg  clamp(2rem, 3.5vw, 3rem)        — page H1
display-md  clamp(1.5rem, 2.5vw, 2rem)      — section H2
body-lg     1.125rem / 1.65                  — lede paragraph
body        1rem / 1.6                       — default
body-sm     0.875rem / 1.5                   — secondary
eyebrow     0.75rem / 1.2 uppercase 0.12em   — mono labels
```

### Spacing & radius

- Tailwind defaults stay. Cards use `rounded-2xl` (16px). Buttons use `rounded-xl` (12px). Inputs use `rounded-lg` (8px).
- Section vertical rhythm: `py-16` on desktop, `py-10` on mobile.
- Max content width: `max-w-6xl` for screens, `max-w-3xl` for form-heavy screens (UC-01).

### Shadows (replace existing)

```js
boxShadow: {
  card:  '0 1px 0 rgba(15,30,45,0.04), 0 8px 24px rgba(15,30,45,0.06)',
  hover: '0 1px 0 rgba(15,30,45,0.04), 0 14px 40px rgba(15,30,45,0.10)',
  focus: '0 0 0 3px rgba(185,105,78,0.35)',  // ember at 35% — focus ring
}
```

The old `glow` shadow is removed.

### Motion

- Use `vercel-react-view-transitions` skill for: route changes, list filter reorders, modal open/close.
- Durations: 140ms (micro), 180ms (page), 260ms (modal). Easing: `cubic-bezier(0.2, 0.7, 0.1, 1)`.
- All transitions wrapped in `@media (prefers-reduced-motion: no-preference)`.

---

## 4. Component Primitives (custom Tailwind, no library)

Build only what we need. Each is a single `.jsx` file in `frontend/src/components/ui/` with one export.

| Primitive | Replaces | Notes |
|---|---|---|
| `<Button variant="primary\|secondary\|ghost">` | inline button styles | Primary = ink bg / cream fg; secondary = ink border / ink fg / paper bg; ghost = ink fg, hover ink/5 bg. |
| `<Input>`, `<Textarea>`, `<Select>` | `FormElements.jsx` | Hair border, focus ring ember/35, error border ember. |
| `<Card>` + `<CardHeader>` + `<CardBody>` | ad-hoc cards | paper bg, card shadow, rounded-2xl, hair divider between header/body. |
| `<Eyebrow>` | inline `<p class="text-xs uppercase">` | mono, ink-2 color, 0.12em tracking. |
| `<Tag>` | StatusBadge.jsx | sky-2 bg / ink fg by default; ember bg / cream fg for "urgent" only. |
| `<SectionHeader title eyebrow>` | PageHeader.jsx | composition: eyebrow + serif H2, max-w-3xl. |
| `<DataList>` | ad-hoc tables on MyRequestsPage / DirectoryPage | hair row dividers, no zebra, mono numerals. |

`Modal.jsx`, `Toast.jsx`, `Pagination.jsx`, `Stepindicator.jsx`, `UploadArea.jsx`, `VolunteerCard.jsx`, `StatCard.jsx`, `Footer.jsx`, `Navbar.jsx` are restyled in-place — they keep their existing API so the screens don't all need refactoring at once.

**Casing fix:** `Formelements.jsx` and `Stepindicator.jsx` (lowercase second word) are duplicates of `FormElements.jsx` and `StepIndicator.jsx`. Delete the lowercase variants; keep PascalCase.

---

## 5. Screen-by-Screen

Each screen keeps its current route, props, and business logic. Only layout + tokens change.

### HomePage.jsx
- Hero band: `bg-sky-2`, `py-20`, centered logo (max-h-24), eyebrow "עמותת דחיפה להגשמה / Push for Fulfillment", serif H1 with one ember `<em>` on the emotional verb (e.g., "*Lift* every voice"), ink primary CTA "Submit a request →", ghost secondary "Browse directory".
- Mission paragraph: `max-w-2xl`, body-lg, ink-2.
- 3-up stat band: `<StatCard>` restyled — paper bg, hair top border, mono numerals, ink-2 label.
- "How we help" section: 3 SectionHeaders + body, each with a tiny ember bullet.

### LoginPage.jsx / RegisterPage.jsx
- Two-column on desktop (`md:grid-cols-2`): left = sky-2 wash with logo + brand line; right = paper form on a card. Single column on mobile.
- Inputs use new primitives. Submit = primary Button. Switch link = ghost Button.

### RequestsPage.jsx (UC-01 — Muhammad's UC, do not break)
- Stepindicator at top — ink filled steps, hair upcoming, ember "current" dot.
- Each step is a `<Card>` with one `<SectionHeader>` and form primitives.
- Sticky bottom bar: ghost "Back", primary "Continue →".
- UploadArea: dashed hair border, ember on drag-over, ink fg.
- No behavior change. Form validation, state, and submit handler stay as-is.

### MyRequestsPage.jsx
- Eyebrow + serif H1 + body-lg lede.
- `<DataList>` of requests: date (mono), title (serif sm), status `<Tag>`. Click row → details modal.

### DirectoryPage.jsx
- Filter bar: sky-2 band, mono eyebrow filters as `<Tag>` (active = ember bg).
- Results grid: `<Card>` per entry — name (serif), category (mono eyebrow), region (body-sm), one-line description (body).
- Pagination component restyled — ink active page on cream chip, ghost others.

### VolunteerPage.jsx
- Mirrors HomePage hero but smaller. Body is a longer-form editorial layout: serif H2 sections, body paragraphs at `max-w-2xl`.
- VolunteerCard restyled: paper bg, hair border-l, mono name eyebrow above serif role.

---

## 6. RTL / Bilingual

- `dir` attr already toggled at `<html>` by `LanguageContext`. No JSX changes required.
- All new spacing uses Tailwind logical properties where the old code used `ml-/mr-` directly. Convert to `ms-/me-` (margin-start/end) **only in newly added components**. Existing screens are left alone except where touched for restyle.
- Hebrew display: Frank Ruhl Libre includes Hebrew glyphs — confirm at first render. Fallback `Georgia` covers Latin only; if Hebrew Frank Ruhl glyphs miss, body font (Noto Sans Hebrew) handles it.
- Mono uppercase eyebrows in Hebrew: uppercase is a no-op in Hebrew, so the eyebrow style is fine — but verify visual weight at first render.

---

## 7. Accessibility checklist (must pass before merge)

- [ ] Contrast: ink (#0F1E2D) on paper (#FAFAF7) → ~16:1 ✓. cream (#F4EEE0) on ink → ~14:1 ✓. ember on cream → verify ≥4.5:1 (will be marginal; restrict ember to ≥18px or bold).
- [ ] Focus visible on every interactive element (ember/35 ring).
- [ ] Tab order matches reading order in both LTR/RTL.
- [ ] Form labels associated with inputs (`htmlFor`).
- [ ] Modal traps focus, ESC closes, `aria-modal="true"`.
- [ ] `prefers-reduced-motion`: all View Transitions disabled.
- [ ] Lighthouse a11y score ≥ 95 on Home, Login, Requests, Directory.

Run via `chrome-devtools:a11y-debugging` skill after first integration.

---

## 8. Performance budget

- LCP ≤ 2.5s on cable. Hero logo preloaded (`<link rel="preload" as="image">`).
- Fonts: zero new font downloads — mono uses system stack. Display + body fonts already loaded.
- No new client-side JS dependencies. Net bundle delta target: 0 ±5KB gz.
- Verify after first build via `chrome-devtools:debug-optimize-lcp`.

---

## 9. Implementation phasing (for plan)

1. **Phase 1 — tokens & primitives.** Edit `tailwind.config.js`, add `frontend/src/components/ui/` primitives, add fonts. No screen edits yet. Site still renders with old screens on new tokens (gracefully degraded).
2. **Phase 2 — Navbar, Footer, PageHeader, Modal, Toast, StatusBadge.** Global chrome restyled. Now every screen inherits the new look.
3. **Phase 3 — HomePage + LoginPage + RegisterPage.** Marketing surface.
4. **Phase 4 — RequestsPage (UC-01) + MyRequestsPage.** Care: do not regress the form behavior. Manual smoke test the full submit flow per language.
5. **Phase 5 — DirectoryPage + VolunteerPage.** Plus DataList primitive.
6. **Phase 6 — View Transitions on route change + filter reorder.**
7. **Phase 7 — A11y pass + LCP pass + cleanup duplicates (`Formelements.jsx`, `Stepindicator.jsx`).**

Each phase ends with: build, manual HE/EN smoke, screenshot, commit.

---

## 10. Risks

- **R1** — Frank Ruhl Libre Hebrew glyphs at small sizes. Mitigation: fallback to Noto Sans Hebrew for body; serif only on display sizes ≥1.5rem.
- **R2** — Ember on cream contrast for small text. Mitigation: lint rule — ember text only on `text-lg`+ or bold.
- **R3** — Conflict with concurrent UC PRs landing on main. Mitigation: rebase nightly; lock branch to redesign-only files; Tailwind config merge handled by author manually.
- **R4** — Demo deadline pressure. Mitigation: Phases 1–4 unblock the demo even if 5–7 slip. UC functionality is preserved at every phase boundary.

---

## 11. Open questions for user

None blocking. Recommended defaults applied throughout. The phased plan in §9 is what `writing-plans` will turn into a task list.

---

## 12. Acceptance

Spec is accepted when the user replies "approved" (or equivalent) in the next turn. On approval, hand off to `superpowers:writing-plans` to produce the phased implementation plan.
