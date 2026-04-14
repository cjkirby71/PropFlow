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
- **CSV import/export** for bulk contact management
- Deal pipeline with 3 types: Residential Lease, Commercial Sale, Commercial Lease
- Drag-and-drop kanban board (@hello-pangea/dnd)
- **Deal stage automation** - auto-creates tasks when deals move stages
- Property listings CRUD
- Task management with priorities and due dates
- **Calendar view** for tasks with monthly grid and date selection
- Activity logging on contacts
- AI email drafting (GPT-5.2)
- AI lead scoring (GPT-5.2)
- **SendGrid email integration** (send directly from CRM, sender: craig@respaceteam.com)
- **Twilio SMS integration** (text leads from contact detail pages)
- API key management for MaxClaw agent
- **Webhook notifications** (real-time alerts on new leads, deal changes, emails/SMS)
- **Team management** with role-based access (admin/agent), invites
- Dashboard with stats, charts (Recharts)
- Settings page with 4 tabs: API Keys, Team, Webhooks, Integrations
- **Email/SMS Templates** with CRUD, AI generation, placeholder support, usage tracking
- Template picker in Send Email and Send SMS dialogs on contact detail pages

## Pipeline Stages
- **Residential Lease**: New Lead → Contacted → Showing → Application → Lease Signed → Closed
- **Commercial Sale**: New Lead → Contacted → Tour → LOI → Due Diligence → Closing → Closed
- **Commercial Lease**: New Lead → Contacted → Tour → Proposal → Negotiation → Lease Signed → Closed

## Prioritized Backlog
### P0 (Implemented)
- Auth, Contacts, Deals, Pipeline, Properties, Tasks, Activities, AI, API Keys, Dashboard
- CSV Import/Export, Email (SendGrid), SMS (Twilio), Calendar, Deal Automation, Team, Webhooks

### P1 (Next - Requires User API Keys)
- Configure SendGrid API key for live email sending
- Configure Twilio credentials for live SMS
- Contact merge/dedup tool
- Email templates (saved drafts)
- Bulk deal creation

### P2 (Future)
- Advanced reporting/analytics export
- Multi-team organization support
- Document storage per deal/contact
- Mobile-responsive improvements
- Webhook retry logic and delivery monitoring
