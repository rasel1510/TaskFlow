'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Check,
  ArrowRight,
  Kanban,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Command,
  FolderKanban,
  ListTodo,
  Layers,
  Activity,
  User,
  LogOut,
  ChevronRight,
  Shield,
  Zap,
  SlidersHorizontal,
  Plus,
  Download
} from 'lucide-react';
import PWAModal from '@/components/PWAModal';

interface LandingPageProps {
  onLaunchApp?: () => void;
}

export default function LandingPage({ onLaunchApp }: LandingPageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';

  const [activeTab, setActiveTab] = useState<'kanban' | 'list' | 'projects'>('kanban');
  const [isPWAModalOpen, setIsPWAModalOpen] = useState(false);

  // If already authenticated and visiting the root URL '/', seamlessly redirect to workspace
  useEffect(() => {
    if (status === 'authenticated' && typeof window !== 'undefined' && window.location.pathname === '/') {
      router.replace('/app');
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-white text-[#0F172A] selection:bg-blue-100 selection:text-blue-800 font-sans">
      {/* ─────────────────────────────────────────────────────────────────────────
          1. NAVIGATION BAR
          ───────────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white shadow-xs group-hover:bg-[#1D4ED8] transition-colors shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <span className="font-bold text-[17px] tracking-tight text-slate-900 whitespace-nowrap">
              Task<span className="text-[#2563EB]">Flow</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-[14px] font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#views" className="hover:text-slate-900 transition-colors">Views</a>
            <a href="#workflow" className="hover:text-slate-900 transition-colors">Workflow</a>
          </nav>

          {/* Right Action Area */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isAuthenticated ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 text-[12px] font-medium text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-[10px] font-bold">
                    {userName.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="max-w-[120px] truncate">{userName}</span>
                </div>

                <Link
                  href="/app"
                  onClick={(e) => {
                    if (onLaunchApp) {
                      e.preventDefault();
                      onLaunchApp();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-xs"
                >
                  <span>Open Workspace</span>
                  <ArrowRight size={14} />
                </Link>

                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  title="Sign Out"
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/auth/login"
                  className="px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <span>Get Started</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────────────
          2. HERO SECTION
          ───────────────────────────────────────────────────────────────────────── */}
      <section className="pt-16 pb-16 md:pt-24 md:pb-20 border-b border-slate-100 bg-[#FBFBFC]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12] mb-8 max-w-4xl mx-auto">
            Project management built for{' '}
            <span className="text-[#2563EB]">clarity, speed, and focus.</span>
          </h1>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            {isAuthenticated ? (
              <Link
                href="/app"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#2563EB] text-white text-[15px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-sm"
              >
                <span>Go to Workspace</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/signup"
                  className="w-full sm:w-40 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-[#2563EB] text-white text-[15px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-sm"
                >
                  <span>Start Free</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/auth/login"
                  className="w-full sm:w-40 inline-flex items-center justify-center py-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-[15px] font-semibold hover:bg-slate-50 transition-colors shadow-xs"
                >
                  <span>Sign In</span>
                </Link>
              </>
            )}
          </div>

          {/* Honest Capability Highlights */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] sm:text-[13px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" />
              Fluid Kanban & List views
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" />
              Subtasks & checklist progress
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" />
              Project health & milestones
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" />
              Command Palette (⌘K)
            </span>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────────────────
            REALISTIC HIGH-FIDELITY APP PREVIEW (Centerpiece)
            ─────────────────────────────────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
          <div className="rounded-xl border border-slate-200/90 bg-white shadow-xl overflow-hidden">
            {/* Window Topbar */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="ml-2 text-[11px] font-medium text-slate-500 hidden sm:inline">
                  TaskFlow Workspace — Sprint 12
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-500">
                  <Search size={12} className="text-slate-400" />
                  <span className="hidden sm:inline">Search tasks...</span>
                  <kbd className="text-[9px] bg-slate-100 px-1 rounded text-slate-400 font-mono">⌘K</kbd>
                </div>
              </div>
            </div>

            {/* Inner App Canvas */}
            <div className="grid grid-cols-1 md:grid-cols-4 bg-[#F8FAFC] min-h-[380px]">
              {/* Mini Sidebar Preview (hidden on mobile) */}
              <div className="hidden md:flex flex-col border-r border-slate-200/80 bg-white p-3 space-y-1 text-[13px]">
                <div className="px-2.5 py-1.5 rounded-md bg-blue-50 text-[#2563EB] font-semibold flex items-center gap-2">
                  <Kanban size={15} />
                  <span>Kanban Board</span>
                </div>
                <div className="px-2.5 py-1.5 rounded-md text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                  <ListTodo size={15} />
                  <span>My Tasks</span>
                  <span className="ml-auto text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">8</span>
                </div>
                <div className="px-2.5 py-1.5 rounded-md text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                  <FolderKanban size={15} />
                  <span>Projects</span>
                </div>
                <div className="px-2.5 py-1.5 rounded-md text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                  <Calendar size={15} />
                  <span>Calendar</span>
                </div>
                <div className="px-2.5 py-1.5 rounded-md text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                  <Activity size={15} />
                  <span>Timeline</span>
                </div>

                <div className="pt-4 mt-auto border-t border-slate-100 text-[11px] text-slate-400 px-2">
                  Sprint Velocity: <span className="font-semibold text-slate-700">84%</span>
                </div>
              </div>

              {/* Kanban Columns (3 columns shown) */}
              <div className="col-span-3 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Col 1: Backlog */}
                <div className="rounded-lg bg-slate-100/70 border border-slate-200/80 p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 text-[12px]">
                    <span className="font-semibold text-slate-700">Backlog</span>
                    <span className="text-[11px] font-bold text-slate-400">2</span>
                  </div>

                  <div className="bg-white p-3 rounded-md border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-slate-400">TF-104</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">Design</span>
                    </div>
                    <div className="text-[12px] font-semibold text-slate-800 leading-snug">
                      Design dark-mode tokens & typography
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <CheckCircle2 size={11} className="text-slate-400" /> 2/4
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">Oct 2</span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-md border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-slate-400">TF-108</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">DevOps</span>
                    </div>
                    <div className="text-[12px] font-semibold text-slate-800 leading-snug">
                      Setup staging deployment pipeline
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <CheckCircle2 size={11} className="text-slate-400" /> 1/3
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">Oct 5</span>
                    </div>
                  </div>
                </div>

                {/* Col 2: In Progress */}
                <div className="rounded-lg bg-slate-100/70 border border-slate-200/80 p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 text-[12px]">
                    <span className="font-semibold text-slate-700">In Progress</span>
                    <span className="text-[11px] font-bold text-blue-600">2</span>
                  </div>

                  <div className="bg-white p-3 rounded-md border border-blue-200 shadow-xs relative">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#2563EB] rounded-t-md" />
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-slate-400">TF-102</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold uppercase">Urgent</span>
                    </div>
                    <div className="text-[12px] font-semibold text-slate-800 leading-snug">
                      Refactor subtask activity logging engine
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 text-blue-600 text-[10px] font-medium">
                        <CheckCircle2 size={11} /> 4/5 subtasks
                      </span>
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
                        SC
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-md border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-slate-400">TF-105</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">Frontend</span>
                    </div>
                    <div className="text-[12px] font-semibold text-slate-800 leading-snug">
                      Implement drag-and-drop task reordering
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <CheckCircle2 size={11} className="text-slate-400" /> 3/3
                      </span>
                      <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[9px] font-bold">
                        AM
                      </div>
                    </div>
                  </div>
                </div>

                {/* Col 3: Done */}
                <div className="rounded-lg bg-slate-100/70 border border-slate-200/80 p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 text-[12px]">
                    <span className="font-semibold text-slate-700">Done</span>
                    <span className="text-[11px] font-bold text-emerald-600">2</span>
                  </div>

                  <div className="bg-white p-3 rounded-md border border-slate-200 shadow-xs opacity-90">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-slate-400">TF-099</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Core</span>
                    </div>
                    <div className="text-[12px] font-semibold text-slate-500 line-through leading-snug">
                      Database schema migration for activity logs
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="text-[10px] font-medium text-emerald-600">✓ Completed</span>
                      <div className="w-5 h-5 rounded-full bg-slate-600 text-white flex items-center justify-center text-[9px] font-bold">
                        RA
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-md border border-slate-200 shadow-xs opacity-90">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-slate-400">TF-101</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">Auth</span>
                    </div>
                    <div className="text-[12px] font-semibold text-slate-500 line-through leading-snug">
                      NextAuth session token configuration
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="text-[10px] font-medium text-emerald-600">✓ Completed</span>
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                        DK
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          3. CORE FEATURES SECTION
          ───────────────────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#2563EB] mb-2">Features</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Everything needed to manage projects effectively.
            </h3>
            <p className="mt-3 text-slate-600 text-[15px]">
              No bloat, no confusing hierarchies. Just straightforward tools that keep work flowing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center mb-4">
                <Kanban size={20} />
              </div>
              <h4 className="text-[16px] font-bold text-slate-900 mb-2">Visual Kanban Boards</h4>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Move tasks across Backlog, In Progress, In Review, and Done stages with drag-and-drop ease. Keep column counts clear and visible.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <CheckCircle2 size={20} />
              </div>
              <h4 className="text-[16px] font-bold text-slate-900 mb-2">Detailed Tasks & Subtasks</h4>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Break large tasks down into actionable subtask checklists. Assign team members, set explicit priorities, and attach due dates.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <FolderKanban size={20} />
              </div>
              <h4 className="text-[16px] font-bold text-slate-900 mb-2">Project Organization</h4>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Group tasks into dedicated project spaces. Track real-time completion percentages and stay informed on overall project health.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                <Calendar size={20} />
              </div>
              <h4 className="text-[16px] font-bold text-slate-900 mb-2">Calendar & Deadlines</h4>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                View your sprint schedule across an interactive calendar. Identify upcoming deadlines early and prevent project bottlenecks.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <Command size={20} />
              </div>
              <h4 className="text-[16px] font-bold text-slate-900 mb-2">Command Palette (⌘K)</h4>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Navigate views, find tasks, or create items instantly without leaving your keyboard. Press ⌘K or Ctrl+K anywhere in the workspace.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
                <Activity size={20} />
              </div>
              <h4 className="text-[16px] font-bold text-slate-900 mb-2">Activity & Audit Trail</h4>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Every task update, status shift, and subtask completion is tracked automatically so teams always have full context on progress.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          4. VIEWS SHOWCASE (Interactive Tab Tour)
          ───────────────────────────────────────────────────────────────────────── */}
      <section id="views" className="py-20 bg-slate-50 border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#2563EB] mb-2">Flexible Views</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Work the way that suits your task.
            </h3>
            <p className="mt-3 text-slate-600 text-[15px]">
              Switch effortlessly between board, list, and project views as your project evolves.
            </p>

            {/* View Selector Buttons */}
            <div className="mt-8 inline-flex items-center p-1 rounded-lg bg-slate-200/80 border border-slate-300/80 text-[13px] font-medium">
              <button
                onClick={() => setActiveTab('kanban')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md transition-colors ${
                  activeTab === 'kanban'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Kanban size={14} />
                <span>Kanban Board</span>
              </button>

              <button
                onClick={() => setActiveTab('list')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md transition-colors ${
                  activeTab === 'list'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListTodo size={14} />
                <span>Task Checklist</span>
              </button>

              <button
                onClick={() => setActiveTab('projects')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md transition-colors ${
                  activeTab === 'projects'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderKanban size={14} />
                <span>Project Roadmaps</span>
              </button>
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="max-w-4xl mx-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {activeTab === 'kanban' && (
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 text-[15px]">Kanban Pipeline</h4>
                    <p className="text-[12px] text-slate-500">Visual workflow representation with stage progression</p>
                  </div>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded bg-blue-50 text-[#2563EB]">
                    Active Sprint
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-slate-500 mb-2">Backlog (3)</div>
                    <div className="bg-white p-2.5 rounded border border-slate-200 text-[12px] font-medium text-slate-800 shadow-xs mb-2">
                      API Rate Limiter Implementation
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200 text-[12px] font-medium text-slate-800 shadow-xs">
                      Export Reports to CSV Format
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-blue-600 mb-2">In Progress (2)</div>
                    <div className="bg-white p-2.5 rounded border border-blue-200 text-[12px] font-semibold text-slate-800 shadow-xs mb-2">
                      Interactive Subtask Checklists
                      <div className="text-[10px] text-blue-600 mt-1 font-normal">3 of 4 done</div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-emerald-600 mb-2">Done (4)</div>
                    <div className="bg-white p-2.5 rounded border border-slate-200 text-[12px] text-slate-400 line-through shadow-xs">
                      PostgreSQL Connection Pooling
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'list' && (
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 text-[15px]">My Tasks Checklist</h4>
                    <p className="text-[12px] text-slate-500">Fast, focused personal task queue sorted by priority</p>
                  </div>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                    3 Pending Tasks
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded border border-slate-300" />
                      <div>
                        <span className="text-[13px] font-semibold text-slate-800">Finalize OAuth session cookie handling</span>
                        <div className="text-[11px] text-slate-400">Security • Sprint 12</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold uppercase">Urgent</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded border border-slate-300" />
                      <div>
                        <span className="text-[13px] font-semibold text-slate-800">Optimize task list queries with indexed foreign keys</span>
                        <div className="text-[11px] text-slate-400">Database • Sprint 12</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold uppercase">High</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 opacity-70">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center text-white text-[10px]">✓</div>
                      <div>
                        <span className="text-[13px] text-slate-500 line-through">Configure toast notifications for task updates</span>
                        <div className="text-[11px] text-slate-400">Completed today</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">Done</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 text-[15px]">Active Projects Overview</h4>
                    <p className="text-[12px] text-slate-500">High-level visibility across milestones and deliverables</p>
                  </div>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded bg-blue-50 text-[#2563EB]">
                    4 Projects Active
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-bold text-[14px] text-slate-800">Client Portal v2</h5>
                      <span className="text-[11px] font-semibold text-emerald-600">75% complete</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
                      <div className="bg-[#2563EB] h-full rounded-full" style={{ width: '75%' }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>12 of 16 tasks closed</span>
                      <span>Target: Nov 15</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-bold text-[14px] text-slate-800">Mobile PWA Optimization</h5>
                      <span className="text-[11px] font-semibold text-blue-600">40% complete</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: '40%' }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>4 of 10 tasks closed</span>
                      <span>Target: Dec 01</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          5. 3-STEP WORKFLOW
          ───────────────────────────────────────────────────────────────────────── */}
      <section id="workflow" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#2563EB] mb-2">How It Works</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              A simple, reliable three-step workflow.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative p-6 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-2xl font-black text-slate-300 mb-2 block">01</span>
              <h4 className="text-[16px] font-bold text-slate-900 mb-2">Create Projects & Goals</h4>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Set up dedicated project workspaces. Define timelines, assign milestone dates, and keep goals in plain sight.
              </p>
            </div>

            <div className="relative p-6 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-2xl font-black text-slate-300 mb-2 block">02</span>
              <h4 className="text-[16px] font-bold text-slate-900 mb-2">Prioritize & Assign</h4>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Add tasks, break them down into subtasks, assign team members, and prioritize urgent items using status flags.
              </p>
            </div>

            <div className="relative p-6 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-2xl font-black text-slate-300 mb-2 block">03</span>
              <h4 className="text-[16px] font-bold text-slate-900 mb-2">Track & Deliver</h4>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Move tasks across your board as work progresses. Review activity logs and ship on schedule with full confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          6. CLEAN PRE-FOOTER CTA
          ───────────────────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-[#F8FAFC] border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
            Ready to bring clarity to your projects?
          </h3>
          <p className="text-slate-600 text-[15px] max-w-xl mx-auto mb-8">
            Start organizing your tasks in seconds. Simple, fast, and distraction-free task management for your team.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/app"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#2563EB] text-white text-[14px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-sm"
              >
                <span>Open TaskFlow Workspace</span>
                <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/signup"
                  className="w-full sm:w-48 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-[#2563EB] text-white text-[14px] font-semibold hover:bg-[#1D4ED8] transition-colors shadow-sm"
                >
                  <span>Get Started Free</span>
                  <ArrowRight size={15} />
                </Link>
                <Link
                  href="/auth/login"
                  className="w-full sm:w-48 inline-flex items-center justify-center py-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-[14px] font-semibold hover:bg-slate-50 transition-colors shadow-xs"
                >
                  <span>Sign In</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          7. MINIMALIST HONEST FOOTER
          ───────────────────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200 py-8 text-[13px] text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[#2563EB] text-white flex items-center justify-center text-[11px] font-bold">
              TF
            </div>
            <span className="font-semibold text-slate-800">TaskFlow</span>
            <span className="text-slate-300">|</span>
            <span>Simple & professional project management</span>
          </div>

          <div className="flex items-center gap-5 text-slate-600">
            <Link href="#features" className="hover:text-slate-900 transition-colors">Features</Link>
            <Link href="#views" className="hover:text-slate-900 transition-colors">Views</Link>
            <button
              onClick={() => setIsPWAModalOpen(true)}
              className="hover:text-slate-900 transition-colors cursor-pointer text-left"
            >
              Install App (PWA)
            </button>
            {isAuthenticated ? (
              <Link href="/app" className="font-medium text-[#2563EB] hover:underline">Workspace</Link>
            ) : (
              <>
                <Link href="/auth/login" className="hover:text-slate-900 transition-colors">Sign In</Link>
                <Link href="/auth/signup" className="hover:text-slate-900 transition-colors">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Floating PWA Trigger Pill */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsPWAModalOpen(true)}
          className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-lg shadow-black/15 border border-slate-700/60 text-[13px] font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          title="Install TaskFlow as Desktop or Mobile App"
        >
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <Download size={14} className="text-blue-400 group-hover:translate-y-0.5 transition-transform" />
          <span>Install App</span>
        </button>
      </div>

      {/* PWA Installation Modal */}
      <PWAModal
        isOpen={isPWAModalOpen}
        onClose={() => setIsPWAModalOpen(false)}
      />
    </div>
  );
}
