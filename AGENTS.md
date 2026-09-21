# TaskFlow

Next.js + Tailwind CSS + shadcn/ui project for project and task management.

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
- `src/middleware/index.ts` — Middleware orchestrator / chain runner
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

- `pnpm dev` — Start Next.js development server
- `pnpm build` — Build the application for production
- `pnpm start` — Start the production server
- `pnpm prisma:generate` — Regenerate Prisma client
- `pnpm prisma:push` — Push schema to database
- `pnpm prisma:studio` — Open Prisma Studio
