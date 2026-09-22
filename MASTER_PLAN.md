# TaskFlow — Full Development Master Plan
### Target: Expert Full-Stack Developer Hiring Submission
### Standard: Staff/Principal Engineer | Production-Grade | End-to-End Real Data

---

> **How to use this document:**
> Every phase is executable in order. Each step names the exact files to create or modify.
> When a step is completed, check it off. Never skip a step — each one is a dependency for the next.
> This document is the single source of truth for all development decisions.

---

## Current Completion Audit

### ✅ Phase 0: What You Have Already Done (Give Yourself Credit)

| # | What You Built | Quality |
|---|---|---|
| 1 | **Next.js 15 App Router project** with TypeScript, Tailwind CSS v4, shadcn/ui | ✅ Solid |
| 2 | **PostgreSQL + Prisma schema** — User, Project, Task, SubTask, Comment, Activity | ✅ Solid |
| 3 | **NextAuth v5 authentication** — JWT sessions, bcrypt password hashing | ✅ Solid |
| 4 | **User registration** (`POST /api/auth/signup`) — DB-first with local store fallback | ✅ Solid |
| 5 | **Route protection middleware** — unauthenticated → /auth/login, logged-in → / | ✅ Solid |
| 6 | **Bridge architecture** — src/app/api/ thin re-exports, all logic in src/api/ | ✅ Excellent |
| 7 | **Task CRUD API** — GET (filtered by user), POST (create), PATCH (update), DELETE | ✅ Working |
| 8 | **Project CRUD API** — GET (list), POST (create) | ✅ Working |
| 9 | **Users API** — GET (list all users for assignee dropdown) | ✅ Working |
| 10 | **TaskContext** — React Context with optimistic UI updates and rollback | ✅ Well-done |
| 11 | **My Tasks view** — list, status filter, full-text search, row selection, delete confirm | ✅ Working |
| 12 | **Kanban Board** — 5 columns (Backlog to Done) with real DB cards, search | ✅ Partial |
| 13 | **Task Detail drawer** — tabs (Details/Comments/Activity), Edit button, subtask progress | ✅ Partial |
| 14 | **Create Task modal** — title, project, assignee, status, priority, dueDate, estimate | ✅ Working |
| 15 | **Edit Task modal** — all fields, persists via PATCH | ✅ Working |
| 16 | **Dashboard** — stat cards, mini chart, recent tasks, upcoming deadlines | ✅ Partial |
| 17 | **Reports view** — KPI cards, bar chart, donut chart, team workload table | ✅ UI Only |
| 18 | **Projects view** — grid/list toggle, project cards, progress rings, health badges | ✅ UI Only |
| 19 | **Settings view** — Profile, Security, Members, Notifications, Integrations, Billing | ✅ UI Only |
| 20 | **Responsive layout** — collapsible sidebar, mobile drawer, adaptive header | ✅ Solid |
| 21 | **parseSafeDate guard** — dueDate year-range validation in POST and PATCH routes | ✅ Fixed |
| 22 | **Demo user fallback** — mock users authenticate without DB for demo mode | ✅ Working |

**Score: ~40% complete.** Architecture is excellent. Feature depth needs to go end-to-end.

---

## The Gap Analysis — What Is Fake or Stubbed

| Feature | Problem |
|---|---|
| Comments in TaskDetail | Hardcoded array — submit does nothing |
| Activity log in TaskDetail | Hardcoded array — never reflects real changes |
| Reports view | 100% mock data — no DB queries |
| Projects view | Reads from mockData.ts — no DB fetch |
| Dashboard | Mixes real task context and mock project/chart data |
| Kanban drag-and-drop | Not implemented — cards are read-only |
| Settings (all sections) | UI only — nothing persists to DB |
| Subtask toggle | Displayed but not persisted on toggle |
| Calendar view | Empty placeholder stub |
| Inbox / Notifications | Static fake list |
| Global search / Command palette | Not implemented |
| taskNumber in TaskDetail | Shows raw cuid, not TF-001 |
| API response envelope | Defined in ARCHITECTURE.md, never used |
| Zod validation | Not installed, raw typeof checks only |
| DB indexes | Missing from schema (required by ARCHITECTURE.md) |
| Cursor pagination | Full table scan on every GET /api/tasks |
| Toast notifications | No feedback system for success/error |

---

## PHASE 1 — Data Integrity and Architecture Foundation
### Goal: Make the API production-grade before adding features
### Duration: 2-3 days | Priority: Critical

