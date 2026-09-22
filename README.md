# FlowSync

> Modern, high-velocity project and task management SaaS platform built with Next.js 15, React 19, Tailwind CSS, shadcn/ui, NextAuth, and Prisma.  
> 📐 **Scalability & Engineering Standards:** See [ARCHITECTURE.md](file:///c:/Users/DELL/Desktop/TaskFlow/ARCHITECTURE.md) for time/space complexity budgets, noise-free UI design guidelines, and system architecture for millions of users.

---

## 🚀 Overview

FlowSync is an enterprise-grade project management application designed for agile product, engineering, and design teams. It brings together sprint roadmaps, kanban boards, task tracking, team analytics, and secure authentication into one unified, lightning-fast workspace.

---

## ✨ Features

- **Authentication with NextAuth (Auth.js v5)**:
  - Custom branded **Signup** & **Login** pages
  - Credentials login with bcrypt password hashing
  - Social OAuth support (Google & GitHub)
  - 1-Click quick demo access for instantaneous testing
  - Automatic redirect to `/auth/login` for unauthenticated visitors
- **Dashboard & Analytics**:
  - Live task status distribution, sprint health indicators, and team velocity metrics
- **Kanban Board**:
  - Drag-and-drop board organized by Backlog, To Do, In Progress, In Review, and Done
- **My Tasks**:
  - Comprehensive task table with priority filtering, search, and detail drawer
- **Projects Hub**:
  - Project health indicators, completion percentages, and owner assignments
- **Modern Design System**:
  - Polished SaaS design system inspired by Linear and Supabase, with micro-animations and responsive layouts

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **UI & Components**: [React 19](https://react.dev/), [shadcn/ui](https://ui.shadcn.com/), [Lucide Icons](https://lucide.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Authentication**: [NextAuth (Auth.js v5)](https://authjs.dev/) & [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **Database & ORM**: [Prisma ORM](https://www.prisma.io/) with PostgreSQL

---

## 🏁 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/rasel1510/TaskFlow.git
cd TaskFlow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taskflow?schema=public"
AUTH_SECRET="your-32-character-secret-key-goes-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Database Setup

```bash
npx prisma generate
npx prisma db push
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 License

This project is licensed under the MIT License.
