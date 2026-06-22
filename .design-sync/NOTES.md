# design-sync notes — push-for-fulfillment-frontend → "Dkhefa Lhagshama"

This repo is a **Next.js application**, not a packaged design system. The sync runs the
package shape in **synth-entry mode** against a reproducible clean room. Project:
https://claude.ai/design/p/088739f7-c643-48ed-8c49-8800fd77f2d5

## How to (re)build + sync

1. `bash .design-sync/build-pkg.sh` — assembles the clean room. **Re-run before every build.**
   It builds `.ds-nm/push-for-fulfillment-frontend/` (a REAL dir) + scratch node_modules `.ds-nm/`,
   compiles Tailwind, flattens all CSS into `app.css`, swaps in the firebase stub, and regenerates the
   export barrel.
2. `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules .ds-nm --out ./ds-bundle`
3. `node .ds-sync/package-validate.mjs ./ds-bundle` (needs playwright chromium — installed at
   `~/Library/Caches/ms-playwright/chromium-1228`, playwright 1.61).
4. Author/iterate previews in `.design-sync/previews/`; rebuild scoped with
   `node .ds-sync/lib/preview-rebuild.mjs --config .design-sync/config.json --node-modules .ds-nm --out ./ds-bundle --components <Names>`
   then `node .ds-sync/package-capture.mjs --out ./ds-bundle --components <Names>`.

## Why each clean-room hack exists (don't remove without re-testing)

- **Clean room MUST be a real directory** (`.ds-nm/<pkg>`), NOT a symlink. With a symlink, esbuild
  resolves the context modules via two different paths (realpath via the synth entry vs symlink via the
  provider/barrel/`@/` imports) and ships **two instances of `LanguageContext`/`AppContext`** — then every
  component calling `useLanguage()`/`useApp()` renders blank. This was the single biggest gotcha.
- **`next/link` + `next/router` shims** (`clean-room/shims/`, wired via `clean-room/tsconfig.json` paths):
  the real `next/*` modules pull node-only internals (`fs`/`stream`/`zlib`) into the browser bundle.
- **`process` shim** (first extraEntry): the app reads `process.env.NEXT_PUBLIC_*` at module scope
  (firebase config, API base, even inside `CreateTaskDialog`). esbuild only defines `NODE_ENV`, so a global
  `process.env = {}` is injected before the bundle runs or the IIFE throws "process is not defined".
- **`lib/firebase.ts` → inert stub** (`clean-room/overrides/lib-firebase.ts`, copied over the real file each
  build): the real module calls `getAuth()` at import time and throws `auth/invalid-api-key` with no config,
  taking down the whole bundle.
- **`exports-barrel.ts`** (`clean-room/make-barrel.mjs`): 25 components are `export default`; `export *` (the
  synth entry) does NOT re-export defaults, so without the barrel they never land on `window.PfF`. The
  generator is regex-based — an **anonymous** default export won't be picked up (it prints `UNRESOLVED`).
- **Flat `app.css`**: `cssEntry` is copied verbatim into `_ds_bundle.css`, so it must be a single flat file
  (no external `@import`s except the remote Google-Fonts line). build-pkg.sh concatenates Tailwind + all
  `src/styles/*` into it.
- **Fonts** (Frank Ruhl Libre, Noto Sans Hebrew) load via a remote Google-Fonts `@import` → `[FONT_REMOTE]`
  (non-blocking). They are NOT shipped as files.
- **Providers**: `cfg.provider` = `LanguageProvider` (defaults to Hebrew → **RTL**) > `AppProvider`
  (`AppContext` uses `data/mockData`, no backend). Both merged via `extraEntries`.

## Render outcome (28/36 render real, 8 floor)

Floor cards (honest baseline — genuinely app-shell / auth / router / store / backend coupled; can be
authored later if wanted): **AdminGate, VolunteerGate, Navbar, AssetImage, CreateTaskDialog,
UserPickerDialog, ToastContainer, Reveal**. The other 28 render real content; 22 have authored multi-cell
previews under `.design-sync/previews/` (all graded good).

## Known render warns

- `[FONT_REMOTE]` for "Inter"/"Frank Ruhl Libre" — expected (remote font host).
- `[EXPORT_COLLISION]` for the 25 barrel names vs the synth set — expected/benign: the synth entry never
  binds those defaults, so the barrel's named bindings are what populate the global. Do not "fix" by renaming.

## Re-sync risks

- The clean-room swaps (firebase stub, next shims, process shim) are pinned to the app's CURRENT imports.
  New components importing other node-only modules, other `process.env.*`, or other firebase entry points
  will break the bundle — extend the shims/overrides in `.design-sync/clean-room/`.
- The remote project contains an app-generated `app/` dir (a design built ON the system — "Yad BYad") plus
  `_ds_manifest.json` / `_adherence.oxlintrc.json` / `.thumbnail`. These are NOT produced by this build —
  **never delete them**; reconciliation is scoped to `components/ _preview/ _vendor/ tokens/ fonts/ guidelines/` only.
- `tokens/` ships empty (the token scrape found no separate token file to split out; tokens live inline in
  `_ds_bundle.css` via `tokens.css`). Fine, but means the DS pane has no standalone token cards.
