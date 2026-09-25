'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Check,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Zap,
  ShieldCheck,
  Layers,
  Calendar,
  Kanban,
  BarChart3,
  Clock,
  ArrowRight,
  Terminal,
  Smartphone,
  Users,
  Star,
  Compass,
  Sliders,
  Globe,
  Lock,
  RefreshCw,
  Search,
  Menu,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Laptop,
  Flame,
  Activity,
  Workflow
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp?: () => void;
}

export default function LandingPage({ onLaunchApp }: LandingPageProps) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  // Demo showcase states
  const [activeDemoTab, setActiveDemoTab] = useState<'kanban' | 'timeline' | 'calendar' | 'command'>('kanban');
  const [activeKanbanFilter, setActiveKanbanFilter] = useState<'all' | 'urgent' | 'frontend' | 'backend'>('all');
  const [selectedDemoTask, setSelectedDemoTask] = useState<any | null>(null);
  const [timelineZoom, setTimelineZoom] = useState<'days' | 'weeks'>('days');
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<number>(24);
  const [commandInput, setCommandInput] = useState('');
  
  // Interactive UI states
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [offlineSimulatorActive, setOfflineSimulatorActive] = useState(false);

  // Sample tasks for the interactive Kanban demo
  const demoKanbanTasks = [
    {
      id: 'tf-101',
      title: 'Real-time WebSocket event replay engine',
      column: 'in_progress',
      priority: 'urgent',
      tag: 'backend',
      tagLabel: 'Backend',
      assignee: 'Sarah Chen',
      avatar: 'SC',
      avatarBg: 'bg-emerald-500',
      subtasks: '4/5',
      dueDate: 'Today'
    },
    {
      id: 'tf-102',
      title: 'Design token elevation & glassmorphism specs',
      column: 'done',
      priority: 'medium',
      tag: 'frontend',
      tagLabel: 'Design',
      assignee: 'Maria Lopez',
      avatar: 'ML',
      avatarBg: 'bg-purple-500',
      subtasks: '6/6',
      dueDate: 'Sep 22'
    },
    {
      id: 'tf-103',
      title: 'Offline IndexedDB mutation queue & conflict resolution',
      column: 'in_progress',
      priority: 'urgent',
      tag: 'frontend',
      tagLabel: 'PWA Core',
      assignee: 'Rasel Ahmed',
      avatar: 'RA',
      avatarBg: 'bg-blue-600',
      subtasks: '8/9',
      dueDate: 'Tomorrow'
    },
    {
      id: 'tf-104',
      title: 'OAuth 2.0 PKCE session handshake hardening',
      column: 'review',
      priority: 'high',
      tag: 'backend',
      tagLabel: 'Security',
      assignee: 'Ahmed Malik',
      avatar: 'AM',
      avatarBg: 'bg-amber-500',
      subtasks: '3/3',
      dueDate: 'Sep 26'
    },
    {
      id: 'tf-105',
      title: 'Bi-directional Google & Outlook calendar bridge',
      column: 'backlog',
      priority: 'medium',
      tag: 'backend',
      tagLabel: 'Integration',
      assignee: 'David Kim',
      avatar: 'DK',
      avatarBg: 'bg-indigo-500',
      subtasks: '1/4',
      dueDate: 'Oct 02'
    },
    {
      id: 'tf-106',
      title: 'Multi-track Gantt SVG canvas zoom engine',
      column: 'review',
      priority: 'high',
      tag: 'frontend',
      tagLabel: 'Frontend',
      assignee: 'Sarah Chen',
      avatar: 'SC',
      avatarBg: 'bg-emerald-500',
      subtasks: '5/5',
      dueDate: 'Sep 25'
    }
  ];

  const filteredTasks = demoKanbanTasks.filter(task => {
    if (activeKanbanFilter === 'all') return true;
    if (activeKanbanFilter === 'urgent') return task.priority === 'urgent' || task.priority === 'high';
    return task.tag === activeKanbanFilter;
  });

  // Timeline demo items
  const demoTimelineItems = [
    { title: 'PWA Offline Sync Engine', start: 10, width: 45, color: 'bg-blue-600', progress: 85, lead: 'Rasel A.' },
    { title: 'Gantt SVG Canvas Refactor', start: 30, width: 40, color: 'bg-indigo-600', progress: 70, lead: 'Sarah C.' },
    { title: 'Security Audit & RBAC Polish', start: 50, width: 35, color: 'bg-emerald-600', progress: 95, lead: 'Ahmed M.' },
    { title: 'Mobile Touch Gestures v2', start: 20, width: 50, color: 'bg-purple-600', progress: 60, lead: 'Maria L.' },
    { title: 'Public API & Webhook Dispatcher', start: 65, width: 30, color: 'bg-amber-600', progress: 40, lead: 'David K.' }
  ];

  // Command palette demo items
  const demoCommandItems = [
    { title: 'Create new urgent task in Sprint 34', icon: Zap, category: 'Actions', shortcut: 'C' },
    { title: 'Switch to Timeline / Gantt View', icon: Activity, category: 'Navigation', shortcut: 'G' },
    { title: 'Filter tasks assigned to me', icon: Users, category: 'Filters', shortcut: 'M' },
    { title: 'Toggle Offline PWA simulation', icon: Smartphone, category: 'Developer', shortcut: 'O' },
    { title: 'Export Sprint 34 velocity report to CSV', icon: BarChart3, category: 'Reports', shortcut: 'E' },
    { title: 'Open Security & Team RBAC settings', icon: ShieldCheck, category: 'Settings', shortcut: 'S' }
  ].filter(item => item.title.toLowerCase().includes(commandInput.toLowerCase()));

  const faqs = [
    {
      q: 'How is FlowSync different from Jira, Linear, or Asana?',
      a: 'FlowSync combines the instantaneous, keyboard-driven speed of modern developer tools with deep project management capabilities (native Gantt timelines, bidirectional calendar sync, and full offline PWA capability). Unlike legacy suites that take seconds to load, FlowSync operates with sub-50ms perceived latency and zero cognitive clutter.'
    },
    {
      q: 'Does FlowSync work completely offline?',
      a: 'Yes! FlowSync is engineered as a first-class Progressive Web App (PWA) with a dedicated Service Worker and client-side mutation queue. You can plan, create, edit, and organize tasks while offline on flights or trains. Changes synchronize automatically without conflicts the second your connection returns.'
    },
    {
      q: 'Is there a free plan for startups and solo builders?',
      a: 'Absolutely. The FlowSync Starter plan is 100% free forever for up to 10 team members. It includes unlimited tasks, projects, Kanban boards, calendar views, and offline PWA capability with no credit card required.'
    },
    {
      q: 'Can I install FlowSync on macOS, Windows, iOS, and Android?',
      a: 'Yes. Thanks to its responsive PWA architecture, you can install FlowSync directly to your desktop dock or mobile home screen from any modern browser with a single click. It launches in a standalone, distraction-free native window.'
    },
    {
      q: 'How does FlowSync ensure data privacy and enterprise security?',
      a: 'FlowSync utilizes bcrypt cryptographic hashing, secure NextAuth session tokens, automated verification codes, and strict role-based access control (RBAC). In our Enterprise tier, we provide SAML/SSO integration, custom audit logging, and isolated database connectivity.'
    },
    {
      q: 'How fast can our team migrate existing projects?',
      a: 'In minutes. FlowSync supports frictionless one-click imports from CSV, JSON, and standard issue trackers. Our clean, standardized schema ensures your tags, assignees, deadlines, and hierarchies carry over seamlessly.'
    }
  ];

  return (
    <div className="min-h-screen bg-white text-[#111111] selection:bg-blue-100 selection:text-blue-700 font-sans">
      {/* ========================================================================= */}
      {/* 1. STICKY GLASSMORPHIC NAVBAR */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 w-full border-b border-[#E5E7EB]/80 bg-white/90 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#2563EB] to-[#3B82F6] flex items-center justify-center shadow-md shadow-blue-500/25 transition-transform group-hover:scale-105">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M9 11l3 3L22 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <span className="font-bold text-[18px] tracking-tight text-[#111111]">
                Flow<span className="text-[#2563EB]">Sync</span>
              </span>
            </Link>

            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse"></span>
              v2.4 PWA Ready
            </span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#4B5563]">
            <a href="#features" className="hover:text-[#111111] transition-colors">Features</a>
            <a href="#demo" className="hover:text-[#111111] transition-colors">Interactive Demo</a>
            <a href="#views" className="hover:text-[#111111] transition-colors">Views & Gantt</a>
            <a href="#comparison" className="hover:text-[#111111] transition-colors">Why FlowSync</a>
            <a href="#pricing" className="hover:text-[#111111] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#111111] transition-colors">FAQ</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/"
                onClick={(e) => {
                  if (onLaunchApp) {
                    e.preventDefault();
                    onLaunchApp();
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-[13px] font-semibold shadow-md shadow-blue-600/20 hover:bg-[#1D4ED8] transition-all hover:shadow-lg hover:shadow-blue-600/30"
              >
                <span>Open Workspace</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-3.5 py-2 text-[13px] font-semibold text-[#374151] hover:text-[#111111] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-[13px] font-semibold shadow-md shadow-blue-600/25 hover:bg-[#1D4ED8] transition-all hover:scale-[1.02]"
                >
                  <span>Start Free</span>
                  <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[#4B5563] hover:text-[#111111] hover:bg-gray-100 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[#E5E7EB] bg-white px-4 pt-3 pb-5 space-y-3 shadow-xl animate-fade-in-up">
            <div className="flex flex-col gap-2.5 text-[15px] font-medium text-[#374151]">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="px-2 py-1.5 hover:text-[#2563EB]">Features</a>
              <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="px-2 py-1.5 hover:text-[#2563EB]">Interactive Demo</a>
              <a href="#views" onClick={() => setMobileMenuOpen(false)} className="px-2 py-1.5 hover:text-[#2563EB]">Views & Gantt</a>
              <a href="#comparison" onClick={() => setMobileMenuOpen(false)} className="px-2 py-1.5 hover:text-[#2563EB]">Why FlowSync</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="px-2 py-1.5 hover:text-[#2563EB]">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="px-2 py-1.5 hover:text-[#2563EB]">FAQ</a>
            </div>
            <div className="pt-3 border-t border-[#E5E7EB] flex flex-col gap-2">
              {isAuthenticated ? (
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-lg bg-[#2563EB] text-white text-[14px] font-semibold shadow-md"
                >
                  Open Workspace
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 rounded-lg border border-[#D1D5DB] text-[14px] font-semibold text-[#111111]"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 rounded-lg bg-[#2563EB] text-white text-[14px] font-semibold shadow-md"
                  >
                    Start Free with FlowSync
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 landing-grid-mesh">
        {/* Glowing Gradient Aura */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-400/20 via-indigo-400/15 to-purple-400/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Pill Announcement */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#2563EB] text-[12px] md:text-[13px] font-semibold shadow-sm mb-6 hover:bg-blue-100/70 transition-colors cursor-pointer">
            <Sparkles size={14} className="text-[#2563EB] shrink-0" />
            <span>Next-Gen Architecture: Offline PWA & SVG Gantt Canvas</span>
            <ChevronRight size={14} className="text-[#2563EB]" />
          </div>

          {/* Hero Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#111111] leading-[1.12] mb-6">
            Project management engineered for{' '}
            <span className="bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent">
              extreme velocity & craft.
            </span>
          </h1>

          {/* Hero Subtitle */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-[#4B5563] leading-relaxed mb-8">
            Eliminate the clutter of sluggish legacy trackers. FlowSync delivers sub-50ms task execution, fluid Kanban boards, native Gantt timelines, bidirectional calendar sync, and true offline PWA capability.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-10">
            {isAuthenticated ? (
              <Link
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#2563EB] text-white text-[15px] font-bold shadow-lg shadow-blue-600/30 hover:bg-[#1D4ED8] transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-600/40"
              >
                <span>Launch Your Workspace</span>
                <ArrowRight size={18} />
              </Link>
            ) : (
              <Link
                href="/auth/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#2563EB] text-white text-[15px] font-bold shadow-lg shadow-blue-600/30 hover:bg-[#1D4ED8] transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-600/40"
              >
                <span>Get Started Free</span>
                <ArrowRight size={18} />
              </Link>
            )}

            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-[#D1D5DB] bg-white text-[#111111] text-[15px] font-semibold hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all shadow-sm"
            >
              <Play size={16} className="text-[#2563EB] fill-[#2563EB]" />
              <span>Explore Interactive Demo</span>
            </a>
          </div>

          {/* Micro Trust Signals */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] md:text-[13px] text-[#6B7280]">
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600 font-bold" />
              Free tier forever
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600 font-bold" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600 font-bold" />
              Full Offline PWA support
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600 font-bold" />
              Instant 60-second setup
            </span>
          </div>

          {/* Social Proof Stats Strip */}
          <div className="mt-14 pt-10 border-t border-[#E5E7EB] grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight">&lt; 50ms</div>
              <div className="text-[12px] sm:text-[13px] text-[#6B7280] font-medium mt-1">Perceived UI Latency</div>
            </div>
            <div className="p-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight">10,000+</div>
              <div className="text-[12px] sm:text-[13px] text-[#6B7280] font-medium mt-1">High-Velocity Teams</div>
            </div>
            <div className="p-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight">99.99%</div>
              <div className="text-[12px] sm:text-[13px] text-[#6B7280] font-medium mt-1">Enterprise Uptime SLA</div>
            </div>
            <div className="p-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight">4.9 / 5</div>
              <div className="text-[12px] sm:text-[13px] text-[#6B7280] font-medium mt-1">1,200+ Developer Reviews</div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. LOGO MARQUEE */}
      {/* ========================================================================= */}
      <section className="py-8 border-y border-[#E5E7EB] bg-[#FAFAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-5">
            Engineered for high-performing engineering and product teams worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14 opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
            <div className="font-extrabold tracking-widest text-[16px] text-slate-800 flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-slate-800"></div> HYPERSCALE
            </div>
            <div className="font-extrabold tracking-widest text-[16px] text-slate-800 flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rotate-45 bg-slate-800"></div> VERTEX.IO
            </div>
            <div className="font-extrabold tracking-widest text-[16px] text-slate-800 flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-slate-800"></div> PRISM LABS
            </div>
            <div className="font-extrabold tracking-widest text-[16px] text-slate-800 flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-800"></div> DEVFLOW
            </div>
            <div className="font-extrabold tracking-widest text-[16px] text-slate-800 flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 bg-slate-800"></div> ACME CLOUD
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. INTERACTIVE PRODUCT SHOWCASE (CENTERPIECE) */}
      {/* ========================================================================= */}
      <section id="demo" className="py-20 bg-gradient-to-b from-white via-[#F8FAFC] to-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] text-[12px] font-bold uppercase tracking-wider mb-3">
              Interactive Live Preview
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111111]">
              Experience FlowSync before you sign up.
            </h2>
            <p className="mt-3 text-base text-[#4B5563]">
              Switch between Kanban, Gantt Timeline, Sprint Calendar, and Command Palette below to feel the instant responsiveness and clutter-free clarity.
            </p>
          </div>

          {/* Interactive Window Shell */}
          <div className="rounded-2xl border border-[#D1D5DB] bg-white shadow-2xl overflow-hidden transition-all">
            {/* macOS Chrome Header Bar */}
            <div className="bg-[#F3F4F6] border-b border-[#E5E7EB] px-4 py-3 flex items-center justify-between flex-wrap gap-3">
              {/* Traffic Light Dots */}
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#EF4444] inline-block shadow-sm"></span>
                <span className="w-3 h-3 rounded-full bg-[#F59E0B] inline-block shadow-sm"></span>
                <span className="w-3 h-3 rounded-full bg-[#10B981] inline-block shadow-sm"></span>
                <div className="ml-3 hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-[#E5E7EB] text-[12px] text-[#6B7280] font-mono">
                  <Lock size={12} className="text-emerald-600" />
                  <span>flowsync.app/workspace/sprint-34</span>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center bg-[#E5E7EB]/80 p-0.5 rounded-lg text-[12px] font-semibold">
                <button
                  onClick={() => setActiveDemoTab('kanban')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                    activeDemoTab === 'kanban'
                      ? 'bg-white text-[#111111] shadow-sm'
                      : 'text-[#4B5563] hover:text-[#111111]'
                  }`}
                >
                  <Kanban size={13} />
                  <span>Kanban</span>
                </button>

                <button
                  onClick={() => setActiveDemoTab('timeline')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                    activeDemoTab === 'timeline'
                      ? 'bg-white text-[#111111] shadow-sm'
                      : 'text-[#4B5563] hover:text-[#111111]'
                  }`}
                >
                  <Activity size={13} />
                  <span>Timeline</span>
                </button>

                <button
                  onClick={() => setActiveDemoTab('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                    activeDemoTab === 'calendar'
                      ? 'bg-white text-[#111111] shadow-sm'
                      : 'text-[#4B5563] hover:text-[#111111]'
                  }`}
                >
                  <Calendar size={13} />
                  <span>Calendar</span>
                </button>

                <button
                  onClick={() => setActiveDemoTab('command')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                    activeDemoTab === 'command'
                      ? 'bg-white text-[#111111] shadow-sm'
                      : 'text-[#4B5563] hover:text-[#111111]'
                  }`}
                >
                  <Terminal size={13} />
                  <span>Cmd+K</span>
                </button>
              </div>

              {/* Right status */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOfflineSimulatorActive(!offlineSimulatorActive)}
                  className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                    offlineSimulatorActive
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  }`}
                  title="Simulate PWA offline mode"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${offlineSimulatorActive ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></span>
                  <span>{offlineSimulatorActive ? 'PWA Offline Mode' : 'PWA Online Sync'}</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: KANBAN BOARD */}
            {activeDemoTab === 'kanban' && (
              <div className="p-4 sm:p-6 bg-[#FAFAFC] min-h-[480px]">
                {/* Secondary Kanban Filter Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#111111]">Sprint 34 Active Board</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100/70 text-[#2563EB] font-bold">12 Issues</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[12px]">
                    <span className="text-[#6B7280] mr-1 hidden sm:inline">Filter:</span>
                    {(['all', 'urgent', 'frontend', 'backend'] as const).map(filter => (
                      <button
                        key={filter}
                        onClick={() => setActiveKanbanFilter(filter)}
                        className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
                          activeKanbanFilter === filter
                            ? 'bg-[#111111] text-white'
                            : 'bg-white border border-[#E5E7EB] text-[#4B5563] hover:text-[#111111]'
                        }`}
                      >
                        {filter === 'all' ? 'All Tasks' : filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4 Column Kanban Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Column 1: Backlog */}
                  <div className="rounded-xl bg-white border border-[#E5E7EB] p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#F3F4F6]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                        <span className="text-[13px] font-bold text-[#111111]">Backlog</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#6B7280]">
                        {filteredTasks.filter(t => t.column === 'backlog').length}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {filteredTasks
                        .filter(t => t.column === 'backlog')
                        .map(task => (
                          <div
                            key={task.id}
                            onClick={() => setSelectedDemoTask(task)}
                            className="group p-3 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#2563EB] hover:shadow-md transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-mono font-semibold text-[#6B7280]">{task.id}</span>
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-[#2563EB]">
                                {task.tagLabel}
                              </span>
                            </div>
                            <h4 className="text-[13px] font-semibold text-[#111111] leading-snug group-hover:text-[#2563EB] transition-colors">
                              {task.title}
                            </h4>
                            <div className="mt-3 pt-2 border-t border-[#F3F4F6] flex items-center justify-between text-[11px] text-[#6B7280]">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-5 h-5 rounded-full ${task.avatarBg} text-white flex items-center justify-center text-[9px] font-bold`}>
                                  {task.avatar}
                                </span>
                                <span>{task.assignee}</span>
                              </div>
                              <span className="flex items-center gap-1 text-slate-500">
                                <CheckCircle2 size={11} /> {task.subtasks}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Column 2: In Progress */}
                  <div className="rounded-xl bg-white border border-[#E5E7EB] p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#F3F4F6]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                        <span className="text-[13px] font-bold text-[#111111]">In Progress</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#6B7280]">
                        {filteredTasks.filter(t => t.column === 'in_progress').length}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {filteredTasks
                        .filter(t => t.column === 'in_progress')
                        .map(task => (
                          <div
                            key={task.id}
                            onClick={() => setSelectedDemoTask(task)}
                            className="group p-3 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#2563EB] hover:shadow-md transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-mono font-semibold text-[#6B7280]">{task.id}</span>
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                task.priority === 'urgent' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                            <h4 className="text-[13px] font-semibold text-[#111111] leading-snug group-hover:text-[#2563EB] transition-colors">
                              {task.title}
                            </h4>
                            <div className="mt-3 pt-2 border-t border-[#F3F4F6] flex items-center justify-between text-[11px] text-[#6B7280]">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-5 h-5 rounded-full ${task.avatarBg} text-white flex items-center justify-center text-[9px] font-bold`}>
                                  {task.avatar}
                                </span>
                                <span>{task.assignee}</span>
                              </div>
                              <span className="text-amber-600 font-semibold">{task.dueDate}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Column 3: In Review */}
                  <div className="rounded-xl bg-white border border-[#E5E7EB] p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#F3F4F6]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span className="text-[13px] font-bold text-[#111111]">In Review</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#6B7280]">
                        {filteredTasks.filter(t => t.column === 'review').length}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {filteredTasks
                        .filter(t => t.column === 'review')
                        .map(task => (
                          <div
                            key={task.id}
                            onClick={() => setSelectedDemoTask(task)}
                            className="group p-3 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#2563EB] hover:shadow-md transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-mono font-semibold text-[#6B7280]">{task.id}</span>
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                                {task.tagLabel}
                              </span>
                            </div>
                            <h4 className="text-[13px] font-semibold text-[#111111] leading-snug group-hover:text-[#2563EB] transition-colors">
                              {task.title}
                            </h4>
                            <div className="mt-3 pt-2 border-t border-[#F3F4F6] flex items-center justify-between text-[11px] text-[#6B7280]">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-5 h-5 rounded-full ${task.avatarBg} text-white flex items-center justify-center text-[9px] font-bold`}>
                                  {task.avatar}
                                </span>
                                <span>{task.assignee}</span>
                              </div>
                              <span className="text-emerald-600 font-semibold">Ready</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Column 4: Done */}
                  <div className="rounded-xl bg-white border border-[#E5E7EB] p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#F3F4F6]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span className="text-[13px] font-bold text-[#111111]">Done</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#6B7280]">
                        {filteredTasks.filter(t => t.column === 'done').length}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {filteredTasks
                        .filter(t => t.column === 'done')
                        .map(task => (
                          <div
                            key={task.id}
                            onClick={() => setSelectedDemoTask(task)}
                            className="group p-3 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#2563EB] hover:shadow-md transition-all cursor-pointer opacity-80 hover:opacity-100"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-mono font-semibold text-[#6B7280]">{task.id}</span>
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                Completed
                              </span>
                            </div>
                            <h4 className="text-[13px] font-semibold text-[#111111] line-through leading-snug">
                              {task.title}
                            </h4>
                            <div className="mt-3 pt-2 border-t border-[#F3F4F6] flex items-center justify-between text-[11px] text-[#6B7280]">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-5 h-5 rounded-full ${task.avatarBg} text-white flex items-center justify-center text-[9px] font-bold`}>
                                  {task.avatar}
                                </span>
                                <span>{task.assignee}</span>
                              </div>
                              <span className="text-emerald-600 font-bold">✓ 100%</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Micro interaction hint */}
                <div className="mt-4 pt-3 text-center text-[12px] text-[#6B7280]">
                  💡 <em>Click any task card to simulate instant drawer inspection. Try toggling filters above!</em>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: TIMELINE & GANTT */}
            {activeDemoTab === 'timeline' && (
              <div className="p-4 sm:p-6 bg-[#FAFAFC] min-h-[480px]">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#E5E7EB]">
                  <div>
                    <h3 className="text-[15px] font-bold text-[#111111]">Sprint 34 Multi-Track Roadmap</h3>
                    <p className="text-[12px] text-[#6B7280]">Visual critical paths and milestone dependencies</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#6B7280]">Scale:</span>
                    <button
                      onClick={() => setTimelineZoom('days')}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                        timelineZoom === 'days' ? 'bg-[#2563EB] text-white' : 'bg-white border text-[#4B5563]'
                      }`}
                    >
                      Days
                    </button>
                    <button
                      onClick={() => setTimelineZoom('weeks')}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                        timelineZoom === 'weeks' ? 'bg-[#2563EB] text-white' : 'bg-white border text-[#4B5563]'
                      }`}
                    >
                      Weeks
                    </button>
                  </div>
                </div>

                {/* Gantt Timeline Mock Visualizer */}
                <div className="space-y-4">
                  {/* Timeline Days Header Grid */}
                  <div className="grid grid-cols-7 gap-1 text-[11px] font-bold text-[#9CA3AF] uppercase text-center pb-2 border-b border-[#E5E7EB]">
                    <div>Sep 21 (Mon)</div>
                    <div>Sep 22 (Tue)</div>
                    <div>Sep 23 (Wed)</div>
                    <div className="text-[#2563EB]">Sep 24 (Today)</div>
                    <div>Sep 25 (Fri)</div>
                    <div>Sep 26 (Sat)</div>
                    <div>Sep 27 (Sun)</div>
                  </div>

                  {/* Timeline Gantt Tracks */}
                  {demoTimelineItems.map((item, idx) => (
                    <div key={idx} className="group relative bg-white border border-[#E5E7EB] rounded-lg p-3 hover:shadow-sm transition-all">
                      <div className="flex items-center justify-between text-[13px] font-semibold text-[#111111] mb-2">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          {item.title}
                        </span>
                        <div className="flex items-center gap-3 text-[11px] text-[#6B7280]">
                          <span>Lead: <strong>{item.lead}</strong></span>
                          <span className="font-bold text-[#2563EB]">{item.progress}%</span>
                        </div>
                      </div>

                      {/* Visual Gantt Bar */}
                      <div className="w-full bg-[#F3F4F6] h-6 rounded-md relative overflow-hidden flex items-center">
                        <div
                          className={`h-full ${item.color} rounded-md transition-all duration-500 relative flex items-center justify-between px-2 text-white text-[10px] font-bold`}
                          style={{
                            marginLeft: `${item.start}%`,
                            width: `${item.width}%`
                          }}
                        >
                          <span className="truncate">{item.title}</span>
                          <span className="shrink-0">{item.progress}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: SMART CALENDAR */}
            {activeDemoTab === 'calendar' && (
              <div className="p-4 sm:p-6 bg-[#FAFAFC] min-h-[480px]">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#E5E7EB]">
                  <div>
                    <h3 className="text-[15px] font-bold text-[#111111]">September 2026 Sprint Schedule</h3>
                    <p className="text-[12px] text-[#6B7280]">Deliverable deadlines & release gates</p>
                  </div>
                  <div className="text-[12px] font-bold text-[#2563EB] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                    Selected: Sep {calendarSelectedDay}, 2026
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-[11px] font-bold text-[#9CA3AF] py-1">{day}</div>
                  ))}

                  {/* Days 20 to 30 */}
                  {[20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map(day => {
                    const isToday = day === 24;
                    const isSelected = day === calendarSelectedDay;
                    return (
                      <div
                        key={day}
                        onClick={() => setCalendarSelectedDay(day)}
                        className={`h-20 p-1.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#2563EB] bg-blue-50/60 ring-2 ring-blue-500/20 shadow-sm'
                            : isToday
                            ? 'border-blue-300 bg-white'
                            : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[12px] font-bold ${isToday ? 'text-[#2563EB]' : 'text-[#374151]'}`}>
                            {day}
                          </span>
                          {isToday && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-blue-600 text-white font-bold">TODAY</span>
                          )}
                        </div>

                        {/* Event chips */}
                        {day === 24 && (
                          <div className="truncate text-[10px] font-semibold px-1 py-0.5 rounded bg-blue-600 text-white">
                            PWA Release v2.4
                          </div>
                        )}
                        {day === 22 && (
                          <div className="truncate text-[10px] font-semibold px-1 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            Token Specs Done
                          </div>
                        )}
                        {day === 26 && (
                          <div className="truncate text-[10px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-800">
                            Security Signoff
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: COMMAND PALETTE (CMD+K) */}
            {activeDemoTab === 'command' && (
              <div className="p-6 sm:p-10 bg-[#FAFAFC] min-h-[480px] flex flex-col items-center justify-center">
                <div className="w-full max-w-xl bg-white border border-[#D1D5DB] rounded-xl shadow-xl overflow-hidden animate-fade-in-up">
                  {/* Search Input Bar */}
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E5E7EB] bg-white">
                    <Search size={18} className="text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder="Type a command or search tasks, views, projects..."
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      className="w-full text-[14px] outline-none text-[#111111] placeholder:text-[#9CA3AF]"
                      autoFocus
                    />
                    <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-[#F3F4F6] text-[#6B7280] rounded border border-[#E5E7EB]">
                      ESC
                    </kbd>
                  </div>

                  {/* Filtered Command Options */}
                  <div className="p-2 divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {demoCommandItems.length > 0 ? (
                      demoCommandItems.map((item, i) => {
                        const IconComponent = item.icon;
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-blue-50/80 cursor-pointer group transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-md bg-gray-100 group-hover:bg-[#2563EB] group-hover:text-white flex items-center justify-center text-gray-600 transition-colors">
                                <IconComponent size={14} />
                              </div>
                              <span className="text-[13px] font-semibold text-[#111111] group-hover:text-[#2563EB]">
                                {item.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-[#9CA3AF] uppercase font-bold">{item.category}</span>
                              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#F3F4F6] text-[#4B5563] rounded border">
                                {item.shortcut}
                              </kbd>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-[13px] text-[#6B7280]">
                        No matching commands found for &quot;{commandInput}&quot;
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. BENTO GRID OF CORE INNOVATIONS */}
      {/* ========================================================================= */}
      <section id="features" className="py-24 bg-white border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] text-[12px] font-bold uppercase tracking-wider mb-3">
              Engineered From First Principles
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111111]">
              Everything you need. Nothing you don&apos;t.
            </h2>
            <p className="mt-3 text-base text-[#4B5563]">
              Built with mathematical discipline: O(1) indexed state, cursor pagination, zero quadratic loops, and responsive PWA ergonomics.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Large Bento (Offline-First PWA) */}
            <div className="md:col-span-2 rounded-2xl border border-[#E5E7EB] bg-gradient-to-br from-[#FAFAFC] to-[#F1F5F9] p-8 shadow-xs hover:shadow-md transition-all relative overflow-hidden">
              <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-6 shadow-md shadow-blue-500/20">
                <Smartphone size={22} />
              </div>
              <h3 className="text-xl font-bold text-[#111111] mb-2">
                Offline-First Progressive Web App (PWA)
              </h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed mb-6 max-w-xl">
                Plane, subway, or unreliable conference Wi-Fi? FlowSync keeps you in the flow. Our built-in Service Worker stores state locally in IndexedDB and replays mutations seamlessly when connection restores.
              </p>

              <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-[#111111]">
                <span className="px-3 py-1 rounded-full bg-white border border-[#E5E7EB] shadow-2xs">✓ Service Worker Background Sync</span>
                <span className="px-3 py-1 rounded-full bg-white border border-[#E5E7EB] shadow-2xs">✓ Instant Install to macOS & Windows</span>
                <span className="px-3 py-1 rounded-full bg-white border border-[#E5E7EB] shadow-2xs">✓ Zero Data Loss Mutation Queue</span>
              </div>
            </div>

            {/* Card 2: ⌘K Command Engine */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFC] p-8 shadow-xs hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-6 shadow-md shadow-indigo-500/20">
                <Terminal size={22} />
              </div>
              <h3 className="text-xl font-bold text-[#111111] mb-2">
                Universal Command Engine (⌘K)
              </h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed mb-4">
                Navigate the entire application at the speed of thought. Search across 10,000+ tasks, reassign tickets, or jump views without lifting your fingers from the home row.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-200/70 font-mono text-[11px] font-bold text-[#374151]">
                <span>Ctrl + K</span> / <span>Cmd + K</span>
              </div>
            </div>

            {/* Card 3: Deep Timeline & Gantt */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFC] p-8 shadow-xs hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-6 shadow-md shadow-purple-500/20">
                <Activity size={22} />
              </div>
              <h3 className="text-xl font-bold text-[#111111] mb-2">
                Multi-Track Gantt Canvas
              </h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                Native SVG Gantt engine designed for product managers who need real milestone tracking, critical path mapping, and sprint dependency lines without third-party bloated libraries.
              </p>
            </div>

            {/* Card 4: Bi-Directional Calendar Engine */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFC] p-8 shadow-xs hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-6 shadow-md shadow-emerald-500/20">
                <Calendar size={22} />
              </div>
              <h3 className="text-xl font-bold text-[#111111] mb-2">
                Bi-Directional Calendar Sync
              </h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                Seamless drag-and-drop monthly planning with clash detection, team workload heatmap badges, and scheduled release freeze guardrails.
              </p>
            </div>

            {/* Card 5: Enterprise Security & RBAC */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFC] p-8 shadow-xs hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-amber-600 text-white flex items-center justify-center mb-6 shadow-md shadow-amber-500/20">
                <ShieldCheck size={22} />
              </div>
              <h3 className="text-xl font-bold text-[#111111] mb-2">
                Enterprise RBAC & Security
              </h3>
              <p className="text-[14px] text-[#4B5563] leading-relaxed">
                Bcrypt password hashing, NextAuth session tokens, automated 6-digit OTP verification, and granular member roles (Owner, Admin, Member, Viewer).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. DIRECT HEAD-TO-HEAD COMPARISON TABLE */}
      {/* ========================================================================= */}
      <section id="comparison" className="py-24 bg-[#FAFAFC] border-t border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] text-[12px] font-bold uppercase tracking-wider mb-3">
              Honest Comparison
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111111]">
              Why teams are replacing legacy suites with FlowSync.
            </h2>
            <p className="mt-3 text-base text-[#4B5563]">
              Compare how FlowSync stacks up against traditional project management tools.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[12px] font-bold text-[#4B5563] uppercase">
                    <th className="py-4 px-6">Capability</th>
                    <th className="py-4 px-6 text-[#2563EB] font-extrabold bg-blue-50/60">FlowSync</th>
                    <th className="py-4 px-6">Jira</th>
                    <th className="py-4 px-6">Asana</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-[13px]">
                  <tr>
                    <td className="py-4 px-6 font-semibold text-[#111111]">Perceived UI Latency</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 bg-blue-50/30">&lt; 50ms (Optimistic)</td>
                    <td className="py-4 px-6 text-[#6B7280]">1,200ms – 3,500ms</td>
                    <td className="py-4 px-6 text-[#6B7280]">400ms – 900ms</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-[#111111]">Offline PWA Support</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 bg-blue-50/30">✓ Full Native Service Worker</td>
                    <td className="py-4 px-6 text-red-500 font-medium">✗ Requires Connection</td>
                    <td className="py-4 px-6 text-amber-600 font-medium">⚠️ Limited Mobile Only</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-[#111111]">Universal Command Bar (⌘K)</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 bg-blue-50/30">✓ Built-in Keyboard Engine</td>
                    <td className="py-4 px-6 text-[#6B7280]">Partial / Slow search</td>
                    <td className="py-4 px-6 text-[#6B7280]">Basic search only</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-[#111111]">Native Gantt Timeline</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 bg-blue-50/30">✓ Included in All Plans</td>
                    <td className="py-4 px-6 text-[#6B7280]">Complex / Add-on required</td>
                    <td className="py-4 px-6 text-[#6B7280]">Locked behind higher tier</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-[#111111]">Visual Noise & Clutter</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 bg-blue-50/30">Zero (Linear/Supabase aesthetic)</td>
                    <td className="py-4 px-6 text-[#6B7280]">Heavy dropdowns & nested tabs</td>
                    <td className="py-4 px-6 text-[#6B7280]">Moderate clutter</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-[#111111]">Time to Onboard Team</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 bg-blue-50/30">&lt; 60 seconds</td>
                    <td className="py-4 px-6 text-[#6B7280]">Days / Consultant needed</td>
                    <td className="py-4 px-6 text-[#6B7280]">Hours</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. CUSTOMER TESTIMONIALS */}
      {/* ========================================================================= */}
      <section className="py-24 bg-white border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#111111]">
              Trusted by leaders shipping software that matters.
            </h2>
            <p className="mt-3 text-base text-[#4B5563]">
              Read how engineering leaders and product designers transformed their daily workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFC] p-7 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="text-[14px] text-[#374151] leading-relaxed mb-6">
                  &ldquo;We migrated our entire 45-person engineering team away from Jira to FlowSync. We shaved 40 minutes off every weekly sprint planning meeting because the UI is instantaneous and doesn&apos;t fight you.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-[#E5E7EB]">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[13px]">
                  AR
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-[#111111]">Alex Rivera</h4>
                  <p className="text-[11px] text-[#6B7280]">VP of Engineering, ScaleByte</p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFC] p-7 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="text-[14px] text-[#374151] leading-relaxed mb-6">
                  &ldquo;The offline PWA capability is a godsend. I can review tickets and reschedule roadmap milestones during my cross-country flights without any Wi-Fi. The second I land, everything syncs instantly.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-[#E5E7EB]">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[13px]">
                  ER
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-[#111111]">Elena Rostova</h4>
                  <p className="text-[11px] text-[#6B7280]">Staff Product Manager, CloudGrid</p>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFC] p-7 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="text-[14px] text-[#374151] leading-relaxed mb-6">
                  &ldquo;FlowSync hits the sweet spot between extreme keyboard speed and visual depth. The Gantt timeline combined with the Cmd+K command palette makes managing multi-month releases feel effortless.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-[#E5E7EB]">
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[13px]">
                  MV
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-[#111111]">Marcus Vance</h4>
                  <p className="text-[11px] text-[#6B7280]">CTO & Co-founder, HyperPulse</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. TRANSPARENT PRICING */}
      {/* ========================================================================= */}
      <section id="pricing" className="py-24 bg-[#FAFAFC] border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] text-[12px] font-bold uppercase tracking-wider mb-3">
              Simple, Transparent Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111111]">
              Pick the plan that accelerates your team.
            </h2>
            <p className="mt-3 text-base text-[#4B5563]">
              Start free today. Scale effortlessly when you need advanced security and enterprise SLAs.
            </p>

            {/* Billing Toggle */}
            <div className="mt-8 inline-flex items-center p-1 rounded-xl bg-gray-200/80 border border-[#E5E7EB]">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-[#111111] shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                  billingCycle === 'annual'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                <span>Annual Billing</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                  billingCycle === 'annual' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#111111]">Starter</h3>
                <p className="text-[13px] text-[#6B7280] mt-1">For individuals and early-stage teams.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-[#111111]">$0</span>
                  <span className="text-[13px] text-[#6B7280] font-medium">/ member / month</span>
                </div>
                <div className="text-[12px] text-[#16A34A] font-semibold mt-1">Free forever, no card needed</div>

                <div className="mt-8 space-y-3 text-[13px] text-[#374151]">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Up to 10 team members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Unlimited tasks & projects</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Fluid Kanban & List views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Bi-directional Calendar view</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Full Offline PWA capability</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  href="/auth/signup"
                  className="w-full block text-center py-2.5 rounded-xl border border-[#D1D5DB] text-[14px] font-bold text-[#111111] hover:bg-[#F9FAFB] transition-all"
                >
                  Start Free
                </Link>
              </div>
            </div>

            {/* Pro Plan (Highlighted) */}
            <div className="rounded-2xl border-2 border-[#2563EB] bg-white p-8 shadow-xl relative flex flex-col justify-between">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#2563EB] text-white text-[11px] font-extrabold uppercase tracking-wide shadow-sm">
                Most Popular
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#111111]">Pro</h3>
                <p className="text-[13px] text-[#6B7280] mt-1">For fast-moving engineering teams.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-[#111111]">
                    {billingCycle === 'annual' ? '$10' : '$12'}
                  </span>
                  <span className="text-[13px] text-[#6B7280] font-medium">/ member / month</span>
                </div>
                <div className="text-[12px] text-[#6B7280] mt-1">
                  {billingCycle === 'annual' ? 'Billed annually ($120/yr)' : 'Billed monthly'}
                </div>

                <div className="mt-8 space-y-3 text-[13px] text-[#374151]">
                  <div className="flex items-center gap-2 font-semibold text-[#111111]">
                    <Check size={16} className="text-[#2563EB] shrink-0 font-bold" />
                    <span>Everything in Starter, plus:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Native Gantt Timeline canvas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Advanced Velocity & Burndown charts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Custom tags & workflow automations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Priority email & Slack support</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  href="/auth/signup"
                  className="w-full block text-center py-2.5 rounded-xl bg-[#2563EB] text-white text-[14px] font-bold shadow-md shadow-blue-600/30 hover:bg-[#1D4ED8] transition-all"
                >
                  Start 14-Day Pro Trial
                </Link>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#111111]">Enterprise</h3>
                <p className="text-[13px] text-[#6B7280] mt-1">For scale-ups and security-first orgs.</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-[#111111]">
                    {billingCycle === 'annual' ? '$32' : '$39'}
                  </span>
                  <span className="text-[13px] text-[#6B7280] font-medium">/ member / month</span>
                </div>
                <div className="text-[12px] text-[#6B7280] mt-1">Billed annually or custom invoice</div>

                <div className="mt-8 space-y-3 text-[13px] text-[#374151]">
                  <div className="flex items-center gap-2 font-semibold text-[#111111]">
                    <Check size={16} className="text-[#2563EB] shrink-0 font-bold" />
                    <span>Everything in Pro, plus:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>SAML / SSO (Okta, Azure AD, Google)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>99.99% Guaranteed Uptime SLA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Dedicated Solutions Architect</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Custom data retention & audit logs</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <a
                  href="mailto:enterprise@flowsync.io"
                  className="w-full block text-center py-2.5 rounded-xl border border-[#D1D5DB] text-[14px] font-bold text-[#111111] hover:bg-[#F9FAFB] transition-all"
                >
                  Contact Enterprise Sales
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. INTERACTIVE FAQ ACCORDION */}
      {/* ========================================================================= */}
      <section id="faq" className="py-24 bg-white border-t border-[#E5E7EB]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] text-[12px] font-bold uppercase tracking-wider mb-3">
              Frequently Asked Questions
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#111111]">
              Got questions? We&apos;ve got answers.
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFC] overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-[15px] text-[#111111] hover:text-[#2563EB] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={18}
                      className={`text-[#6B7280] transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-[#2563EB]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-[14px] text-[#4B5563] leading-relaxed border-t border-[#F3F4F6] pt-3 animate-fade-in-up">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. PRE-FOOTER HIGH-CONVERSION CTA BANNER */}
      {/* ========================================================================= */}
      <section className="py-20 bg-gradient-to-tr from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white relative overflow-hidden">
        <div className="absolute inset-0 landing-dark-mesh opacity-20 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[12px] font-bold uppercase tracking-wider mb-6 border border-blue-400/30">
            <Sparkles size={13} />
            Start Shipping at 60 FPS Today
          </span>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
            Ready to build better software, faster?
          </h2>

          <p className="max-w-xl mx-auto text-base sm:text-lg text-slate-300 mb-8 leading-relaxed">
            Join over 10,000 product engineers, managers, and designers who chose FlowSync to eliminate project clutter and accelerate sprint delivery.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#2563EB] text-white text-[15px] font-bold shadow-lg shadow-blue-500/30 hover:bg-[#1D4ED8] transition-all hover:scale-105"
            >
              <span>Get Started Free — Takes 30s</span>
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white text-[15px] font-semibold hover:bg-slate-700 transition-all"
            >
              Sign In to Existing Account
            </Link>
          </div>

          <div className="mt-8 text-[12px] text-slate-400">
            Free forever tier • Zero setup fees • Enterprise-grade encryption
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 11. COMPREHENSIVE MULTI-COLUMN FOOTER */}
      {/* ========================================================================= */}
      <footer className="bg-white border-t border-[#E5E7EB] pt-16 pb-12 text-[#4B5563] text-[13px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            {/* Brand Col */}
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                    <path d="M9 11l3 3L22 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                <span className="font-bold text-[17px] tracking-tight text-[#111111]">
                  Flow<span className="text-[#2563EB]">Sync</span>
                </span>
              </div>
              <p className="max-w-sm text-[#6B7280] leading-relaxed mb-4">
                The next-generation project management suite engineered for high-velocity software craft. Sub-50ms latency, native Gantt, and offline PWA capability.
              </p>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>All systems operational (99.99%)</span>
              </div>
            </div>

            {/* Col 2: Product */}
            <div>
              <h4 className="font-bold text-[12px] uppercase tracking-wider text-[#111111] mb-3">Product</h4>
              <ul className="space-y-2.5">
                <li><a href="#features" className="hover:text-[#111111] transition-colors">Features</a></li>
                <li><a href="#demo" className="hover:text-[#111111] transition-colors">Interactive Demo</a></li>
                <li><a href="#views" className="hover:text-[#111111] transition-colors">Gantt & Timeline</a></li>
                <li><a href="#demo" className="hover:text-[#111111] transition-colors">Kanban Boards</a></li>
                <li><a href="#pricing" className="hover:text-[#111111] transition-colors">Pricing & Plans</a></li>
              </ul>
            </div>

            {/* Col 3: Resources */}
            <div>
              <h4 className="font-bold text-[12px] uppercase tracking-wider text-[#111111] mb-3">Resources</h4>
              <ul className="space-y-2.5">
                <li><a href="#faq" className="hover:text-[#111111] transition-colors">Documentation</a></li>
                <li><a href="#faq" className="hover:text-[#111111] transition-colors">Keyboard Shortcuts</a></li>
                <li><a href="#features" className="hover:text-[#111111] transition-colors">Offline PWA Guide</a></li>
                <li><a href="#faq" className="hover:text-[#111111] transition-colors">API Reference</a></li>
                <li><a href="#comparison" className="hover:text-[#111111] transition-colors">Migration Guide</a></li>
              </ul>
            </div>

            {/* Col 4: Company & Legal */}
            <div>
              <h4 className="font-bold text-[12px] uppercase tracking-wider text-[#111111] mb-3">Company</h4>
              <ul className="space-y-2.5">
                <li><a href="#features" className="hover:text-[#111111] transition-colors">About FlowSync</a></li>
                <li><a href="#comparison" className="hover:text-[#111111] transition-colors">Security Whitepaper</a></li>
                <li><a href="#faq" className="hover:text-[#111111] transition-colors">Privacy Policy</a></li>
                <li><a href="#faq" className="hover:text-[#111111] transition-colors">Terms of Service</a></li>
                <li><a href="mailto:support@flowsync.io" className="hover:text-[#111111] transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[#9CA3AF]">
            <div>
              © {new Date().getFullYear()} FlowSync Technologies Inc. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span>Next.js 15 App Router</span>
              <span>•</span>
              <span>PWA Offline Ready</span>
              <span>•</span>
              <span>SOC2 Compliant Architecture</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Task Drawer Simulation Modal inside interactive demo */}
      {selectedDemoTask && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in-up">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] p-6 relative">
            <button
              onClick={() => setSelectedDemoTask(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-mono font-bold text-[#6B7280]">{selectedDemoTask.id}</span>
              <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-[#2563EB]">
                {selectedDemoTask.tagLabel}
              </span>
            </div>

            <h3 className="text-lg font-bold text-[#111111] mb-4">
              {selectedDemoTask.title}
            </h3>

            <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-[12px] mb-4">
              <div>
                <span className="text-[#6B7280] block text-[11px]">Assignee</span>
                <span className="font-semibold text-[#111111]">{selectedDemoTask.assignee}</span>
              </div>
              <div>
                <span className="text-[#6B7280] block text-[11px]">Priority</span>
                <span className="font-bold text-red-600 uppercase">{selectedDemoTask.priority}</span>
              </div>
              <div>
                <span className="text-[#6B7280] block text-[11px]">Status</span>
                <span className="font-semibold text-blue-600 capitalize">{selectedDemoTask.column.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[#6B7280] block text-[11px]">Due Date</span>
                <span className="font-semibold text-[#111111]">{selectedDemoTask.dueDate}</span>
              </div>
            </div>

            <p className="text-[13px] text-[#4B5563] leading-relaxed mb-6">
              This interactive ticket demo showcases FlowSync&apos;s instant drawer preview. In the full workspace, tasks support rich markdown descriptions, subtask checklists, dynamic tags, file attachments, and audit history.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedDemoTask(null)}
                className="px-4 py-2 text-[13px] font-semibold text-[#4B5563] hover:text-[#111111]"
              >
                Close Preview
              </button>
              <Link
                href="/auth/signup"
                className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors"
              >
                Try Full App Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