---

### Step 1.1 — Add Zod Schema Validation

**Install:** `npm install zod`

**Create:** `src/lib/validators.ts`
- `CreateTaskSchema` — validates title, projectId, assigneeId, status enum, priority enum, dueDate, estimate, labels, description
- `UpdateTaskSchema` — all fields from CreateTaskSchema made `.partial()`
- `CreateProjectSchema` — validates name, description, ownerId, color, startDate, dueDate
- `SignupSchema` — validates name, email, password, role

**Modify:** `src/api/tasks/route.ts` — replace raw typeof checks with `CreateTaskSchema.safeParse(body)`

**Modify:** `src/api/tasks/[id]/route.ts` — replace whitelist loop with `UpdateTaskSchema.safeParse(body)`

**Modify:** `src/api/projects/route.ts` — add parseSafeDate guard to startDate + Zod validation

**Modify:** `src/api/auth/signup/route.ts` — add `SignupSchema.safeParse(body)`

Return structured 400 errors: `{ success: false, error: { code: 'VALIDATION_ERROR', details: zodError.flatten() } }`

---

### Step 1.2 — Implement Standard ApiResponse Envelope

**Modify:** `src/api/client.ts`
- Update apiClient methods to unwrap `{ success, data, error, meta }` envelope
- Throw typed errors when `success === false`

**Modify:** All API route handlers to return consistent envelopes:
- Success: `{ success: true, data: result, meta: { ... } }`
- Error: `{ success: false, error: { code: 'NOT_FOUND', message: '...' } }`

**Files to modify:** `src/api/tasks/route.ts`, `src/api/tasks/[id]/route.ts`, `src/api/projects/route.ts`, `src/api/auth/signup/route.ts`, `src/api/users/route.ts`

---

### Step 1.3 — Add Missing Database Indexes

**Modify:** `prisma/schema.prisma` — add compound indexes:

```
Task: @@index([assigneeId])
Task: @@index([projectId, status])
Task: @@index([assigneeId, dueDate])
Task: @@index([status])
Task: @@index([createdAt])
Comment: @@index([taskId])
Comment: @@index([userId])
Activity: @@index([taskId])
```

**Run:** `npm run prisma:push`

---

### Step 1.4 — Fix timeAgo Design Flaw

**Modify:** `prisma/schema.prisma`
- Remove `timeAgo String?` from both Comment and Activity models
- These must be computed at read time from `createdAt`, never stored as a string

**Create:** `src/lib/timeAgo.ts`
- `timeAgo(date: Date | string): string` — computes "2 hours ago", "just now", "3 days ago", etc.

**Run:** `npm run prisma:push`

---




### Step 1.5 — Cursor-Based Pagination on Tasks API

**Modify:** `src/api/tasks/route.ts` GET handler
- Accept `?limit=50&cursor=<cuid>` query params
- Use `take: limit + 1` and cursor-based `skip: 1` to determine `hasMore`
- Return: `{ success: true, data: items, meta: { hasMore, nextCursor, limit } }`
- Cap limit at 100 to prevent unbounded fetches

---

### Step 1.6 — Fix GET /api/projects Memory Issue

**Modify:** `src/api/projects/route.ts`
- Replace `include: { tasks: true }` with:
  - `owner: { select: { id, name, avatar, role, email } }`
  - `_count: { select: { tasks: true } }`
- This reduces a full task data fetch to a single COUNT per project

---

### Step 1.7 — Global Toast Notification System

**Create:** `src/components/ui/Toast.tsx`
- Global state managed via lightweight React Context
- `useToast()` hook exposing `toast.success()`, `toast.error()`, `toast.info()`
- `<ToastContainer />` — fixed bottom-right, renders toast queue
- Auto-dismiss after 4000ms with CSS ease-out slide animation
- Keyboard dismissable (Escape key)

**Modify:** `src/app/layout.tsx` — mount `<ToastContainer />` at root level

**Modify:** `src/context/TaskContext.tsx` — call toast on all CRUD operations

---

## PHASE 2 — Make Every Feature Real (End-to-End)
### Goal: Zero hardcoded data in any rendered view
### Duration: 4-5 days | Priority: High

---

### Step 2.1 — Real Comments System (Highest Interviewer Signal)

**Create:** `src/api/tasks/[id]/comments/route.ts`
- `GET /api/tasks/:id/comments` — list comments, include user (id, name, avatar), computed timeAgo
- `POST /api/tasks/:id/comments` — create comment (body: { text }), auto-increment task.commentsCount

