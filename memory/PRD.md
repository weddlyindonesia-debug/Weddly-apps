# Weddly — Product Requirements & Progress

## Original Problem Statement
Weddly is a wedding-planning SaaS for Indonesian couples. Users purchase access on Lynk (external), receive a unique access token (WDL-XXXX-XXXX-XXXX), sign in with Google (Emergent-managed), and redeem the token to activate one **shared Wedding Workspace** (max 2 partners). Both partners collaborate on checklist, budget (IDR), guests, vendors, timeline, and Weddly AI chat.

## Personas
- **Partner 1 / Partner 2** — the couple. Equal permissions. Shared workspace.
- **Admin (weddlyindonesia@gmail.com)** — generates access tokens.

## Core Requirements (static)
- Google OAuth (Emergent-managed) auth
- One token = one wedding workspace, max 2 active members
- Atomic race-safe token activation (no duplicate weddings, no 3rd member)
- Multi-tenant isolation: every wedding-scoped query gated by membership
- IDR currency, Indonesian ceremonies (Akad, Resepsi, Sangjit, Tea Pai, Pemberkatan, Siraman)
- 10-step setup wizard with autosave & back nav
- 8 dynamic themes (shared per workspace)
- Empty states, loading states, mobile responsive

## Architecture
- **Backend** FastAPI + Motor MongoDB. Single file `/app/backend/server.py` (~1030 LOC). All routes under `/api`. Auth via `session_token` cookie or Bearer.
- **Frontend** React 19 + React Router 7 + shadcn/ui + Tailwind. Theme via `data-theme` attribute on `<html>` with CSS vars.
- **AI** `emergentintegrations.LlmChat` streaming (Claude Sonnet 4.6 default, Gemini 3 Flash optional). EMERGENT_LLM_KEY in backend .env.

## Implemented (Feb 2026)
- Google OAuth (Emergent) + session cookies + `/api/auth/me`, `/api/auth/logout`
- Admin token generator (`ADMIN_API_KEY` or admin email), token listing
- Sandbox demo token `WDL-DEMO-2026-LOVE` (auto-seeded)
- Token activation with atomic race-safe partner1 claim, partner2 join, 3rd-user rejection, idempotent re-activation
- 10-step Setup Wizard with autosave
- Dashboard (countdown, progress, this-week, budget, guests, vendors, upcoming)
- Checklist CRUD + auto-seeded 20-task template based on wedding date & completed items (idempotent)
- Budget CRUD (IDR), totals, negative validation, default 13 categories
- Guest CRUD with RSVP counts
- Vendor CRUD with booking status
- Timeline CRUD
- Weddly AI chat with model switcher (Claude 4.6 / Gemini 3 Flash), streaming, wedding context injection
- Settings: profile, theme switcher (8 palettes), partners, license
- Admin page for token generation

## Testing
- iteration_1: 33/36 passed → fixed ObjectId serialization in activation
- iteration_2: 9/9 targeted retests passed (100% backend)

## Backlog (P1)
- Partner invite email/WhatsApp share flow
- Activity feed ("Sarah completed X")
- Notifications engine
- PDF export for rundown

## P2
- Vendor marketplace
- Guest attendance matrix per ceremony
- Chart visualisations on budget/dashboard
- Notification preferences

## Files
- `/app/backend/server.py`
- `/app/frontend/src/App.js` — router + auth gates
- `/app/frontend/src/pages/*` — Login, AuthCallback, Activate, Setup, Dashboard, Checklist, Budget, Guests, Vendors, Timeline, AI, Settings, Admin
- `/app/frontend/src/components/app/AppShell.jsx` — sidebar + mobile bottom nav
- `/app/frontend/src/context/AuthContext.jsx`
- `/app/frontend/src/lib/themes.js` — 8-theme applier
- `/app/frontend/src/index.css` — theme CSS vars for all 8 palettes
