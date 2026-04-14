# PropFlow CRM - Product Requirements Document

## Original Problem Statement
Build a CRM (similar to FollowUpBoss) for Residential Leasing and Commercial Sales/Leasing. Needs separate pipelines and workflows for each specialty. Should integrate with MaxClaw AI agent.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key (emergentintegrations)
- **Auth**: JWT (httpOnly cookies) + API Key auth for external agents
- **Database**: MongoDB (test_database)

## User Personas
1. **Real Estate Agent** - Primary user managing leads, deals, properties across residential and commercial
2. **Team Admin** - Manages team settings, API keys
3. **MaxClaw Agent** - External AI agent populating CRM via API

## Core Requirements
1. Contact/Lead Management with tags, source tracking, property type
2. Deal Pipeline with drag-and-drop (3 separate pipelines)
3. Task & Follow-up Reminders with due dates, priorities
4. Property Listings linked to deals
5. Activity/Communication Log (calls, emails, notes, meetings)
6. AI-powered email drafts, lead scoring, activity summaries
7. API key management for external agent integration
8. Dashboard with analytics and charts

## What's Been Implemented (2026-04-14)
- Full JWT auth (login, register, logout, refresh, admin seeding)
- Contact CRUD with search, filtering, tags
- Deal pipeline with 3 types: Residential Lease, Commercial Sale, Commercial Lease
- Drag-and-drop kanban board (@hello-pangea/dnd)
- Property listings CRUD
- Task management with priorities and due dates
- Activity logging on contacts
- AI email drafting (GPT-5.2)
- AI lead scoring (GPT-5.2)
- API key management for MaxClaw agent
- Dashboard with stats, charts (Recharts)
- Settings page with API documentation

## Pipeline Stages
- **Residential Lease**: New Lead → Contacted → Showing → Application → Lease Signed → Closed
- **Commercial Sale**: New Lead → Contacted → Tour → LOI → Due Diligence → Closing → Closed
- **Commercial Lease**: New Lead → Contacted → Tour → Proposal → Negotiation → Lease Signed → Closed

## Prioritized Backlog
### P0 (Implemented)
- Auth, Contacts, Deals, Pipeline, Properties, Tasks, Activities, AI, API Keys, Dashboard

### P1 (Next)
- Bulk import/export contacts (CSV)
- Email integration (send emails directly from CRM)
- Calendar view for tasks
- Deal stage automation (auto-create tasks when deal moves to new stage)
- Contact merge/dedup

### P2 (Future)
- Team/multi-user support
- Role-based access control
- Reporting/analytics export
- Webhook integration for real-time notifications
- Mobile-responsive improvements
- Document storage per deal/contact