**Create:** `src/app/api/tasks/[id]/comments/route.ts` (bridge — 2 lines only)

**Modify:** `src/components/TaskDetail.tsx`
- Remove hardcoded `comments` array at top of file
- On mount when `activeTab === 'comments'`: fetch `/api/tasks/${taskId}/comments`
- Render real comments with real user avatars and real timeAgo
- Comment submit: POST to API, optimistically prepend to list, refresh count badge

---

### Step 2.2 — Real Activity Log

**Create:** `src/lib/activity.ts` — server-side utility
- `logActivity(taskId, text, icon)` — creates Activity record in DB

**Modify:** `src/api/tasks/[id]/route.ts` PATCH handler
- After every successful update call `logActivity()` for each changed field:
  - Status change: "Status changed from Todo to In Progress" with icon
  - Assignee change: "Assigned to Sarah Chen"
  - Priority change: "Priority changed to High"
  - DueDate change: "Due date set to Oct 15, 2026"

**Create:** `src/api/tasks/[id]/activities/route.ts`
- `GET /api/tasks/:id/activities` — list activities with computed timeAgo, newest-first

**Create:** `src/app/api/tasks/[id]/activities/route.ts` (bridge)

**Modify:** `src/components/TaskDetail.tsx`
- Remove hardcoded `activity` array
- Fetch real activities when `activeTab === 'activity'`

---

### Step 2.3 — Real Projects View

**Modify:** `src/views/Projects.tsx`
- Remove `import { projects, ... } from '../data/mockData'`
- Add `useEffect` to fetch from `GET /api/projects`
- Show skeleton loader while fetching
- Wire "New Project" button to a CreateProjectModal

**Create:** `src/components/CreateProjectModal.tsx`
- Fields: Name, Description, Color picker (6 preset colors), Due Date
- On submit: POST /api/projects with ownerId = session.user.id
- On success: toast + refresh project list

---

### Step 2.4 — Real Dashboard

**Create:** `src/api/reports/route.ts`
- `GET /api/reports/summary` — returns:
  - `totalTasks`, `completedTasks`, `overdueCount`, `inProgressCount`
  - `weeklyVelocity[7]` — Prisma groupBy on Task.updatedAt where status=done, grouped by day
  - `projectSummary[]` — top 5 projects with progress and health
- All scoped to session user's workspace

**Create:** `src/app/api/reports/route.ts` (bridge)

**Modify:** `src/views/Dashboard.tsx`
- Remove all imports from ../data/mockData (projects, teamWorkload, weeklyData)
- Fetch `/api/reports/summary` on mount
- Stat cards: real counts from API
- Mini chart: real weeklyVelocity array
- Recent tasks: already uses `useTasks()` — real
- Upcoming deadlines: filter real tasks by dueDate within next 7 days

---

### Step 2.5 — Real Reports View

**Modify:** `src/views/Reports.tsx`
- Remove all mock data imports
- On mount: fetch `/api/reports/summary` to populate all charts and KPI cards
- Bar chart: real weeklyVelocity data
- Donut chart: real statusCounts from API (Prisma groupBy status)
- Priority bars: real priorityCounts from API
- Team workload: Prisma groupBy assigneeId with user join
- Project health table: real projects with computed health and task counts

---

### Step 2.6 — Kanban Drag-and-Drop

