# Frontend (Next.js)

The web client for the **Push for Fulfillment** platform.

- **Framework:** Next.js 14 (Pages Router)
- **Language:** TypeScript (with .jsx allowed during the port)
- **Styling:** Tailwind CSS 3
- **State:** local React Context (`LanguageContext`, `AppContext`)
- **i18n:** Hebrew (default, RTL) + English (LTR) — see `src/data/translations.js`

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in Firebase web SDK values
npm run dev
```

Dev server runs on `http://localhost:3000`. The backend (Express) is expected at the URL set in `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001`).

## Routes (Pages Router)

| Path | Source |
|---|---|
| `/` | `src/screens/HomePage.jsx` |
| `/requests` | `src/screens/RequestsPage.jsx` (Smart Request Form — UC-01) |
| `/directory` | `src/screens/DirectoryPage.jsx` (UC-02 / UC-03) |
| `/volunteer` | `src/screens/VolunteerPage.jsx` |
| `/404` | `pages/404.tsx` |

Each top-level `pages/<route>.tsx` is a thin wrapper that imports its implementation from `src/screens/`. This keeps the route surface readable and lets the team grow each screen independently.

## Layout

```
frontend/
├── pages/                 # Next.js route entry points (thin)
│   ├── _app.tsx           # Wraps every page with LanguageProvider + AppProvider + chrome
│   ├── _document.tsx      # HTML shell, font preconnect
│   ├── index.tsx          # → /
│   ├── requests.tsx       # → /requests
│   ├── directory.tsx      # → /directory
│   ├── volunteer.tsx      # → /volunteer
│   └── 404.tsx
├── src/
│   ├── components/        # Navbar, Footer, Modal, Toast, StatCard, ...
│   ├── contexts/          # LanguageContext, AppContext
│   ├── data/              # translations.js, mockData.js, constants.js
│   ├── hooks/             # useForm, useLanguage
│   ├── screens/           # Page implementations (ported from prototype)
│   ├── styles/globals.css # Tailwind + design tokens
│   └── utils/             # helpers, validators
├── public/                # Static assets
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── .env.example
```

## Conventions

- Bilingual strings live in `src/data/translations.js` and are read via the `useLanguage()` hook.
- All routing uses `next/link` and `next/router` — no `react-router-dom`.
- Reach the backend with `fetch(\`${process.env.NEXT_PUBLIC_API_BASE_URL}/...\`)`. Server-trusted writes go through Express; the Firebase client SDK is read-mostly + auth-only writes.
- The prototype came from Hamza's `hamzakaraky/development` repo. Screens are still `.jsx` to keep the diff small; convert to `.tsx` as each owner adds typing for their UC.
