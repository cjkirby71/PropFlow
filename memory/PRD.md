# PropFlow CRM — PRD

## Product goal
Full-stack residential-leasing CRM that matches or exceeds FollowUpBoss. Stack: React 19 + FastAPI + MongoDB. Stylistic direction: teal/amber/emerald palette, dark mode, premium shadows.

## Phases completed
1–8. Foundation: Contacts / Deals / Properties / Tasks / Templates / Sequences / AI / Webhooks / Activities / Global search / RBAC / Testing.
10. Pipeline: multi-pipeline, custom stages, drag-and-drop.
11. Dashboard (FUB-parity): Top KPIs, sparklines, Recent Activity.
12. Global UI/UX polish: Teal/Amber/Emerald palette, dark mode, Shadcn overrides.
13. Contacts (FUB-parity): Smart lists, bulk actions, leasing columns.
14. Unified Inbox: Email + SMS + voicemail, threads, draft auto-save, Brevo/Twilio.
15. Tasks (FUB-parity): Today/Overdue/Future tabs, leasing task types, bulk ops, complete+log.
16. Dark-mode contrast fix for Calendar.
17. Admin / Settings (FUB-parity): 9-tab layout, org_settings (company, lead-flow, renewals, custom fields, tags, maintenance types).
18. **Reporting / Analytics** (FUB-parity) — 10 tabs including **Anonymous Network Benchmarks** (Austin metro, university-zone aware). Date range picker, CSV export, help dialog.

## Current architecture
- `/app/backend/server.py`: all endpoints (to be split later).
- `/app/frontend/src/pages/`: page components (Analytics, Tasks, Settings, Inbox, Contacts, ContactDetail, Dashboard, Pipeline, Calendar, Templates, Sequences, Properties).
- `/app/frontend/src/hooks/useApi.js`: TanStack-Query hooks.

## Backlog (P1)
- Activate Brevo / Twilio / Google Calendar with user-supplied keys.
- IDX / Lead Source webhooks (`/api/webhooks/idx`).
- Commission tracker (splits, payouts, ledger).
- Document management (contract upload + e-sign).
- Showing scheduler (tour bookings + availability slots).
- Benchmarks opt-in & actual cross-org aggregation (currently peer snapshot).

## Backlog (P2)
- Transaction checklist (closing workflow per deal).
- Client portal (buyers/sellers shared view).
- AI enhancements (conversational assistant, predictive lead scoring, auto-reply, transcript summary).

## Backlog (P3)
- PWA / offline / push notifications.
- Refactor: split `server.py` into `/app/backend/routes/*`, `/app/backend/models/*`, add `/app/backend/tests/*`.
- Split `ContactsPage.js` into sub-components (SmartListSidebar, BulkActionsBar, ContactsTable).

## Test credentials
See `/app/memory/test_credentials.md`.
