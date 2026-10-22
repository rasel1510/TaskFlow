# FlowSync

Next.js + Tailwind CSS + shadcn/ui project for project and task management.

> 📖 **Full Architecture & Scalability Guide:** Refer to [ARCHITECTURE.md](file:///c:/Users/DELL/Desktop/TaskFlow/ARCHITECTURE.md) for complete engineering standards, complexity budgets, and scaling protocols.

---

## 🏛️ High-Scale Engineering Mandates (Millions of Users)

All code contributed to FlowSync must adhere to Staff/Principal-level engineering standards:

1. **Lowest Time & Space Complexity ($O(1)$ / $O(\log N)$ First)**:
   - **No Quadratic Iteration**: Never nest `.find()` or `.filter()` inside loops ($O(N^2)$). Always index data using `Map<string, T>` or `Set<string>` for $O(1)$ lookups.
   - **Memory Discipline**: Never query entire tables or use unprojected `SELECT *`. Always use Prisma `select: { ... }` to fetch only strictly needed fields.
   - **Bounded Memory**: Enforce cursor-based pagination ($K \le 100$ items) on all list endpoints. Never accumulate unbounded datasets in V8 heap memory.
   - **Zero Client Leaks**: Always clean up listeners, intervals, and subscriptions in React `useEffect` cleanups.

2. **Simple, Noise-Free User Interface**:
   - **Clutter-Free Minimalism**: Linear/Supabase inspired aesthetics. Prioritize high-signal content, calm typography (Inter), and clean whitespace over visual decoration.
   - **Zero Layout Shift (CLS = 0)**: Maintain rigid skeleton loaders and fixed layout geometry.
   - **Instantaneous Perceived Latency**: Use optimistic UI updates with automatic rollback on error. Keep micro-interactions under 150ms with CSS `ease-out`.

3. **Efficient & Scalable API Architecture**:
   - **Strict Layer Separation**: Transport bridges in `src/app/api/` must remain thin re-exports. All validation, business logic, and Prisma operations belong strictly in `src/api/`.
   - **Unified API Envelope**: Always wrap responses in standard `ApiResponse<T>` with `{ success, data, error, meta }`.
   - **Graceful Degradation**: Always catch database exceptions and provide reliable fallbacks or structured sanitized error messages.

---

## Project Structure

### App (Next.js App Router)
- `src/app/layout.tsx` — Root layout with Inter font, metadata, and Tailwind CSS imports
- `src/app/page.tsx` — Main interactive application shell
- `src/app/globals.css` — Global styling, Tailwind tokens, and custom scrollbar rules

### Auth Pages (`app/auth/`)
- `src/app/auth/login.tsx` — ⭐ Full Login page component (UI + logic)
- `src/app/auth/signup.tsx` — ⭐ Full Signup page component (UI + logic)
- `src/app/auth/login/page.tsx` — Thin Next.js route wrapper (re-exports `../login`)
- `src/app/auth/signup/page.tsx` — Thin Next.js route wrapper (re-exports `../signup`)

### Middleware (`src/middleware/`)
- `src/middleware.ts` — ⭐ Next.js entry point — delegates to `./middleware/`
- `src/middleware/chain.ts` — Middleware orchestrator / chain runner
- `src/middleware/auth.ts` — Auth session-token checks & route-protection logic

### API Layer (`src/api/`) — Canonical business logic
- `src/api/client.ts` — Typed HTTP client with `ApiResponse<T>` envelope
- `src/api/index.ts` — Unified barrel export (`import { api } from '@/api'`)
- `src/api/tasks/route.ts` — ⭐ Tasks collection: GET (filtered list) + POST (create)
- `src/api/tasks/[id]/route.ts` — Single task resource: GET + PATCH + DELETE
- `src/api/projects/route.ts` — Projects collection: GET (list) + POST (create)
- `src/api/auth/signup/route.ts` — Signup handler: POST (create user)
- `src/api/services/tasks.service.ts` — Client-side tasks service (use in components)
- `src/api/services/projects.service.ts` — Client-side projects service

### Next.js App Router API Bridges (`src/app/api/`) — HTTP entry points only
- `src/app/api/tasks/route.ts` — Bridge: `export { GET, POST } from '@/api/tasks/route'`
- `src/app/api/tasks/[id]/route.ts` — Bridge: `export { GET, PATCH, DELETE } from …`
- `src/app/api/projects/route.ts` — Bridge: `export { GET, POST } from '@/api/projects/route'`
- `src/app/api/auth/signup/route.ts` — Bridge: `export { POST } from '@/api/auth/signup/route'`
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth catch-all handler

### Components & Views
- `src/components/ui/` — Accessible shadcn/ui component primitives
- `src/components/` — Application UI components (Header, Sidebar, CreateTaskModal, TaskDetail)
- `src/components/providers/AuthProvider.tsx` — NextAuth session provider
- `src/views/` — Main feature views (Dashboard, MyTasks, KanbanBoard, Projects, Reports, Settings)

### Data & Utilities
- `src/auth.ts` — NextAuth configuration (providers, callbacks, adapter)
- `src/data/mockData.ts` — Data models, mock tasks, projects, users, and status/priority configs
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/utils.ts` — Shared utility functions including `cn`

## API Architecture Pattern

All API business logic lives in `src/api/` — **never** in `src/app/api/`.
The files under `src/app/api/` are **bridge files only** — thin re-exports that satisfy
Next.js App Router's file-system routing requirement.

```
Request → src/app/api/tasks/route.ts (bridge)
               ↓  re-exports
          src/api/tasks/route.ts   (all business logic here)
               ↓  uses
          src/lib/prisma.ts + src/data/mockData.ts
```

## Scripts

- `npm run dev` — Start Next.js development server
- `npm run build` — Build the application for production
- `npm start` — Start the production server
- `npm run prisma:generate` — Regenerate Prisma client
- `npm run prisma:push` — Push schema to database
- `npm run prisma:studio` — Open Prisma Studio

