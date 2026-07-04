# IEEE SBNU Event Creation Portal — MVP PRD

**Project:** IEEE SBNU Event Creation Platform
**Scope:** Event creation, approval workflow, membership hierarchy, role-based access
**Status:** Ready for development (approval rules to be finalized in dev with chair)
**Tech Stack:** Supabase (Postgres + Auth), Next.js, ImageKit, Google OAuth
**Timeline:** 3-4 weeks to MVP

---

## 1. Overview

A **gated event creation portal** where authorized members of IEEE branches (SBNU parent + SIGHT/WIE/CS/ITSS/SPS sub-branches) can create events, get them approved by branch/parent leadership, and publish.

**Domain:** `portal.ieeenirma.org` (single production domain with internal routing/feature flags)

**Not in MVP:** Public event listing, payment/ticketing, email system, work tracking

---

## 2. Organization Structure

### 2.1 Branch Hierarchy

```
IEEE SBNU (Parent)
├── IEEE SIGHT
├── IEEE WIE
├── IEEE CS
├── IEEE ITSS
└── IEEE SPS
```

- SBNU is the umbrella organization
- Sub-branches operate semi-independently but may need SBNU approval for certain event types
- Roles can be custom per branch (e.g., "WebMaster" in CS doesn't exist in SBNU)

### 2.2 Permission Hierarchy

**Four-tier access model:**

1. **Normal Member** — view-only access, no event creation
2. **Event Creator** — can create events in their assigned branch (must be explicitly granted by Admin/SuperAdmin)
3. **Admin** — branch-level leadership (Chair/Head)
   - Can create events in their branch
   - Can approve pending events in their branch
   - Can assign/revoke "Event Creator" status within their branch
   - Can promote/demote members (history tracked)
3. **SuperAdmin** — you + Vraj + Faculty Mentor
   - Can create events in any branch
   - Can approve/reject any event globally
   - Can override member roles in any branch
   - Full audit trail access

---

## 3. Core Features

### 3.1 Authentication

- **Method:** Google OAuth 2.0 (college email only — `@nirmauni.ac.in`)
- **Access Control:** Role-based (enforced via Supabase RLS policies)
- **Session Management:**
  - JWT-based, 1-hour access token
  - 7-day refresh token
  - Logout clears both
  - Concurrent sessions allowed (user can be logged in on multiple devices)
- **Public Access:** Unauthenticated users cannot access portal (authentication required)

### 3.2 Membership & Hierarchy Management

**Membership Tracking (Append-Only History):**
- Each member → can belong to multiple branches with different roles
- **Tracked fields per membership:**
  - `member_id` (identity)
  - `branch_id` (which branch)
  - `role_name` (custom per branch — e.g., "Event Creator", "WebMaster", "Admin")
  - `joined_date` (when they joined this branch)
  - `assigned_at` (when this specific role was assigned — append-only)
  - `ended_at` (null if active; filled when role ends/removed)
  - `assigned_by` (who granted this role)
  - `reason` (why the role change)

**This enables:**
- "Show me all roles this person held in CS" (for alumni records)
- "Who promoted this person and when"
- "Who was WebMaster in CS back in 2024?" (future recruitment)

**Role Assignment Workflow:**
- **Branch Admin** can assign/revoke roles to members **in their branch only**
- **SuperAdmin** can assign/revoke roles to anyone in any branch
- **Faculty Mentor + SuperAdmin** can remove even branch admins if needed

### 3.3 Event Creation

**Who Can Create:**
- Event Creator role (in their assigned branch)
- Admin (in their branch)
- SuperAdmin (in any branch)

**Event Fields:**
- Event name (required)
- Branch (required — which IEEE branch is running it)
- Description (required)
- Event date & time (required)
- Organizer email (required)
- Banner/poster image (required — uploaded to ImageKit, URL stored)
- Event type (optional, to be finalized: Workshop, Hackathon, Guest Lecture, Social, etc.)
- Capacity/seat limit (optional)
- Location or online meeting link (optional)

**Event Workflow States:**

```
1. Draft
   ↓
2. Submitted for Approval (pending_approval)
   ↓
3. Approved or Rejected
   ↓
4. Published (approved events only)
   ↓
5. Deleted (can happen at any stage)
```

**Creation Process:**
1. Member fills event form (all required fields)
2. Click "Save as Draft" → event goes to `draft` status
3. Creator or Admin can edit draft anytime
4. Click "Submit for Approval" → event moves to `pending_approval`
5. Branch/parent approver reviews and approves/rejects
6. If approved → event auto-publishes (status: `published`)
7. Creator/Admin can delete draft or published events

### 3.4 Approval Workflow

**Approval Rules (to be finalized with chair during development):**

Currently designed to support **two approval levels:**
- **Level 1:** Branch Admin approval (e.g., CS Admin approves CS events)
- **Level 2:** SBNU Admin approval (parent approval, if needed for certain event types)

**Flexible Configuration:**
- Event type determines approval path (e.g., Workshop may need only branch approval, Hackathon may need both)
- **This will be confirmed by chair and implemented in dev** — schema supports it, rules locked later

**Who Can Approve:**
- Branch Admin: approve events in their branch (both Level 1 and Level 2 if delegated)
- SBNU Admin: approve all events + act as fallback/escalation
- SuperAdmin: approve anything

### 3.5 Audit Trail

**Every action logged:**
- Event created by whom, when, which branch
- Status change (draft → pending → approved/rejected)
- Approved/rejected by whom, when
- Published by whom, when
- Deleted by whom, when, deleted_at timestamp
- Member role changes: who assigned, when, why, previous role

**Accessible to:**
- Event creator (view own events + changes)
- Branch Admin (view branch events + all member changes in branch)
- SuperAdmin (view everything)
- Faculty Mentor (via SuperAdmin, full transparency)

### 3.6 Media Management (ImageKit Integration)

- Event banner/poster uploaded via portal
- ImageKit handles storage + CDN delivery
- System stores:
  - `banner_url` (ImageKit public URL for display)
  - `banner_file_id` (ImageKit file ID for future updates/deletes)
- Faster load times via CDN

---

## 4. Data Model (Schema)

### Core Tables

**branches**
```sql
id (UUID, PK)
name (TEXT) — "IEEE SBNU", "IEEE SIGHT", etc.
slug (TEXT, UNIQUE) — "sbnu", "sight", "wie", "cs", "itss", "sps"
parent_id (UUID, FK, nullable) — points to parent branch if exists
description (TEXT, optional)
created_at (TIMESTAMP)
```

**members**
```sql
id (UUID, PK)
email (TEXT, UNIQUE) — Google OAuth email
name (TEXT)
created_at (TIMESTAMP)
```

**memberships** (Append-Only History)
```sql
id (UUID, PK)
member_id (UUID, FK)
branch_id (UUID, FK)
role_name (TEXT) — "Event Creator", "Admin", "WebMaster", etc.
joined_date (TIMESTAMP) — when they joined this branch
assigned_at (TIMESTAMP) — when this role was assigned (append-only)
ended_at (TIMESTAMP, nullable) — null if active; filled when removed
assigned_by (UUID, FK) — who gave this role
reason (TEXT, nullable) — reason for assignment/change
created_at (TIMESTAMP)
UNIQUE(member_id, branch_id, role_name, assigned_at)
```

**events**
```sql
id (UUID, PK)
branch_id (UUID, FK) — which branch created this
creator_id (UUID, FK) — who created it
approver_id (UUID, FK, nullable) — who approved it
approval_level (INT, nullable) — tracks if it needs multi-level approval

name (TEXT)
description (TEXT)
event_date (TIMESTAMP)
organizer_email (TEXT)
banner_url (TEXT) — ImageKit URL
banner_file_id (TEXT) — ImageKit file ID

event_type (TEXT, nullable) — to be finalized (Workshop, Hackathon, etc.)
capacity (INT, nullable)
location (TEXT, nullable)

status (TEXT) — draft | pending_approval | approved | published | deleted
created_at (TIMESTAMP)
submitted_at (TIMESTAMP, nullable)
approved_at (TIMESTAMP, nullable)
published_at (TIMESTAMP, nullable)
deleted_at (TIMESTAMP, nullable)
```

**event_audit_log**
```sql
id (UUID, PK)
event_id (UUID, FK)
action (TEXT) — created | submitted | approved | rejected | published | deleted
changed_by (UUID, FK)
details (JSONB, nullable) — what changed (from/to values)
timestamp (TIMESTAMP)
```

---

## 5. Access Control (Supabase RLS Policies)

**By Role:**

1. **Normal Member:** Can view (but not edit) events from their branch
2. **Event Creator:** Can create, edit, delete own drafts in assigned branch; can submit for approval
3. **Admin:** Can create events in branch; can view/approve pending events in branch; can revoke drafts; can manage member roles in branch
4. **SuperAdmin:** Can do everything everywhere

**RLS Policy Examples:**
```sql
-- Creator can edit/delete own drafts
CREATE POLICY "creator_manages_own_drafts" ON events
FOR UPDATE USING (
  creator_id = auth.uid() AND status = 'draft'
);

-- Admin can approve pending events in their branch
CREATE POLICY "admin_approves_own_branch" ON events
FOR UPDATE USING (
  status = 'pending_approval'
  AND branch_id IN (
    SELECT branch_id FROM memberships 
    WHERE member_id = auth.uid() 
    AND role_name IN ('Admin', 'SuperAdmin')
    AND ended_at IS NULL
  )
);

-- SuperAdmin can do anything
CREATE POLICY "superadmin_all_access" ON events
FOR ALL USING (
  auth.uid() IN (SELECT id FROM members WHERE email IN (
    'priyansh@nirmauni.ac.in',
    'vraj@nirmauni.ac.in',
    'faculty.mentor@nirmauni.ac.in'
  ))
);
```

---

## 6. API Design (Supabase Edge Functions / Next.js API Routes)

### Event Creation & Management

```
POST /api/events — create new event (draft)
PATCH /api/events/:id — update event (draft only)
POST /api/events/:id/submit — submit for approval
PATCH /api/events/:id/approve — approve event (admin/superadmin)
PATCH /api/events/:id/reject — reject event (admin/superadmin)
DELETE /api/events/:id — delete event (creator/admin/superadmin)
GET /api/events — list events (filtered by role/branch)
GET /api/events/:id — get event details
GET /api/events/:id/audit — get audit trail
```

### Membership & Role Management

```
GET /api/members — list members in my branch
GET /api/members/:id — member profile + role history
PATCH /api/members/:id/role — assign/revoke role (admin/superadmin)
GET /api/members/:id/history — full role history for alumni tracking
```

---

## 7. UI / Frontend (High Level)

**Pages:**
1. **Login** — Google OAuth redirect
2. **Dashboard** — list of events (drafts, pending, published) + quick stats
3. **Create Event** — form to fill in event details + ImageKit upload
4. **Event Detail** — view/edit event, see approval status, audit trail
5. **Approval Queue** — (Admin/SuperAdmin) list of pending events to review
6. **Members** — (Admin/SuperAdmin) manage members, view/change roles, see history
7. **Settings** — user profile, branch assignment, logout

**Key Interactions:**
- Event creator: Draft → Submit → Wait for approval
- Admin: Approves/rejects pending events
- SuperAdmin: Overrides anything, sees all branches
- All roles see full audit trail for their scope

---

## 8. Scope — What's NOT Included

- Public event listing page (next feature)
- Payment/ticketing system
- Email notifications (v2)
- Work tracking / points system
- Public registration

---

## 9. Development Roadmap

**Stage 1 (Setup & Schema):**
- [ ] Lock event categories + approval rules (with chair)
- [ ] Create staging Supabase project (separate from production)
- [ ] Deploy schema to staging Supabase with RLS policies
- [ ] Set up production Supabase project (empty, ready)
- [ ] Configure Google OAuth for both staging & production
- [ ] Set up Vercel project, connect GitHub repo
- [ ] Build login page (Google OAuth)

**Stage 2 (Core Features):**
- [ ] Build event creation form + ImageKit integration
- [ ] Implement draft/submit/approval workflow (backend + frontend)
- [ ] Build dashboard (list events by status)
- [ ] Implement Supabase RLS policies (test against staging DB)
- [ ] Build member role assignment UI

**Stage 3 (Admin Features & Testing):**
- [ ] Build approval queue (admin view)
- [ ] Build member management (view history, change roles)
- [ ] Build audit log viewer
- [ ] Test with staging Supabase (fake data)
- [ ] Vercel preview deployments on pull requests (automated testing)

**Stage 4 (Deploy & Handoff):**
- [ ] Final testing (merge to main → auto-deploys to `portal.ieeenirma.org`)
- [ ] User acceptance testing with select admins (production domain)
- [ ] Polish + bug fixes
- [ ] Document API + deployment process for future work

**Deployment Strategy:**
- All PRs: Vercel auto-creates preview deployment (against staging Supabase)
- Main branch: Auto-deploys to `portal.ieeenirma.org` (against production Supabase)
- Feature flags (env vars): Control what's live without re-deploying

---

## 10. Success Criteria (MVP)

- [ ] Authorized members can create events (draft)
- [ ] Members can submit drafts for approval
- [ ] Admins can review + approve/reject
- [ ] Approved events publish (no public listing yet, but status is published)
- [ ] Full audit trail logged
- [ ] Member role changes tracked historically
- [ ] ImageKit integration working (banner uploads)
- [ ] Role-based access enforced (RLS policies working)
- [ ] Zero unauthorized access (security tested)

---

## 11. Notes for Development

- **Event categories + approval rules** are placeholders — finalize with chair early in Week 1
- If approval rules change during dev, update in database (no code redeploy needed)
- Membership history is append-only by design — never overwrite, only add new records
- ImageKit: test CDN performance with staging
- Google OAuth: test with college email domain only (block non-university emails)

---

## Deployment

**Single Production Domain:** `portal.ieeenirma.org`

**Frontend Hosting:** Vercel (Next.js)
- Local dev: `localhost:3000`
- PR previews: Auto-generated Vercel preview deployments (for testing before merge)
- Production: `portal.ieeenirma.org` (main branch)

**Backend:** Supabase
- Staging database: Separate Supabase project (fake/test data)
- Production database: Main Supabase project (real data)
- Environment variables: `.env.local` (dev), `.env.production` (live)

**Auth:** Google OAuth via Supabase (same for both staging/prod, just different databases)

**Feature Gating (Internal Routing):**
- Use environment variables or feature flag logic to control which features are active
- Example: `NEXT_PUBLIC_APPROVAL_ENABLED=true/false`
- No separate staging subdomain; everything lives on `portal.ieeenirma.org` with internal controls

---

**Status:** Ready to build. Start Week 1 with chair conversation on event categories.
