<div align="center">

# FlowSync

**Project and task management for modern teams: plan, track and ship work in one fast, focused workspace.**

[Live demo](https://flow-sync-ruby.vercel.app) · [Architecture guide](./ARCHITECTURE.md) · [Report an issue](https://github.com/rasel1510/TaskFlow/issues)

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=000)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=fff)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=fff)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?logo=vercel)

</div>

---

## Table of contents

1. [What is FlowSync?](#what-is-flowsync)
2. [Highlights](#highlights)
3. [Features](#features)
4. [Tech stack](#tech-stack)
5. [System architecture](#system-architecture)
6. [Data model](#data-model)
7. [API overview](#api-overview)
8. [Security](#security)
9. [Performance and scalability](#performance-and-scalability)
10. [Project structure](#project-structure)
11. [Getting started](#getting-started)
12. [Environment variables](#environment-variables)
13. [Scripts](#scripts)
14. [Deployment](#deployment)
15. [Roadmap](#roadmap)

---

## What is FlowSync?

FlowSync is a **multi-tenant SaaS application** for managing projects, tasks and teams, in the same category as Linear, Asana and ClickUp. A company signs up, creates its organization, invites teammates, and organizes work into projects. Each project has its own task table, Kanban board, timeline, chat channel and member list.

It is built as a **full-stack Next.js application**: React 19 on the front end, typed route handlers on the back end, PostgreSQL through Prisma, and deployment on Vercel.

**Who it is for:** product, engineering and operations teams that want one calm, fast place to plan work, see who is doing what, and know whether a project is on track.

---

## Highlights

| | |
|---|---|
| 🏢 **Multi-tenant by design** | Every organization's data is isolated by `teamId`. Access is checked on the server for every request. |
| 👥 **Role-based access** | Workspace roles (Admin, Project Manager, Member) plus per-project roles (Owner, Lead, Contributor, Viewer). |
| ✉️ **Email invitations** | Invite anyone to a project by email with Accept / Decline links. New users set up their account straight from the invite. |
| 📋 **Five ways to see work** | Task table, Kanban board, calendar, timeline (Gantt) and a personal "My Tasks" list. |
| 🧩 **Custom columns** | Projects can add their own text, number, date, checkbox and dropdown fields to tasks. |
| 💬 **Real-time project chat** | Per-project message channel streamed to clients with Server-Sent Events (SSE). |
| 🤖 **AI assistant + MCP server** | FlowAi turns plain language into tasks. A Model Context Protocol (JSON-RPC 2.0) endpoint lets external AI tools work with the workspace. |
| 💳 **Subscription billing** | Stripe Checkout and signed webhooks, with plan-based access to the app. |
| 📱 **Mobile-first and installable** | Responsive from 320px phones to desktops, with a bottom tab bar, swipeable tables and long-press drag. Installable as a Progressive Web App (PWA). |

---

## Features

### Work management
- **Projects** with health status, progress, start and due dates, and a lifecycle (Planning → Active → On Hold / Paused → Completed → Archived).
- **Project task table** grouped by due date, sortable by column, with inline task creation and custom columns. On phones the table swipes sideways with the task name pinned.
- **Kanban board** with five stages (Backlog, To Do, In Progress, In Review, Done) and drag-and-drop built on `@dnd-kit`. Touch screens use long-press to drag.
- **Calendar** (month, week and agenda views) and a **timeline / Gantt view** with grouping by project, status or assignee.
- **Task details:** status, priority, assignee, due and completion dates, time tracking, labels, threaded comments with @mentions, and a full activity history.
- **Bulk actions** to change the status or priority of many tasks at once, or delete them.

### Collaboration
- **Organization (team) workspace** with member directory and role management.
- **Project invitations by email:** the email names who invited you and to which project. Accepting creates the account if needed and opens the project.
- **Join requests:** members can ask to join projects they can see but don't belong to.
- **Project chat** with image attachments and live updates.
- **Inbox and notifications:** assignments, mentions, project activity and invitation responses, with per-user notification preferences.

### Insight
- **Dashboard** with workload, progress and upcoming deadlines.
- **Reports:** completion trend, cycle time, on-time rate, workload per member and project progress, with **CSV export** and print view.
- **Project health engine** that flags deadline risk from progress and overdue work.

### Productivity
- **Command palette** (`Ctrl/⌘ + K`) to search tasks and projects and jump between views.
- **FlowAi assistant** (`Ctrl/⌘ + J`): describe work in plain language and it creates or updates tasks through the same tools the MCP server exposes.

### Platform
- **Sign-up and sign-in** with email and password (with email verification codes) or Google OAuth, plus a forgot / reset password flow.
- **Onboarding:** create an organization, choose a plan, then pay with Stripe.
- **Billing page** with plan management and invoice history.
- **Super Admin console** for platform owners: companies, users, invoices and platform metrics.
- **Public API documentation** pages at `/docs` and `/developers`.

---

## Tech stack

| Layer | Technology | Why it was chosen |
|---|---|---|
| Framework | **Next.js 15** (App Router) | One codebase for UI and API, file-based routing, server rendering and edge middleware |
| UI | **React 19**, **Tailwind CSS 4**, Radix UI / shadcn-style primitives, `lucide-react` | Accessible building blocks and a consistent design system |
| Interaction | `@dnd-kit` (drag and drop), Recharts (charts), GSAP / anime.js (landing page motion) | Smooth, touch-friendly interactions |
| Language | **TypeScript 5** (strict) | End-to-end type safety from database to UI |
| Auth | **Auth.js (NextAuth v5)**: credentials + Google, JWT sessions, `bcryptjs` | Standard, secure session handling without a separate auth service |
| Database | **PostgreSQL** on **Neon** (serverless) | Managed Postgres with connection pooling for serverless functions |
| ORM | **Prisma 6** | Type-safe queries, schema-as-code, generated client |
| Validation | **Zod 4** | Every request body is validated at the API boundary |
| Cache | **Redis** (`ioredis`, optional) with an in-memory fallback | Cuts repeated reads; works without Redis in development |
| Payments | **Stripe** (Checkout + signed webhooks) | Subscription billing |
| Email | **Nodemailer** (SMTP) | Invitations, verification codes and password resets |
| AI | **OpenRouter** chat completions + a custom **MCP** (JSON-RPC 2.0) server | Model-agnostic AI that acts through audited, tenant-scoped tools |
| Hosting | **Vercel** | Preview deployments per branch, production from `main` |

---

## System architecture

### High-level view

```mermaid
flowchart LR
    U["Browser / installed PWA<br/>React 19 client"] -->|HTTPS| MW["Edge middleware<br/>route protection"]
    MW --> APP["Next.js App Router<br/>pages and views"]
    U -->|fetch JSON| BR["API bridges<br/>src/app/api/*"]
    BR --> API["Business logic<br/>src/api/*"]
    API --> AUTH["Auth.js<br/>sessions and RBAC"]
    API --> VAL["Zod validators"]
    API --> PRISMA["Prisma client"]
    PRISMA --> DB[("PostgreSQL<br/>Neon")]
    API --> CACHE[("Redis or<br/>in-memory cache")]
    API --> MAIL["SMTP email"]
    API --> STRIPE["Stripe API"]
    STRIPE -->|signed webhook| BR
    API --> LLM["OpenRouter LLM"]
    EXT["External AI clients"] -->|JSON-RPC 2.0| MCP["MCP endpoint<br/>/api/mcp"]
    MCP --> API
```

### Layered API design

All business logic lives in **`src/api/`** and is independent of the routing framework. The files under **`src/app/api/`** are thin bridges that only re-export handlers, because Next.js requires route files to live there:

```ts
// src/app/api/tasks/route.ts: the whole file
export { GET, POST } from '@/api/tasks/route';
```

```
Request
  └─ src/app/api/**/route.ts      bridge (re-export only)
       └─ src/api/**/route.ts     authentication, authorization, validation, business rules
            ├─ src/lib/access.ts      requireUser / requireProjectAccess / canManageProject
            ├─ src/lib/validators.ts  Zod schemas
            ├─ src/lib/activity.ts    activity log + notifications
            ├─ src/lib/redis.ts       cache (Redis or in-memory L1)
            └─ src/lib/prisma.ts      Prisma singleton → PostgreSQL
```

Handlers return a consistent envelope so the client handles every response the same way:

```ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: { nextCursor?: string | null; hasMore?: boolean; totalCount?: number };
}
```

### Request lifecycle: creating a task

```mermaid
sequenceDiagram
    participant C as Client (optimistic UI)
    participant A as /api/tasks (POST)
    participant G as Access guard
    participant Z as Zod schema
    participant P as Prisma / Postgres
    participant N as Activity + notifications
    C->>C: Show the task immediately (optimistic)
    C->>A: POST task payload
    A->>G: requireUser() + requireProjectAccess()
    G-->>A: user, project role
    A->>Z: Validate body (incl. custom fields)
    Z-->>A: Typed, sanitized input
    A->>P: Insert task (selected fields only)
    A->>N: Log activity, notify assignee
    A->>A: Invalidate affected cache keys
    A-->>C: 201 { success, data }
    C->>C: Swap in server data (or roll back + toast on error)
```

### Real-time and AI

- **Project chat** writes messages to Postgres and pushes them to connected clients over **Server-Sent Events** (`/api/projects/:id/messages/stream`).
- **FlowAi** (`/api/copilot`) sends the user's request to an LLM through OpenRouter. The model can only act through **typed MCP tools** (`create_task`, `list_tasks`, `update_task`, `batch_create_tasks`, `list_projects`, `get_workspace_summary`). Each tool runs with the signed-in user's permissions and tenant.
- The same tools are exposed at **`/api/mcp`** as a JSON-RPC 2.0 MCP server, so other AI clients can read and manage work the same way.

---

## Data model

19 Prisma models / enums. The core relationships:

```mermaid
erDiagram
    TEAM ||--o{ USER : "has members"
    TEAM ||--o{ PROJECT : owns
    TEAM ||--o{ TEAM_INVITATION : sends
    USER ||--o{ PROJECT : "owns (owner)"
    USER ||--o{ PROJECT_MEMBER : joins
    PROJECT ||--o{ PROJECT_MEMBER : has
    PROJECT ||--o{ TASK : contains
    PROJECT ||--o{ PROJECT_INVITATION : "invites by email"
    PROJECT ||--o{ PROJECT_JOIN_REQUEST : receives
    PROJECT ||--o{ PROJECT_MESSAGE : "chat"
    USER ||--o{ TASK : "assigned / created"
    TASK ||--o{ COMMENT : has
    TASK ||--o{ ACTIVITY : logs
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ INVOICE : billed
```

| Model | Purpose |
|---|---|
| `Team` | The tenant (organization). Projects and users belong to one team. |
| `User` | Account, workspace role, plan / subscription state, notification preferences. |
| `Project` | Health, progress, lifecycle state, dates and **custom column definitions** (JSON). |
| `ProjectMember` | User ↔ project link with a project role (Owner, Lead, Contributor, Viewer). |
| `Task` | Status, priority, dates, time spent, labels and **custom field values** (JSON). Indexed for the main access paths. |
| `Comment`, `Activity` | Threaded discussion and an audit trail per task. |
| `ProjectInvitation`, `TeamInvitation` | Token-based invites with status (pending / accepted / declined / revoked) and expiry. |
| `ProjectJoinRequest` | Requests to join a project, approved by its managers. |
| `ProjectMessage` | Project chat history. |
| `Notification` | In-app inbox items. |
| `VerificationCode`, `Invoice` | Email verification codes and billing records. |

Compound indexes such as `@@index([projectId, status])` and `@@index([assigneeId, dueDate])` keep the hottest queries on indexed paths.

---

## API overview

43 route handlers, grouped by domain (full reference in the app at `/docs`):

| Domain | Endpoints | Highlights |
|---|---|---|
| **Auth** | `/api/auth/*` | Sign-up, email verification (OTP), resend code, forgot / reset password, Auth.js handlers |
| **Tasks** | `/api/tasks`, `/api/tasks/:id`, `/api/tasks/bulk`, `…/comments`, `…/activities` | Filtered lists, create / update / delete, bulk changes, comments, history |
| **Projects** | `/api/projects`, `/api/projects/:id`, `…/members`, `…/invitations`, `…/requests`, `…/messages`, `…/messages/stream`, `…/milestones` | Full project lifecycle, membership, email invites, join requests, chat (SSE) |
| **Team** | `/api/team/members`, `/api/team/invite`, `/api/invite/accept`, `/api/invite/decline` | Organization members, roles, invitation accept / decline |
| **Users** | `/api/users`, `/api/users/:id`, `/api/users/:id/password` | Profiles and password changes |
| **Insights** | `/api/reports`, `/api/reports/summary`, `/api/reports/export`, `/api/search` | Analytics, CSV export, global search |
| **Notifications** | `/api/notifications`, `/api/notifications/preferences` | Inbox, read state, preferences |
| **Billing** | `/api/billing`, `/api/webhooks/stripe`, `/api/organization/create` | Plans, Stripe Checkout, signed webhooks, onboarding |
| **AI** | `/api/copilot`, `/api/mcp` | FlowAi assistant and the MCP JSON-RPC server |
| **Admin** | `/api/admin/*` | Super Admin: companies, users, invoices, metrics |

---

## Security

- **Server-side authorization on every route.** `requireUser`, `requireProjectAccess`, `requireTaskAccess` and `canManageProject` (in `src/lib/access.ts`) decide access from the session, never from IDs sent by the client.
- **Tenant isolation:** queries are scoped to the caller's `teamId`. Search, export and AI tools are tenant-scoped too.
- **Validated input:** Zod schemas on every write, including the format of custom column IDs and values.
- **Passwords** hashed with bcrypt. Passwordless credential sign-in is blocked, and password rules are enforced for accounts created from invitations.
- **Invitation safety:** single-use tokens claimed inside a database transaction. The invited email must match the person accepting, existing accounts must prove their identity, and invites expire after 7 days.
- **Stripe webhooks** are verified with the signing secret. Secrets come only from environment variables.
- **Edge middleware** protects `/app` and `/onboarding`. Production responses send security headers, and mutable APIs send `Cache-Control: private, no-store`.
- **Least privilege:** a project role never grants workspace Admin, and Super Admin can't be granted from profile or team edits.

---

## Performance and scalability

Engineering rules are written down in [ARCHITECTURE.md](./ARCHITECTURE.md). In short:

- **Lowest-complexity algorithms first:** lookups use `Map` / `Set` (O(1)), with no nested `.find()` inside loops.
- **Lean queries:** explicit Prisma `select` projections (no `SELECT *`), indexed access paths, and no N+1 queries.
- **Bounded memory:** list endpoints are paginated and exports are streamed.
- **Caching:** Redis when configured, otherwise a short-lived in-memory L1 cache, invalidated by key pattern on writes.
- **Serverless-ready:** Neon pooled connections and a single Prisma client instance.
- **Fast-feeling UI:** optimistic updates with rollback, skeleton loaders shaped like the final layout (no layout shift), and request de-duplication for shared data.
- **Mobile-first:** 16px form fields (no iOS zoom), 44px touch targets, safe-area insets, bottom sheets, and long-press drag on touch screens.

---

## Project structure

```
TaskFlow/
├── prisma/
│   └── schema.prisma            # Data model (PostgreSQL)
├── public/                      # Static assets, PWA manifest, service worker, icons
├── scripts/                     # Maintenance scripts (seeding, icon generation)
└── src/
    ├── app/                     # Next.js App Router
    │   ├── page.tsx, landing/   # Marketing landing page
    │   ├── app/                 # The signed-in application shell (/app)
    │   ├── auth/                # Login and sign-up
    │   ├── onboarding/          # Organization → plan → payment → success
    │   ├── invite/accept/       # Invitation accept / decline page
    │   ├── docs/, developers/   # Public API documentation
    │   └── api/                 # Route bridges (re-exports only)
    ├── api/                     # ⭐ All API business logic, grouped by domain
    │   └── services/            # Typed client-side service wrappers
    ├── views/                   # Feature screens: Dashboard, MyTasks, KanbanBoard, CalendarView,
    │                            #   TimelineView, Projects, ProjectDetail, TeamView, Reports,
    │                            #   Inbox, Settings, BillingView, SuperAdminView
    ├── components/              # Shared UI: Header, Sidebar, TaskDetail, modals, FlowAi, ui/ primitives
    ├── context/                 # React context (task state)
    ├── lib/                     # Server and shared logic: access control, validators, Prisma,
    │                            #   cache, mail, Stripe, tenant resolution, MCP server + tools,
    │                            #   project health and lifecycle engines
    ├── middleware/ + middleware.ts  # Edge route protection
    └── auth.ts                  # Auth.js configuration
```

---

## Getting started

### Prerequisites
- **Node.js 20+** and npm
- A **PostgreSQL** database (a free [Neon](https://neon.tech) project works well)

### 1. Clone and install

```bash
git clone https://github.com/rasel1510/TaskFlow.git
cd TaskFlow
npm install            # also runs `prisma generate`
```

### 2. Configure environment

Create `.env.local` in the project root (see [Environment variables](#environment-variables)). The minimum:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
AUTH_SECRET="a-long-random-string"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Create the database schema

```bash
npm run prisma:push:dev
```

### 4. Run

```bash
npm run dev
```

Open **http://localhost:3000**, create an account, then create your organization.

> Without SMTP settings, emails (verification codes, invitations) are logged to the server console in development instead of being sent.

---

## Environment variables

| Variable | Required | Purpose |
|---|:---:|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (pooled URL on Neon) |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | ✅ | Secret used to sign sessions |
| `NEXTAUTH_URL` / `AUTH_URL` | ✅ (local) | Base URL of the app |
| `AUTH_TRUST_HOST` | | Trust the host header behind proxies |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (or `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | | Google sign-in |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | prod | Outgoing email |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` | billing | Stripe Checkout and webhooks |
| `REDIS_URL` / `UPSTASH_REDIS_URL` | | Shared cache (falls back to in-memory) |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | AI | FlowAi assistant (default model `openai/gpt-4o-mini`) |
| `FLOWSYNC_API_TOKEN` | | Token for external MCP clients |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | | Public base URL used in emails (defaults to the Vercel production domain) |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run dev:clean` | Clear `.next` and start the dev server |
| `npm run build` | Production build (type-checks the app) |
| `npm start` | Serve the production build |
| `npm run prisma:push:dev` | Apply the Prisma schema using `.env.local` |
| `npm run prisma:studio:dev` | Open Prisma Studio against `.env.local` |
| `npm run db:migrate:dev` / `db:migrate:deploy` | Prisma migrations |

---

## Deployment

FlowSync is deployed on **Vercel** with a **Neon** PostgreSQL database:

1. Import the GitHub repository into Vercel.
2. Add the environment variables above in the Vercel project settings.
3. Point the Stripe webhook to `https://<your-domain>/api/webhooks/stripe`.
4. Pushes to `main` deploy to production. Other branches get preview deployments.

Live: **https://flow-sync-ruby.vercel.app**

---

## Roadmap

- File attachments on tasks (object storage)
- Moving in-memory pieces (reset tokens, chat broker, background queue) to shared storage for multi-instance scale
- Automated test suite (unit + end-to-end) in CI
- Fine-grained audit log export

---

## License

Released under the MIT License.