**Install:** `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**Modify:** `src/views/KanbanBoard.tsx`
- Wrap board in `<DndContext onDragEnd={handleDragEnd}>`
- Each column is a `<Droppable>` target
- Each card is a `<Draggable>` item
- `handleDragEnd`: determine new status from drop target column, call `updateTaskStatus(taskId, newStatus)`
- The existing TaskContext.updateTaskStatus already handles optimistic update + API + rollback
- Animate with CSS `transition: transform 150ms ease-out`
- Show drag overlay ghost card while dragging

---

### Step 2.7 — Subtask Toggle Persistence

**Create:** `src/api/tasks/[id]/subtasks/route.ts`
- `POST /api/tasks/:id/subtasks` — create subtask (body: { title })
- `PATCH /api/tasks/:id/subtasks/:sid` — toggle done (body: { done: boolean })
- `DELETE /api/tasks/:id/subtasks/:sid` — delete subtask
- After any toggle: recompute `task.progress = round((doneCount / total) * 100)` and update parent

**Create bridge files:** `src/app/api/tasks/[id]/subtasks/route.ts` and `[sid]/route.ts`

**Modify:** `src/components/TaskDetail.tsx`
- Subtask checkboxes call PATCH on toggle
- "Add subtask" input calls POST
- Progress bar updates via optimistic state

---

### Step 2.8 — Fix taskNumber Display

**Modify:** `src/components/TaskDetail.tsx` line 51
- Replace `{task.id}` with `{task.taskNumber ?? task.id}`

**Modify:** `src/views/MyTasks.tsx`
- Show `task.taskNumber` as monospace badge on each task row

**Modify:** `src/views/KanbanBoard.tsx`
- Show `task.taskNumber` in small gray text on card footer

---

## PHASE 3 — Settings and Workspace Management
### Goal: Settings page saves real data to the database
### Duration: 2-3 days | Priority: Medium-High

---

### Step 3.1 — Profile Settings (Real Persistence)

**Create:** `src/api/users/[id]/route.ts`
- `GET /api/users/:id` — return user profile
- `PATCH /api/users/:id` — update name, role, avatar initial (auth check: own profile only)

**Create:** `src/app/api/users/[id]/route.ts` (bridge)

**Modify:** `src/views/Settings.tsx` — Profile section
- Remove `import { currentUser } from '../data/mockData'`
- Use `useSession()` to populate form
- On "Save Changes": PATCH /api/users/${session.user.id} → toast success

---

### Step 3.2 — Password Security Settings

**Create:** `src/api/users/[id]/change-password/route.ts`
- `POST /api/users/:id/change-password` — body: { currentPassword, newPassword }
- `bcrypt.compare(currentPassword, user.password)` — 400 if wrong
- `bcrypt.hash(newPassword, 10)` → `prisma.user.update(...)` — 200 on success

**Create:** `src/app/api/users/[id]/change-password/route.ts` (bridge)

**Modify:** `src/views/Settings.tsx` — Security section — wire Change Password form

---

### Step 3.3 — Members Section (Real Users)

**Modify:** `src/views/Settings.tsx` — Members section
- Remove mock user imports
- Fetch `GET /api/users` → render real team member list
- Show: avatar initials, name, email, role, createdAt date

---

### Step 3.4 — Notification Preferences

**Add to `prisma/schema.prisma`:**
```
model NotificationPreference {
  id                String  @id @default(cuid())
  userId            String  @unique
  user              User    (relation)
  taskAssigned      Boolean @default(true)
  taskDueSoon       Boolean @default(true)
  commentMention    Boolean @default(true)
  statusChanges     Boolean @default(false)
  weeklyDigest      Boolean @default(true)
}
```

**Create:** `src/api/users/[id]/notifications/route.ts` — GET and PATCH

**Modify:** `src/views/Settings.tsx` — Notifications section — toggle switches save to DB

---

## PHASE 4 — Advanced Features (Portfolio Differentiators)
### Goal: Features that prove senior-level depth and product thinking
### Duration: 4-5 days | Priority: High-impact

---

### Step 4.1 — Global Command Palette (Ctrl+K / Cmd+K)

**Create:** `src/components/CommandPalette.tsx`
- Global `keydown` listener in `useEffect` with cleanup
- Debounced search (200ms) — `GET /api/search?q=<term>&limit=10`
- Results grouped by type: Tasks | Projects | Views
- Keyboard navigation: Arrow keys, Enter to open, Escape to close
- Results include task title, taskNumber, project name, status

**Create:** `src/api/search/route.ts`
- Prisma OR query: tasks title ILIKE, projects name ILIKE
- Return max 10 results, auth-scoped to session user

**Create:** `src/app/api/search/route.ts` (bridge)

**Modify:** `src/app/page.tsx` — mount `<CommandPalette />` always in DOM

**Modify:** `src/components/Header.tsx` — show Ctrl+K hint in search area

---

### Step 4.2 — Calendar View (Month Grid)

**Create:** `src/views/CalendarView.tsx`
- Month grid: 7-column CSS grid, each cell is one day
- Tasks render as colored pill chips inside their due-date cell
- Click a task chip → opens TaskDetail drawer
- Header: previous/next month navigation
- Reads from `useTasks()` — no extra API call needed
- Week mode toggle: show 7 day columns

**Modify:** `src/app/page.tsx`
- Replace CalendarPlaceholder with `<CalendarView onTaskClick={setSelectedTask} />`

---

### Step 4.3 — Inbox and Notification Center

**Add to `prisma/schema.prisma`:**
```
model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   (task_assigned, comment_mention, task_overdue, status_change)
  title     String
  body      String
  taskId    String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId, read])
  @@index([userId, createdAt])
}
```

**Create:** `src/api/notifications/route.ts`
- `GET /api/notifications` — list for session user (unread first)
- `PATCH /api/notifications/:id/read` — mark one as read
- `PATCH /api/notifications/read-all` — mark all as read

**Trigger from:**
- `POST /api/tasks` when assigneeId is set — create task_assigned notification
- `POST /api/tasks/[id]/comments` — create comment_mention notification for task assignee

**Create:** `src/views/Inbox.tsx`
- Real notification list, unread count badge, "Mark all read" button
- Click notification → navigate to related task

**Modify:** `src/components/Sidebar.tsx`
- Fetch unread count on mount: `GET /api/notifications?unreadOnly=true&countOnly=true`
- Show badge number on Inbox nav item

---

### Step 4.4 — Project Detail Page

**Create:** `src/views/ProjectDetail.tsx`
- Triggered when clicking a project card in Projects view
- Header: project name, color, health badge, progress bar
- Tabs: Overview | Tasks | Members
- Overview: task status breakdown, recent activity
- Tasks: Kanban or list filtered to this project

**Create:** `src/api/projects/[id]/route.ts`
- `GET /api/projects/:id` — project with full stats and recent tasks
- `PATCH /api/projects/:id` — update name, description, health, color, dueDate
- Auth: only owner can PATCH

**Create:** `src/app/api/projects/[id]/route.ts` (bridge)

---

### Step 4.5 — Auto-Recompute Project Progress

**Modify:** `src/api/tasks/[id]/route.ts` PATCH handler
- After every status update, run a two-query recomputation:
  - `COUNT(*)` where projectId and status=done
  - `COUNT(*)` where projectId (all tasks)
  - `progress = round((done / total) * 100)`
  - `prisma.project.update({ data: { progress: newProgress } })`
- Use `Promise.all` to run both counts in parallel — O(1) DB round-trip

---

### Step 4.6 — Bulk Task Operations

**Create:** `src/api/tasks/bulk/route.ts`
- `POST /api/tasks/bulk` — body: `{ ids: string[], action: 'update' | 'delete', payload?: {...} }`
- `prisma.task.updateMany({ where: { id: { in: ids } }, data: payload })`
- `prisma.task.deleteMany({ where: { id: { in: ids } } })`
- Auth: validate all task IDs belong to session user before executing

**Create:** `src/app/api/tasks/bulk/route.ts` (bridge)

**Modify:** `src/views/MyTasks.tsx`
- Bulk Actions toolbar appears when 1+ checkboxes selected
- Actions: Change Status, Change Priority, Delete Selected

---

### Step 4.7 — CSV Export from Reports

**Create:** `src/api/reports/export/route.ts`
- `GET /api/reports/export?format=csv&from=<date>&to=<date>`
- Stream CSV: taskNumber, title, status, priority, assignee, dueDate, project, createdAt
- Response headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename=tasks.csv`

