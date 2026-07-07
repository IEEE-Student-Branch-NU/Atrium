# Atrium — Authentication & Authorization Documentation

> **Last Updated:** July 2026 | **Auth Library:** NextAuth.js v5 (Auth.js) | **Database:** Supabase (PostgreSQL)

This document is the definitive reference for how authentication and authorization work in the Atrium portal. It covers every file, every flow, and every security decision.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Decisions](#2-technology-decisions)
3. [File Map](#3-file-map)
4. [Authentication Flows](#4-authentication-flows)
5. [Middleware & Route Protection](#5-middleware--route-protection)
6. [Permission Engine](#6-permission-engine)
7. [SuperAdmin / Sudo Mode](#7-superadmin--sudo-mode)
8. [Security Considerations](#8-security-considerations)
9. [Environment Variables](#9-environment-variables)

---

## 1. Architecture Overview

```mermaid
graph TB
    subgraph Browser
        Login["/login Page"]
        Signup["/signup Page"]
        CompleteReg["/complete-registration"]
        Pending["/pending"]
        Rejected["/rejected"]
        Dashboard["/dashboard"]
    end

    subgraph "NextAuth.js v5"
        Google["Google OAuth Provider"]
        Creds["Credentials Provider<br/>(bcrypt)"]
        JWT["JWT Session Strategy"]
    end

    subgraph "Supabase PostgreSQL"
        Profiles["profiles table<br/>id, email, password_hash,<br/>status, ieee_membership_id"]
        Memberships["memberships table"]
        Positions["positions table"]
        Permissions["permissions table"]
        PosPerms["position_permissions"]
        PreApproved["pre_approved_members"]
    end

    subgraph "Middleware (Edge Runtime)"
        AuthCheck["Auth Check"]
        StatusGate["Status Gate"]
    end

    Login -->|"Continue with Google"| Google
    Login -->|"Email + Password"| Creds
    Signup -->|"Server Action"| Profiles
    Google -->|"OAuth callback"| JWT
    Creds -->|"bcrypt.compare"| JWT
    JWT --> AuthCheck
    AuthCheck --> StatusGate
    StatusGate -->|"approved"| Dashboard
    StatusGate -->|"no IEEE ID"| CompleteReg
    StatusGate -->|"pending"| Pending
    StatusGate -->|"rejected"| Rejected
    Memberships --> Positions
    Positions --> PosPerms
    PosPerms --> Permissions
```

**Key Principle:** NextAuth handles session management (JWT). Supabase is the database only — we use the **service role key** (admin client) for all DB access. No Supabase Auth, no RLS. This is intentional: NextAuth gives us full control over the auth flow while Supabase provides the PostgreSQL backend.

---

## 2. Technology Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| **Auth library** | NextAuth.js v5 (Auth.js) | Industry standard for Next.js. Handles OAuth, JWT, session management. Edge-compatible. |
| **Session strategy** | JWT (not database sessions) | Stateless, fast, works at the Edge for middleware. No session table needed. |
| **Password hashing** | bcrypt (12 rounds) | Battle-tested, slow-by-design, resistant to brute force. Cannot run at Edge — so Credentials provider lives in `auth.ts` (Node runtime only). |
| **OAuth provider** | Google (GCP) | All members have `@nirmauni.ac.in` Google Workspace accounts. The `hd` param locks it to this domain. |
| **Database access** | Supabase Admin Client (service role) | Bypasses RLS entirely. All access is server-side via Server Actions and API routes. The service role key is NEVER exposed to the browser. |
| **Domain restriction** | `@nirmauni.ac.in` only | Enforced at 3 levels: (1) Google OAuth `hd` param, (2) Email signup validation, (3) Middleware redirect. |
| **Registration gating** | `pending` → `approved` / `rejected` | Not every Nirma student should get portal access. Only IEEE members. An admin/MDO must approve after verifying the IEEE Membership ID. |

---

## 3. File Map

### Core Auth Files

| File | Runtime | Purpose |
|------|---------|---------|
| `src/auth.config.ts` | **Edge** | Google provider config, JWT/session callbacks. Importable in middleware (no Node.js deps). |
| `src/auth.ts` | **Node.js** | Adds Credentials provider (uses bcrypt). Exports `auth`, `signIn`, `signOut`, `handlers`. |
| `src/middleware.ts` | **Edge** | Entry point for Next.js middleware. Delegates to `authMiddleware`. |
| `src/utils/supabase/middleware.ts` | **Edge** | The actual middleware logic: auth checks, status-based routing. |

### Server Actions

| File | Purpose |
|------|---------|
| `src/app/auth/actions.ts` | All auth server actions: `signInWithGoogle`, `signInWithEmail`, `signUp`, `completeRegistration`, `signOut` |

### Auth Utility Files

| File | Purpose |
|------|---------|
| `src/utils/supabase/server.ts` | `createAdminClient()` — Supabase client with service role key |
| `src/utils/auth/permissions.ts` | Permission engine: `getUserPermissions`, `hasPermission`, `checkPermission`, `canApproveRegistrations` |
| `src/utils/auth/sudo.ts` | SuperAdmin sudo mode: JWT cookie for elevated access (`enableSudoMode`, `isSudoMode`, `disableSudoMode`) |

### Auth-Related Pages

| Route | File | Type | Purpose |
|-------|------|------|---------|
| `/login` | `src/app/login/page.tsx` + `login-form.tsx` | Client | Login with Google OAuth or email/password |
| `/signup` | `src/app/signup/page.tsx` | Client | Email/password registration with IEEE details |
| `/complete-registration` | `src/app/complete-registration/page.tsx` | Client | Google OAuth users fill in IEEE membership ID, branch, role |
| `/pending` | `src/app/pending/page.tsx` | Server | Waiting room for unapproved accounts |
| `/rejected` | `src/app/rejected/page.tsx` | Server | Shows rejection reason, contact info |
| `/sudo` | `src/app/sudo/page.tsx` + `actions.ts` | Client | SuperAdmin elevation via hashed email + passphrase |
| `/api/auth/[...nextauth]` | Auto-generated by NextAuth | API | OAuth callback endpoint |

### Edge vs Node.js Runtime Split

```mermaid
graph LR
    subgraph "Edge Runtime (Middleware)"
        AC["auth.config.ts<br/>Google Provider<br/>JWT/Session Callbacks"]
        MW["middleware.ts"]
        SMW["supabase/middleware.ts<br/>Route protection"]
    end

    subgraph "Node.js Runtime (Server Actions)"
        AT["auth.ts<br/>Credentials Provider<br/>+ bcrypt"]
        AA["auth/actions.ts<br/>signUp, signIn, signOut"]
    end

    MW --> SMW
    SMW -->|"imports"| AC
    AA -->|"imports"| AT
    AT -->|"merges"| AC

    style AC fill:#e8f4fd,stroke:#2196F3
    style MW fill:#e8f4fd,stroke:#2196F3
    style SMW fill:#e8f4fd,stroke:#2196F3
    style AT fill:#fff3e0,stroke:#FF9800
    style AA fill:#fff3e0,stroke:#FF9800
```

> **Why the split?** `bcrypt` is a native Node.js module that **cannot** run at the Edge. The middleware imports only `auth.config.ts` (Edge-safe), while Server Actions import `auth.ts` which adds the Credentials provider with bcrypt.

---

## 4. Authentication Flows

### 4.1 Google OAuth — Full Flow

```mermaid
flowchart TD
    A["User clicks<br/>Continue with Google"] --> B["signInWithGoogle()<br/>Server Action"]
    B --> C["Google Consent Screen<br/>(hd: nirmauni.ac.in)"]
    C --> D{"Email ends with<br/>@nirmauni.ac.in?"}
    D -->|"No"| E["Redirect to /login<br/>error=unauthorized_domain"]
    D -->|"Yes"| F{"Profile exists<br/>in Supabase?"}
    F -->|"Yes"| G["Use existing profile"]
    F -->|"No (First Time)"| H["INSERT new profile<br/>status = pending<br/>ieee_membership_id = NULL"]
    H --> G
    G --> I["JWT Callback<br/>Attach profileId, status,<br/>isMembershipComplete"]
    I --> J["Session Callback<br/>Expose on session object"]
    J --> K["Middleware Intercept"]
    K --> L{"Has IEEE<br/>Membership ID?"}
    L -->|"No"| M["/complete-registration"]
    L -->|"Yes"| N{"Profile Status?"}
    N -->|"pending"| O["/pending"]
    N -->|"rejected"| P["/rejected"]
    N -->|"approved"| Q["/ (Dashboard) ✅"]

    style A fill:#4285F4,color:#fff
    style E fill:#EA4335,color:#fff
    style Q fill:#34A853,color:#fff
    style M fill:#FBBC05,color:#000
    style O fill:#FBBC05,color:#000
    style P fill:#EA4335,color:#fff
```

### 4.2 Complete Registration (Google OAuth Users)

```mermaid
flowchart TD
    A["Google user lands on<br/>/complete-registration"] --> B["Fills form:<br/>IEEE ID, Branch, Role,<br/>Phone, Section"]
    B --> C["completeRegistration()<br/>Server Action"]
    C --> D{"Validate<br/>IEEE ID format<br/>(6-12 digits)?"}
    D -->|"Invalid"| E["Show error message"]
    D -->|"Valid"| F{"Validate phone<br/>+91 XXXXX XXXXX?"}
    F -->|"Invalid"| E
    F -->|"Yes / Empty"| G{"IEEE ID already<br/>registered?"}
    G -->|"Yes"| H["Error: ID already taken"]
    G -->|"No"| I{"Check<br/>pre_approved_members<br/>table"}
    I -->|"Found: Pre-Approved"| J["UPDATE profile:<br/>status = approved<br/>approved_at = now()"]
    I -->|"Not Found"| K["UPDATE profile:<br/>status = pending"]
    J --> L["Create membership<br/>(branch + position)"]
    K --> L
    L --> M{"Status?"}
    M -->|"approved"| N["Redirect to / ✅"]
    M -->|"pending"| O["Redirect to /pending ⏳"]

    style A fill:#4285F4,color:#fff
    style N fill:#34A853,color:#fff
    style O fill:#FBBC05,color:#000
    style E fill:#EA4335,color:#fff
    style H fill:#EA4335,color:#fff
```

### 4.3 Email/Password Signup — Full Flow

```mermaid
flowchart TD
    A["User fills signup form"] --> B["signUp() Server Action"]
    B --> C{"Validate all fields"}
    C -->|"Missing required"| ERR["Return error message"]
    C -->|"Valid"| D{"Email ends with<br/>@nirmauni.ac.in?"}
    D -->|"No"| ERR
    D -->|"Yes"| E{"Password >= 8 chars<br/>and matches confirm?"}
    E -->|"No"| ERR
    E -->|"Yes"| F{"IEEE ID format<br/>6-12 digits?"}
    F -->|"No"| ERR
    F -->|"Yes"| G{"Phone format<br/>+91 XXXXX XXXXX?"}
    G -->|"Invalid"| ERR
    G -->|"Valid / Empty"| H{"Email already<br/>exists?"}
    H -->|"Yes"| ERR2["Error: Account exists"]
    H -->|"No"| I{"IEEE ID already<br/>taken?"}
    I -->|"Yes"| ERR3["Error: ID registered"]
    I -->|"No"| J["bcrypt.hash(password, 12)"]
    J --> K{"Check<br/>pre_approved_members"}
    K -->|"Pre-Approved"| L["INSERT profile<br/>status = approved"]
    K -->|"Not Found"| M["INSERT profile<br/>status = pending"]
    L --> N["Create membership<br/>(branch + position)"]
    M --> N
    N --> O["Auto sign-in via<br/>Credentials provider"]
    O --> P{"Status?"}
    P -->|"approved"| Q["Redirect to / ✅"]
    P -->|"pending"| R["Redirect to /pending ⏳"]

    style A fill:#1a73e8,color:#fff
    style Q fill:#34A853,color:#fff
    style R fill:#FBBC05,color:#000
    style ERR fill:#EA4335,color:#fff
    style ERR2 fill:#EA4335,color:#fff
    style ERR3 fill:#EA4335,color:#fff
```

### 4.4 Email/Password Login

```mermaid
flowchart TD
    A["User fills email + password<br/>on login form"] --> B["signInWithEmail()<br/>Server Action"]
    B --> C["nextAuthSignIn('credentials')"]
    C --> D["Credentials Provider<br/>authorize()"]
    D --> E{"Email ends with<br/>@nirmauni.ac.in?"}
    E -->|"No"| F["Return null<br/>(auth fails)"]
    E -->|"Yes"| G["Fetch profile from<br/>Supabase by email"]
    G --> H{"Profile exists AND<br/>has password_hash?"}
    H -->|"No"| F
    H -->|"Yes"| I["bcrypt.compare()<br/>password vs hash"]
    I --> J{"Match?"}
    J -->|"No"| F
    J -->|"Yes"| K["Return user object<br/>(id, email, name, image)"]
    K --> L["JWT + Session callbacks"]
    L --> M["Middleware routing<br/>(same as Google flow)"]
    F --> N["Error: Invalid email<br/>or password"]

    style A fill:#1a73e8,color:#fff
    style K fill:#34A853,color:#fff
    style N fill:#EA4335,color:#fff
    style F fill:#EA4335,color:#fff
```

### 4.5 Sign Out

```mermaid
flowchart LR
    A["User clicks Sign Out"] --> B["signOut() Server Action"]
    B --> C["nextAuthSignOut()"]
    C --> D["Clear JWT cookie"]
    D --> E["Redirect to /login"]

    style A fill:#1a73e8,color:#fff
    style E fill:#34A853,color:#fff
```

---

## 5. Middleware & Route Protection

### Route Categories

| Category | Routes | Auth Required | Approval Required |
|----------|--------|:------------:|:-----------------:|
| **Public** | `/login`, `/signup`, `/api/auth/*` | No | No |
| **Auth-Only** | `/pending`, `/rejected`, `/complete-registration` | Yes | No |
| **Protected** | `/` and everything else | Yes | Yes |

### Middleware Decision Tree

```mermaid
flowchart TD
    REQ["Incoming Request"] --> A{"Static asset?<br/>(_next, .svg, .png)"}
    A -->|"Yes"| PASS["Pass through ✅"]
    A -->|"No"| B{"Public route?<br/>/login, /signup, /api/auth"}
    B -->|"Yes"| C{"User logged in?"}
    C -->|"No"| PASS2["Show login/signup page"]
    C -->|"Yes — redirect away"| STATUS
    B -->|"No"| D{"Auth-only route?<br/>/pending, /rejected,<br/>/complete-registration"}
    D -->|"Yes"| E{"User logged in?"}
    E -->|"No"| LOGIN["Redirect to /login"]
    E -->|"Yes"| PASS3["Pass through<br/>(show pending/rejected)"]
    D -->|"No — Protected route"| F{"User logged in?"}
    F -->|"No"| LOGIN
    F -->|"Yes"| STATUS

    STATUS{"Check profile status<br/>from Supabase"}
    STATUS -->|"No IEEE ID"| COMP["/complete-registration"]
    STATUS -->|"pending"| PEND["/pending"]
    STATUS -->|"rejected"| REJ["/rejected"]
    STATUS -->|"approved"| DASHBOARD["Allow through ✅"]

    style REQ fill:#1a73e8,color:#fff
    style PASS fill:#34A853,color:#fff
    style PASS2 fill:#34A853,color:#fff
    style PASS3 fill:#34A853,color:#fff
    style DASHBOARD fill:#34A853,color:#fff
    style LOGIN fill:#EA4335,color:#fff
    style COMP fill:#FBBC05,color:#000
    style PEND fill:#FBBC05,color:#000
    style REJ fill:#EA4335,color:#fff
```

---

## 6. Permission Engine

### How Permissions Are Resolved

```mermaid
flowchart TD
    A["getUserPermissions(profileId, branchId)"] --> B{"Check sudo_mode<br/>cookie (JWT)"}
    B -->|"Valid sudo cookie"| C["Return ['*']<br/>All permissions"]
    B -->|"No sudo"| D["Query active memberships<br/>WHERE ended_at IS NULL"]
    D --> E["Get position_ids<br/>from memberships"]
    E --> F["Query position_permissions<br/>JOIN permissions"]
    F --> G["Collect permission names<br/>(position-based)"]
    G --> H["Query member_permissions<br/>WHERE revoked_at IS NULL"]
    H --> I["Collect permission names<br/>(direct grants)"]
    I --> J["Deduplicate<br/>Set union"]
    J --> K["Return string[]<br/>e.g. ['create_events',<br/>'view_members']"]

    style A fill:#1a73e8,color:#fff
    style C fill:#FF9800,color:#fff
    style K fill:#34A853,color:#fff
```

### Permission Resolution Data Flow

```mermaid
erDiagram
    profiles ||--o{ memberships : "profile_id"
    branches ||--o{ memberships : "branch_id"
    positions ||--o{ memberships : "position_id"
    positions ||--o{ position_permissions : "position_id"
    permissions ||--o{ position_permissions : "permission_id"
    profiles ||--o{ member_permissions : "profile_id (direct grants)"
    branches ||--o{ member_permissions : "branch_id"
    permissions ||--o{ member_permissions : "permission_id"
```

### Available Permissions

| Permission | Description |
|-----------|-------------|
| `create_events` | Create event drafts in a branch |
| `approve_events` | Approve or reject pending events |
| `manage_events` | Edit or delete any event in the branch |
| `manage_members` | Assign positions and grant permissions |
| `approve_registrations` | Approve or reject new member signups |
| `view_members` | View member list and role history |
| `view_audit_log` | Access the audit trail |
| `manage_event_types` | Add or edit event categories |
| `manage_positions` | Create custom positions for the branch |

### Usage Pattern

```typescript
import { getUserPermissions, hasPermission } from '@/utils/auth/permissions'
import { createAdminClient } from '@/utils/supabase/server'

const supabase = createAdminClient()
const perms = await getUserPermissions(supabase, profileId, branchId)

if (hasPermission(perms, 'approve_registrations')) {
  // show approval queue
}
```

---

## 7. SuperAdmin / Sudo Mode

### Sudo Elevation Flow

```mermaid
flowchart TD
    A["User navigates to /sudo"] --> B["Enters passphrase"]
    B --> C["elevateToSudo()<br/>Server Action"]
    C --> D["Fetch all rows from<br/>superadmins table"]
    D --> E["For each row:<br/>bcrypt.compare(user.email,<br/>hashed_email)"]
    E --> F{"Email match<br/>found?"}
    F -->|"No match"| G["Error: Invalid credentials"]
    F -->|"Match found"| H["bcrypt.compare(passphrase,<br/>passphrase_hash)"]
    H --> I{"Passphrase<br/>valid?"}
    I -->|"No"| G
    I -->|"Yes"| J["Sign JWT with<br/>AUTH_SECRET<br/>expiry: 2 hours"]
    J --> K["Set httpOnly cookie<br/>sudo_mode = JWT"]
    K --> L["Return success ✅<br/>All permissions unlocked"]

    style A fill:#1a73e8,color:#fff
    style G fill:#EA4335,color:#fff
    style L fill:#FF9800,color:#fff
```

### Why This Design?

```mermaid
graph LR
    subgraph "Traditional Approach ❌"
        ENV["ENV var with admin email"]
        DB_PLAIN["Plaintext email in DB"]
        ALWAYS["Always-on admin flag"]
    end

    subgraph "Atrium Approach ✅"
        BCRYPT["bcrypt-hashed email<br/>in superadmins table"]
        COOKIE["Time-limited JWT cookie<br/>(2 hour expiry)"]
        NO_ENV["Zero environment variables"]
        INVISIBLE["No frontend UI in main app"]
    end

    style ENV fill:#ffcdd2
    style DB_PLAIN fill:#ffcdd2
    style ALWAYS fill:#ffcdd2
    style BCRYPT fill:#c8e6c9
    style COOKIE fill:#c8e6c9
    style NO_ENV fill:#c8e6c9
    style INVISIBLE fill:#c8e6c9
```

- **No env vars** → Can't be leaked from Vercel dashboard
- **No plaintext emails** → Even DB admins can't see who the superadmins are
- **Time-limited** → Sudo cookie expires after 2 hours
- **Signed JWT** → Cannot be forged without the `AUTH_SECRET`

---

## 8. Registration Approval & Pre-Approval

### Approval Lifecycle

```mermaid
stateDiagram-v2
    [*] --> SignUp: User signs up
    SignUp --> CheckPreApproval: Validate fields

    state CheckPreApproval <<choice>>
    CheckPreApproval --> Approved: IEEE ID found in\npre_approved_members
    CheckPreApproval --> Pending: IEEE ID NOT\npre-approved

    Pending --> Approved: Admin/MDO approves
    Pending --> Rejected: Admin/MDO rejects

    Approved --> Dashboard: Access granted
    Rejected --> [*]: User sees rejection reason

    note right of Pending
        User sees /pending page
        with their submitted details
    end note

    note right of Approved
        approved_by and approved_at
        are set on the profile
    end note

    note left of Rejected
        rejected_reason is stored
        User can contact MDO
    end note
```

### Pre-Approval System

```mermaid
flowchart TD
    subgraph "MDO / Admin Setup"
        A["MDO adds IEEE IDs to<br/>pre_approved_members table"] --> B["Stores: ieee_membership_id,<br/>name, email (optional)"]
    end

    subgraph "User Signup"
        C["New user signs up<br/>with IEEE Membership ID"] --> D{"Query:<br/>SELECT FROM pre_approved_members<br/>WHERE ieee_membership_id = ?"}
        D -->|"FOUND"| E["Set status = 'approved'<br/>Set approved_at = now()<br/>Skip pending queue"]
        D -->|"NOT FOUND"| F["Set status = 'pending'<br/>Wait for manual approval"]
    end

    B -.->|"Pre-loaded IDs"| D

    E --> G["User goes straight<br/>to Dashboard ✅"]
    F --> H["User sees<br/>/pending page ⏳"]

    style A fill:#1a73e8,color:#fff
    style G fill:#34A853,color:#fff
    style H fill:#FBBC05,color:#000
```

### Manual Approval Flow (Admin/MDO)

```mermaid
sequenceDiagram
    participant U as New User
    participant App as Atrium App
    participant DB as Supabase DB
    participant Admin as Admin/MDO

    U->>App: Sign up with IEEE details
    App->>DB: INSERT profile (status: pending)
    App->>U: Redirect to /pending

    Note over U: User waits...

    Admin->>App: View /approvals page
    App->>DB: SELECT * FROM profiles WHERE status = 'pending'
    DB-->>App: List of pending users
    App-->>Admin: Show pending queue

    alt Approve
        Admin->>App: Click "Approve" on user
        App->>DB: UPDATE profiles SET status='approved',<br/>approved_by=admin_id, approved_at=now()
        Note over U: Next visit → middleware<br/>sees approved → Dashboard
    else Reject
        Admin->>App: Click "Reject" + enter reason
        App->>DB: UPDATE profiles SET status='rejected',<br/>rejected_reason='...'
        Note over U: Next visit → middleware<br/>sees rejected → /rejected page
    end
```

---

## 9. Security Considerations

| Threat | Mitigation |
|--------|------------|
| Non-Nirma users signing up | Domain check at 3 levels: Google OAuth `hd` param, signup validation, middleware |
| Brute force password attacks | bcrypt with 12 salt rounds (~250ms per hash) |
| Unauthorized portal access | Middleware checks `status = 'approved'` on every protected request |
| Session hijacking | JWT with `AUTH_SECRET`, httpOnly cookies, secure flag in production |
| SuperAdmin credential exposure | bcrypt-hashed in DB, no env vars, time-limited sudo cookie |
| Service role key exposure | Only used in server-side code (`createAdminClient`), never sent to browser |
| CSRF on server actions | Next.js Server Actions have built-in CSRF protection |
| Duplicate IEEE membership IDs | UNIQUE constraint in database + pre-insert check |

### Domain Enforcement — Triple Layer

```mermaid
flowchart LR
    A["Layer 1<br/>Google OAuth<br/>hd: nirmauni.ac.in"] --> B["Layer 2<br/>Server Action<br/>email.endsWith()"]
    B --> C["Layer 3<br/>Middleware<br/>status check"]

    style A fill:#4285F4,color:#fff
    style B fill:#34A853,color:#fff
    style C fill:#FBBC05,color:#000
```

---

## 10. Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `createAdminClient()` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `createAdminClient()` | Admin access (bypasses RLS) |
| `AUTH_SECRET` | NextAuth, sudo JWT | Signs JWT sessions and sudo cookies |
| `AUTH_GOOGLE_ID` | NextAuth Google provider | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | NextAuth Google provider | Google OAuth Client Secret |
| `BCRYPT_SALT_ROUNDS` | `signUp()` action | Password hashing cost (default: 12) |
| `NEXTAUTH_URL` | NextAuth | Canonical app URL for callbacks |
| `NEXT_PUBLIC_APP_URL` | Frontend | Public-facing app URL |

---

## Appendix: Database Tables Used by Auth

| Table | Auth Role |
|-------|-----------|
| `profiles` | Core identity: email, password_hash, status, ieee_membership_id, is_super_admin |
| `pre_approved_members` | Auto-approval whitelist: IEEE IDs that skip the pending queue |
| `superadmins` | bcrypt-hashed email + passphrase for sudo mode elevation |
| `memberships` | Links users to branches + positions (determines permissions) |
| `positions` | Branch-scoped titles (Chair, MDO, Technical Head, etc.) |
| `permissions` | Atomic actions (create_events, approve_registrations, etc.) |
| `position_permissions` | Maps positions → permissions |
| `member_permissions` | Direct ad-hoc permission grants to individuals |
