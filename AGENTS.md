# TaskFlow

Next.js + Tailwind CSS + shadcn/ui project for project and task management.

## Project Structure

- `src/app/layout.tsx` - Root layout with Inter font, metadata, and Tailwind CSS imports
- `src/app/page.tsx` - Main interactive application shell
- `src/app/globals.css` - Global styling, Tailwind tokens, and custom scrollbar rules
- `src/components/ui/` - Accessible shadcn/ui component primitives
- `src/components/` - Application UI components (Header, Sidebar, CreateTaskModal, TaskDetail)
- `src/views/` - Main feature views (Dashboard, MyTasks, KanbanBoard, Projects, Reports, Settings)
- `src/data/mockData.ts` - Data models, mock tasks, projects, users, and status/priority configs
- `src/lib/utils.ts` - Shared utility functions including `cn`

## Scripts

- `pnpm dev` - Start Next.js development server
- `pnpm build` - Build the application for production
- `pnpm start` - Start the production server