**Modify:** `src/views/Reports.tsx` — "Export CSV" button calls this endpoint

---

### Step 4.8 — Automated Project Health & Predictive SLA Risk Engine
**Problem**: In basic task apps, project health (`on_track`, `at_risk`, `delayed`) is static or manually guessed, quickly falling out of sync with actual development velocity.
**Solution**: A deterministic predictive algorithm evaluated automatically on task mutations and project lookups:
- **Mathematical Heuristic**:
  - If `now > dueDate` and `progress < 100` → `health = 'delayed'`, `riskScore = 100`, `slaBreached = true`.
  - If `daysUntilDue <= 3` and `progress < 70` OR `overdueTasks >= 2` → `health = 'at_risk'`, `riskScore = 75`.
  - Velocity Forecast: If `projectedDaysRemaining = (remainingTasks / max(velocityLast7Days, 0.2)) > daysUntilDue` → `health = 'at_risk'`.
  - Otherwise → `health = 'on_track'`, `riskScore = 10`.
**Create:** `src/lib/projectHealthEngine.ts` — pure deterministic calculation function with unit test coverage.
**Modify:** `src/api/projects/[id]/route.ts` & `src/api/reports/summary/route.ts` — compute dynamic health, risk score, and SLA breach warnings.
**Recruiter Signal**: Demonstrates automated business logic, predictive heuristics, and real-time SLA risk monitoring.

