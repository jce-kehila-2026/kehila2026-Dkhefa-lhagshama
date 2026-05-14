# Push for Fulfillment – Community Platform

A bilingual (HE / EN) digital platform for **עמותת דחיפה להגשמה** (Push for Fulfillment NGO), which supports the Ethiopian-Israeli community in Israel. The platform consolidates assistance-request intake and case management, a catalog of community answers (NGOs, initiatives, and public bodies), and a directory of community-owned businesses — all governed by an admin backend for approvals and impact reporting.

## Team

| Name | Role | GitHub |
|---|---|---|
| Abdullah Abu Lafi | Lead · UC-05 Admin Approval | [@abdullahabulafi](https://github.com/abdullahabulafi) |
| Muhammad Marmash | UC-01 Submit Request | [@MuhammadMarmash](https://github.com/MuhammadMarmash) |
| Mhammad Siag | UC-04 Internal Chat | [@mhammadsiag](https://github.com/mhammadsiag) |
| Hamza Karaky | UC-02 + UC-03 Directories | [@hamzakaraky](https://github.com/hamzakaraky) |

## Tech Stack

- **Frontend:** React 18 + Next.js (Pages Router) + Tailwind CSS — `frontend/`
- **Backend:** Node.js + Express + Firebase Admin SDK — `backend/`
- **Auth:** Firebase Auth (Email/Password) with role-based custom claims
- **Data:** Firestore (`us-east1`) + Firebase Storage (`us-east1`)
- **Deploy:** Firebase Hosting (frontend) · Cloud Run or Vercel (backend — TBD)

## Repo Layout

```
kehila2026-Dkhefa-lhagshama/
├── frontend/      # Next.js + Tailwind app
├── backend/       # Node.js + Express + Firebase Admin SDK
├── docs/          # Internal engineering docs
└── .github/       # PR template, Actions workflows
```

## Quick Start

> Full setup instructions will be added after the backend scaffold is merged.

```bash
git clone https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama.git
cd kehila2026-Dkhefa-lhagshama

# frontend
cd frontend && npm install && npm run dev

# backend (separate terminal)
cd backend && npm install && npm run dev
```

## Non-Profit

- **Organization:** עמותת דחיפה להגשמה
- **Primary stakeholder:** TBD — role — email
- **Key deliverable:** Assistance-request intake + community answers catalog + business directory

## Wiki

Full documentation (overview, requirements, architecture, use cases, risks, test plan):  
https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/wiki

## License

MIT
