# FlowSync — Modern High-Velocity Engineering & Project Management

> Enterprise-grade project, sprint, and task management SaaS platform built with Next.js 15 App Router, React 19, Tailwind CSS, shadcn/ui, NextAuth v5, and Prisma ORM.  
> 📐 **Scalability & Engineering Standards:** See [ARCHITECTURE.md](file:///c:/Users/DELL/Desktop/TaskFlow/ARCHITECTURE.md) for time/space complexity budgets ($O(1)$/$O(\log N)$ first), noise-free UI design guidelines, and scaling protocols for millions of concurrent users.

---

## 🚀 Overview

**FlowSync** is designed for modern agile product, engineering, and design teams. It combines sprint roadmaps, kanban boards, task tracking, predictive SLA risk engines, team velocity analytics, and secure multi-tenant role-based access control into one unified, ultra-fast workspace.

---

## 🛠️ Architecture & Tech Stack Rationale

| Layer | Technology | Engineering Rationale |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Server-side rendering, streaming HTML, zero-bundle server components, and route handlers |
| **Frontend UI** | React 19 + shadcn/ui | Concurrent rendering, primitives for accessible design, zero layout shift (CLS = 0) |
| **Styling** | Tailwind CSS + CSS Variables | Rapid, consistent design system tokens, 60fps micro-animations (< 150ms ease-out) |
| **State & Sync** | Context API + Optimistic UI | Instantaneous perceived latency with automatic rollback on server error |
| **Authentication** | NextAuth (Auth.js v5) + bcryptjs | Secure JWT sessions, password hashing with salt rounds, multi-factor extensible |
| **ORM & Database** | Prisma ORM + PostgreSQL | Type-safe queries, indexed compound lookup paths, foreign key cascades, migration history |
| **Data Validation** | Zod 3 | Strict runtime schema parsing, fail-fast boundary validation, structured 400 envelopes |
| **Interactivity** | @dnd-kit (Core + Sortable) | Hardware-accelerated fluid drag-and-drop Kanban workflow |

---

## 🏛️ System Architecture

All business logic strictly lives in `src/api/` — decoupled from HTTP routing. Route files under `src/app/api/` serve as ultra-thin bridge re-exports satisfying Next.js App Router conventions:

```
[Client / Browser]
       │
       ▼
[Next.js App Router Bridge]  ──>  src/app/api/tasks/route.ts (2-line re-export)
       │
       ▼
[Canonical Business Logic]   ──>  src/api/tasks/route.ts
       ├── Zod Schema Parsing & Sanitization (`validators.ts`)
       ├── Role-Based Access Control (`permissions.ts`)
       ├── Activity & Notification Dispatcher (`activity.ts`)
       └── Prisma Singleton (`src/lib/prisma.ts`)
       │
       ▼
[Unified ApiResponse Envelope]
  {
    "success": true,
    "data": { ... },
    "meta": { "cursor": "...", "hasMore": false }
  }
```

---

## ✨ Full Feature Suite

### 1. Core Task & Sprint Management
- [x] **My Tasks**: Sortable, filterable list with full-text search, priority filtering, and status badges.
- [x] **Interactive Kanban Board**: 5 drag-and-drop workflow stages (Backlog, To Do, In Progress, In Review, Done) via `@dnd-kit`.
- [x] **Bulk Task Operations**: Multi-select toolbar for batch status changes, batch priority updates, and bulk deletions.
- [x] **Subtask Progress Engine**: Dynamic calculation of completion percentages on subtask toggles.
- [x] **Task Number Identifier**: Monospace human-readable identifiers (`TF-001`, `TF-002`) across all views.
- [x] **Task Detail Drawer**: Tabbed interface featuring real comments, activity changelog, subtasks, and metadata editing.

### 2. Enterprise Project Intelligence & Analytics
- [x] **Automated Project Health & SLA Risk Engine**: Heuristic calculating deadline risk, velocity forecast, and SLA breach warnings.
- [x] **Sprint Milestones & Roadmaps**: Relational milestone partitioning (`ProjectMilestone`) with completion tracking.
- [x] **Project Burndown & Velocity Engine**: Ideal burn slope calculation vs actual historical completion trajectories.
- [x] **Project Lifecycle State Machine**: Deterministic progression (`PLANNING` → `ACTIVE` → `PAUSED` → `COMPLETED` → `ARCHIVED`) with audited archival.
- [x] **Project-Scoped RBAC**: Enterprise access controls (`OWNER`, `LEAD`, `CONTRIBUTOR`, `VIEWER`).

### 3. Productivity & Workflows
- [x] **Global Command Palette**: Instant `Ctrl+K` / `Cmd+K` keyboard launcher for tasks, projects, and views with 200ms debounce.
- [x] **Calendar View**: Month grid view visualizing tasks on their scheduled due dates.
- [x] **Inbox & Notification Center**: Real-time assignment alerts, comment mentions, and bulk mark-as-read.
- [x] **Reports & CSV Export**: Real-time aggregation charts with one-click CSV export stream.
- [x] **Settings & Workspace**: Persisted profile configuration, password security with bcrypt, member directories, and notification preferences.

### 4. Resilient User Experience
- [x] **Zero Layout Shift Skeletons**: Tailored row, card, and metric skeletons matching exact DOM geometry.
- [x] **React Error Boundary**: Graceful fault isolation and in-place recovery UI.
- [x] **Zero Client Memory Leaks**: Full `AbortController` cancellation lifecycle across all reactive fetch hooks.
- [x] **Fully Responsive Mobile Layout**: Bottom-sheet dialogs, touch-optimized swipe cards, and mobile command palette button.

---

## 🏁 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/rasel1510/TaskFlow.git
cd TaskFlow
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/flowsync?schema=public"
AUTH_SECRET="super-secret-random-32-character-string"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Database Migration

```bash
npm run prisma:generate
npm run prisma:push
```

### 4. Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🧪 Production Verification

To test the production build with zero TypeScript or linting errors:

```bash
npm run build
npm start
```

---

## 📄 License

This project is licensed under the MIT License.