---

### Step 4.9 — Project Milestones & Release Sprint Roadmaps
**Goal**: Allow engineering teams to partition projects into sequenced deliverables (e.g., "v1.0 Core Engine", "Beta Release", "Security Audit").
**Add to `prisma/schema.prisma`:**
```prisma
model ProjectMilestone {
  id          String    @id @default(cuid())
  projectId   String
  title       String
  description String?
  targetDate  DateTime?
  completed   Boolean   @default(false)
  createdAt   DateTime  @default(now())

  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks       Task[]

  @@index([projectId, completed])
}
```
**Create:** `src/api/projects/[id]/milestones/route.ts` — `GET` (milestones with task progress) and `POST` (create milestone).
**Modify:** `src/views/ProjectDetail.tsx` — interactive roadmap timeline showing milestone progress bars, task groupings, and target release delivery flags.
**Recruiter Signal**: Normalized relational modeling, hierarchical delivery architecture, agile/scrum release planning.

---

### Step 4.10 — Project-Scoped Role-Based Access Control (RBAC) & Team Management
**Goal**: Enterprise-grade multi-role permission boundaries on project resources.
**Roles**:
- `OWNER`: Full project destruction, settings modification, transfer ownership.
- `LEAD`: Milestone management, project settings editing, member role modification.
- `CONTRIBUTOR`: Task creation, assignment, status progression, comment authoring.
- `VIEWER`: Read-only access to Kanban, lists, and burndown analytics.
**Add to `prisma/schema.prisma`:**
```prisma
enum ProjectRole {
  OWNER
  LEAD
  CONTRIBUTOR
  VIEWER
}

model ProjectMember {
  id        String      @id @default(cuid())
  projectId String
  userId    String
  role      ProjectRole @default(CONTRIBUTOR)
  joinedAt  DateTime    @default(now())

  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([projectId, role])
  @@index([userId])
}
```
**Create:** `src/lib/permissions.ts` — `assertProjectRole(sessionUserId, projectId, minimumRole)`
**Create:** `src/api/projects/[id]/members/route.ts` — list members, invite member with role, change role, remove member.
**Recruiter Signal**: Enterprise security posture, least-privilege enforcement, multi-tenant RBAC.

---

### Step 4.11 — Project Lifecycle State Machine & Audited Archival
**Goal**: Manage enterprise project lifecycle without destructive deletes that corrupt historical reporting.
**Lifecycle States**: `PLANNING` → `ACTIVE` → `PAUSED` → `COMPLETED` → `ARCHIVED`.
- **Soft Deletion & Archival**: `archivedAt DateTime?` on `Project`.
- Active queries filter `where: { archivedAt: null }` while reporting and audit logs preserve historical attribution.
- Project restoration with 1-click unarchive.
**Recruiter Signal**: State-machine architecture, data warehouse integrity, compliance audit logging, non-destructive lifecycle management.

---

### Step 4.12 — Project Burndown & Velocity Analytics Engine
**Goal**: Real-time project completion trajectory comparing ideal burn line vs actual remaining work.
**Create:** `src/api/projects/[id]/burndown/route.ts`
- Computes daily task resolution points over project duration `[startDate, dueDate]`.
- Calculates ideal daily resolution slope: `slope = totalTasks / totalDays`.
- Returns actual remaining tasks per day using `Task` `createdAt` and `Activity` completion events.
**Modify:** `src/views/ProjectDetail.tsx` — render SVG Burndown Chart with projected completion target date based on team velocity.
**Recruiter Signal**: Mathematical visualization, historical event aggregation, enterprise sprint velocity tracking.

---

### Step 4.13 — useEffect Cleanup and Memory Leak Prevention

**Modify:** `src/context/TaskContext.tsx`
- Wrap all fetch calls with AbortController
- Return cleanup function: `return () => controller.abort()`

**Modify:** All views with `useEffect` data fetching
- Add AbortController pattern to prevent state updates on unmounted components

---

## PHASE 5 — Final Polish and Production Readiness
### Goal: Demo-ready, visually flawless, zero console errors
### Duration: 2 days | Priority: Polish

---

### Step 5.1 — Skeleton Loaders (Zero Layout Shift)

