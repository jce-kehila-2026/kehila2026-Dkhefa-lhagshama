# Building with the Dkhefa Lhagshama (Push for Fulfillment) design system

A warm, grounded, editorial system for an NGO that connects beneficiaries, volunteers, and businesses. Bilingual Hebrew/English, **right-to-left by default**.

## Wrapping and setup

Many components read the active language from React context. **Wrap any tree that uses them in `LanguageProvider`** (exported on the bundle global), and add `AppProvider` for components that read app state (e.g. `Modal`):

```jsx
<LanguageProvider>
  <AppProvider>
    {/* your screen */}
  </AppProvider>
</LanguageProvider>
```

`LanguageProvider` defaults to **Hebrew (`he`) → `dir="rtl"`**, so flex/grid rows align to the right and text reads right-to-left — this is correct, not a bug. Components that need a provider but don't get one throw "must be used inside …Provider" and render blank. Components that take only props (`StatusBadge`, `StatCard`, `EmptyState`, `Input`, `Select`, `Textarea`, the buttons) need no provider.

## The styling idiom

Two layers, both global (no CSS-in-JS, no required className prop):

**1. Semantic CSS classes** — style your own markup with these (they're in the bound stylesheet):
- Buttons: `btn` + a variant `btn-primary` (ink), `btn-ember`, `btn-navy`, `btn-outline`, `btn-ghost`, `btn-danger`; sizes `btn-sm`, `btn-lg`, `btn-full`.
- Badges: `badge` + a tone `badge-amber`, `badge-blue`, `badge-green`, `badge-red`, `badge-ember`, `badge-gray`; add `badge-dot` for the leading status dot.
- Form fields: `form-input`, `form-select`, `form-textarea`, `form-label`, `form-group`, `form-error`, `form-hint`.
- Surfaces: `card`, `stat-card`, `menu-popover`, `menu-item`.

**2. Design tokens** — CSS custom properties for everything else. Use `var(--token)`:
- Color: `--ink` `--ink-2` (text), `--paper` `--cream` `--white` (surfaces), `--ember` `--ember-soft` `--ember-700` (accent), `--sky` `--sky-2`, `--gray-50`…`--gray-800`; semantic `--success` `--danger` `--warning` `--info` (+ `-soft`).
- Type: `--font-serif` (Frank Ruhl Libre — headings/display); body is Noto Sans Hebrew. Sizes `--fs-hero` `--fs-display` `--fs-h2` `--fs-h3` `--fs-lede` `--fs-body` `--fs-sm` `--fs-xs`.
- Space: `--sp-1`(4px)…`--sp-9`(96px). Radius: `--radius-sm` `--radius` `--radius-lg` `--radius-xl`. Shadow: `--shadow-xs` `--shadow-sm` `--shadow` `--shadow-lg` `--shadow-xl`. Focus ring: `--ring`. Layout: `--maxw` (1120px), `--nav-h` (64px).

Prefer tokens over hard-coded values so output stays on-brand. The hues are locked — don't retune them.

## Where the truth lives

The bound `styles.css` (and the `_ds_bundle.css` it imports) defines every class and token above — read it before inventing styles. Each component ships a `.prompt.md` (usage) and `.d.ts` (props API); read those before composing a component.

## Idiomatic example

```jsx
<LanguageProvider>
  <AppProvider>
    <div style={{ display: 'grid', gap: 'var(--sp-4)', padding: 'var(--sp-5)', maxWidth: 540 }}>
      <StatCard label="Open requests" value="128" tone="info" hint="+12 this week" />
      <button className="btn btn-ember">Get involved</button>
    </div>
  </AppProvider>
</LanguageProvider>
```