**Create:** `src/components/ui/Skeleton.tsx`
- `<TaskRowSkeleton />` — exact height of a task row
- `<KanbanCardSkeleton />` — exact height of a Kanban card
- `<StatCardSkeleton />` — exact height of a dashboard stat card

**Modify:** MyTasks, KanbanBoard, Dashboard, Projects
- While `isLoading === true`: render skeletons instead of blank space

---

### Step 5.2 — Error Boundary and Empty States

**Create:** `src/components/ErrorBoundary.tsx`
- React class component wrapping each view
- Catches render errors, shows friendly "Something went wrong" UI with retry button

**Create:** `src/components/EmptyState.tsx`
- Reusable: icon, title, description, optional CTA button
- Used in: MyTasks (0 results), KanbanBoard (empty columns), Projects (no projects)

---

### Step 5.3 — Mobile Responsiveness QA

- [ ] MyTasks table: hide non-essential columns on mobile (keep only title + status)
- [ ] Kanban board: horizontal scroll with scroll-snap on mobile
- [ ] Task Detail drawer: full-screen on mobile (100vw × 100vh)
- [ ] Create Task modal: bottom-sheet style on mobile
- [ ] Header search bar: collapsible icon-only on mobile

---

### Step 5.4 — Hiring-Ready README

**Modify:** `README.md`
- Project description and screenshots/GIF
- Tech stack table with rationale for each choice
- Local setup (copy .env.example, run prisma:push, npm run dev)
- Architecture overview (text diagram)
- Full feature list with check marks
- Future roadmap section

---

### Step 5.5 — Production Build Verification

```bash
npm run build   # must complete with 0 TypeScript errors
npm start       # verify all routes work in production mode
```

Fix any type errors introduced by new features before considering the project done.

---

## Complete File Map After All Phases

```
src/
├── api/
│   ├── auth/signup/route.ts            exists — add Zod
│   ├── notifications/route.ts          NEW Phase 4.3
│   ├── projects/
│   │   ├── route.ts                    exists — fix _count + Zod
│   │   └── [id]/route.ts               NEW Phase 4.4
│   ├── reports/
│   │   ├── route.ts                    NEW Phase 2.4
│   │   └── export/route.ts             NEW Phase 4.7
│   ├── search/route.ts                 NEW Phase 4.1
│   ├── tasks/
│   │   ├── route.ts                    exists — cursor pagination + Zod
│   │   ├── bulk/route.ts               NEW Phase 4.6
│   │   └── [id]/
│   │       ├── route.ts                exists — logActivity + Zod
│   │       ├── activities/route.ts     NEW Phase 2.2
│   │       ├── comments/route.ts       NEW Phase 2.1
│   │       └── subtasks/
│   │           ├── route.ts            NEW Phase 2.7
│   │           └── [sid]/route.ts      NEW Phase 2.7
│   ├── users/
│   │   ├── route.ts                    exists
│   │   └── [id]/
│   │       ├── route.ts                NEW Phase 3.1
│   │       ├── change-password/        NEW Phase 3.2
│   │       └── notifications/          NEW Phase 3.4
│   ├── client.ts                       exists — update envelope
│   └── services/
│       ├── tasks.service.ts            exists
│       └── projects.service.ts         exists — expand
│
├── lib/
│   ├── activity.ts                     NEW Phase 2.2
│   ├── prisma.ts                       exists
│   ├── timeAgo.ts                      NEW Phase 1.4
│   ├── utils.ts                        exists
│   └── validators.ts                   NEW Phase 1.1
│
├── views/
│   ├── CalendarView.tsx                NEW Phase 4.2
│   ├── Dashboard.tsx                   exists — remove all mock data
│   ├── Inbox.tsx                       NEW Phase 4.3
│   ├── KanbanBoard.tsx                 exists — add drag-and-drop
│   ├── MyTasks.tsx                     exists — add bulk actions
│   ├── ProjectDetail.tsx               NEW Phase 4.4
│   ├── Projects.tsx                    exists — wire to DB
│   ├── Reports.tsx                     exists — wire to DB
│   └── Settings.tsx                    exists — wire all sections
│
└── components/
    ├── CommandPalette.tsx              NEW Phase 4.1
    ├── CreateProjectModal.tsx          NEW Phase 2.3
    ├── ErrorBoundary.tsx               NEW Phase 5.2
    ├── ui/
    │   ├── Skeleton.tsx                NEW Phase 5.1
    │   └── Toast.tsx                   NEW Phase 1.7
    └── ... (existing files unchanged)
```

---

## Execution Checklist

### Phase 1 — Foundation
- [x] 1.1 Install Zod, create validators.ts, validate all API inputs
- [x] 1.2 Implement ApiResponse envelope on all endpoints + update apiClient
- [x] 1.3 Add missing DB indexes to schema.prisma and run prisma:push
- [x] 1.4 Remove timeAgo string columns, create timeAgo.ts utility
- [x] 1.5 Cursor-based pagination on GET /api/tasks
- [x] 1.6 Fix GET /api/projects to use _count instead of include tasks
- [x] 1.7 Toast notification system + mount in root layout

### Phase 2 — Real Features
- [x] 2.1 Comments API + wire TaskDetail comments tab end-to-end
- [x] 2.2 Activity log API + auto-log on PATCH + wire TaskDetail activity tab
- [x] 2.3 Projects view fetches DB data + CreateProjectModal
- [x] 2.4 Reports summary API + wire Dashboard to real data
- [x] 2.5 Wire Reports view to real DB aggregations
- [x] 2.6 Kanban drag-and-drop with @dnd-kit
- [x] 2.7 Subtask toggle + create + delete, persisted to DB
- [x] 2.8 taskNumber (TF-001) displayed in TaskDetail, MyTasks, Kanban

### Phase 3 — Settings and Profile
- [x] 3.1 Profile settings saves name, role, avatar to DB
- [x] 3.2 Change Password — bcrypt verify + hash + update
- [x] 3.3 Members list reads from real users API
- [x] 3.4 Notification preferences model + save/load

### Phase 4 — Differentiators
- [ ] 4.1 Global Command Palette (Ctrl+K) with real task/project search
- [ ] 4.2 Calendar view — month grid with task chips by dueDate
- [ ] 4.3 Inbox — real Notification model + unread badge on sidebar
- [ ] 4.4 Project Detail page — per-project stats + filtered tasks
- [ ] 4.5 Auto-recompute project progress on every task status change
- [ ] 4.6 Bulk task operations using Prisma updateMany and deleteMany
- [ ] 4.7 CSV export from Reports
- [ ] 4.8 Automated Project Health & Predictive SLA Risk Engine
- [ ] 4.9 Project Milestones & Release Sprint Roadmaps
- [ ] 4.10 Project-Scoped Role-Based Access Control (RBAC) & Team Management
- [ ] 4.11 Project Lifecycle State Machine & Audited Archival
- [ ] 4.12 Project Burndown & Velocity Analytics Engine
- [ ] 4.13 Memory Leak & AbortController cleanup across views

### Phase 5 — Polish
- [ ] 5.1 Skeleton loaders on all data-fetching views
- [ ] 5.2 Error boundary + empty states
- [ ] 5.3 Mobile responsiveness QA
- [ ] 5.4 README with screenshots, setup instructions, architecture overview
- [ ] 5.5 npm run build — zero TypeScript errors

---

## What This Submission Proves to the Hiring Panel

| Skill | Evidence |
|---|---|
| Full-Stack Architecture | Clean bridge layer separation, canonical API handlers, Prisma |
| Database Design | Normalized schema, proper indexes, relations, cascade rules |
| Auth and Security | JWT, bcrypt, route protection, user-scoped data isolation |
| API Design | RESTful, Zod validation, ApiResponse envelope, cursor pagination |
| React Patterns | Context + optimistic updates + rollback, custom hooks, useEffect cleanup |
| Performance Thinking | O(1) lookups, _count not full relations, bounded pagination |
| Real-Time UX | Optimistic updates, toast feedback, skeleton loaders, drag-and-drop |
| Enterprise Project Lifecycle | Audited state machine (`PLANNING` → `ACTIVE` → `ARCHIVED`), soft deletion, data warehouse integrity |
| Algorithmic SLA & Health Engine | Deterministic predictive heuristic calculating deadline risk, velocity forecast, and SLA warnings |
| Multi-Tenant Project RBAC | Fine-grained project member roles (`OWNER`, `LEAD`, `CONTRIBUTOR`, `VIEWER`), least-privilege enforcement |
| Milestones & Burndown Analytics | Relational sprint milestone roadmaps, dynamic burn-down trajectory curve calculation |
| Production Readiness | Error boundaries, empty states, build clean, mobile responsive |
| Code Quality | TypeScript strict, no any, meaningful variable names, documented architecture |
| Product Sense | Every feature works end-to-end — nothing is faked or stubbed |
