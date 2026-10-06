'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowRight,
  ChevronDown,
  Check,
  Plus,
  Minus,
  Menu,
  X,
  Compass,
  Sliders,
  Sparkles,
  Layers,
  Activity,
  CheckCircle2,
  Clock,
  Flame,
  Star,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  TrendingUp,
  GitBranch,
  MessageSquare,
  Users,
} from 'lucide-react';
import { animate, stagger } from 'animejs';
import { LiquidGlassCard, LiquidButton } from '@/components/kokonutui/liquid-glass-card';
import PWAModal from '@/components/PWAModal';

interface LandingPageProps {
  onLaunchApp?: () => void;
}

export default function LandingPage({ onLaunchApp }: LandingPageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';

  // Navigation states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isPWAModalOpen, setIsPWAModalOpen] = useState(false);

  // Hero interactive task demo states
  const [tasksCompleted, setTasksCompleted] = useState<Record<string, boolean>>({
    task1: true,
    task2: false,
    task3: false,
  });

  // Animated counters reference
  const counterRef = useRef<HTMLDivElement>(null);
  const [counters, setCounters] = useState({ users: 0, uptime: 0, tasks: 0 });

  // Seamless redirect if authenticated
  useEffect(() => {
    if (status === 'authenticated' && typeof window !== 'undefined' && window.location.pathname === '/') {
      router.replace('/app');
    }
  }, [status, router]);

  // Anime.js: Hero Entrance & Floating Background Orbs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Hero Stagger Entrance
    try {
      animate('.anime-hero-fade', {
        opacity: [0, 1],
        translateY: [28, 0],
        delay: stagger(90),
        duration: 850,
        ease: 'outExpo',
      });
    } catch (e) {
      console.warn('Anime hero entrance fallback:', e);
    }

    // 2. Floating Liquid Mesh / Ambient Glow Orbs
    try {
      animate('.anime-orb-1', {
        translateX: [-25, 25],
        translateY: [-20, 20],
        scale: [1, 1.15],
        duration: 6500,
        direction: 'alternate',
        loop: true,
        ease: 'inOutQuad',
      });

      animate('.anime-orb-2', {
        translateX: [25, -25],
        translateY: [20, -20],
        scale: [1.1, 0.95],
        duration: 7500,
        direction: 'alternate',
        loop: true,
        ease: 'inOutQuad',
      });

      animate('.anime-orb-3', {
        translateX: [-15, 20],
        translateY: [15, -15],
        duration: 8500,
        direction: 'alternate',
        loop: true,
        ease: 'inOutQuad',
      });
    } catch (e) {
      console.warn('Anime orbs fallback:', e);
    }

    // 3. Counter Animation on Mount
    const counterObj = { users: 0, uptime: 0, tasks: 0 };
    try {
      animate(counterObj, {
        users: 5000,
        uptime: 99.9,
        tasks: 148,
        duration: 1800,
        ease: 'outExpo',
        onUpdate: () => {
          setCounters({
            users: Math.round(counterObj.users),
            uptime: Number(counterObj.uptime.toFixed(1)),
            tasks: Math.round(counterObj.tasks),
          });
        },
      });
    } catch {
      setCounters({ users: 5000, uptime: 99.9, tasks: 148 });
    }
  }, []);

  // Anime.js: Smooth Feature Switch Animation
  const featureShowcaseRef = useRef<HTMLDivElement>(null);
  const handleFeatureChange = (index: number) => {
    setActiveFeatureIndex(index);
    if (typeof window !== 'undefined' && featureShowcaseRef.current) {
      try {
        animate(featureShowcaseRef.current, {
          opacity: [0.65, 1],
          scale: [0.98, 1],
          duration: 350,
          ease: 'outQuad',
        });
      } catch {
        // Fallback
      }
    }
  };

  const handleLaunch = () => {
    if (onLaunchApp) {
      onLaunchApp();
    } else {
      router.push(isAuthenticated ? '/app' : '/auth/login');
    }
  };

  const toggleTaskCompletion = (taskId: string) => {
    setTasksCompleted(prev => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // Feature items matching KokonutUI Lume template structure
  const features = [
    {
      id: 'analytics',
      title: 'Advanced Analytics',
      icon: Compass,
      accent: 'text-blue-500 dark:text-blue-400',
      description:
        'Get deep insights into your team velocity with powerful analytics tools. Track sprint metrics, cycle times, burn-down rates, and make data-driven decisions with ease.',
    },
    {
      id: 'automation',
      title: 'Smart Automation',
      icon: Sliders,
      accent: 'text-purple-500 dark:text-purple-400',
      description:
        'Eliminate repetitive manual tasks. Automatically move cards based on commit hooks, trigger notification channels, auto-assign reviewers, and enforce team workflow rules.',
    },
    {
      id: 'collaboration',
      title: 'Team Collaboration',
      icon: Layers,
      accent: 'text-emerald-500 dark:text-emerald-400',
      description:
        'Keep distributed teams perfectly synchronized with live cursor presence, instant subtask updates, threaded inline comments, and seamless cross-project tagging.',
    },
    {
      id: 'sprints',
      title: 'Context-Aware Sprints',
      icon: Sparkles,
      accent: 'text-amber-500 dark:text-amber-400',
      description:
        'AI models analyze issue descriptions, link related GitHub pull requests, forecast completion velocity, and synthesize end-of-week release notes without extra work.',
    },
  ];

  // FAQs matching Lume numbered format (001), (002), etc.
  const faqs = [
    {
      number: '001',
      question: 'How does context understanding work in TaskFlow?',
      answer:
        'TaskFlow maintains project context across tasks, documents, and sprints. It analyzes related issues, pull request links, and blocker dependencies, allowing teams to instantly see root causes and summarize weekly progress.',
    },
    {
      number: '002',
      question: 'Can I switch between or import from Jira, Linear, or Trello?',
      answer:
        'Yes. TaskFlow includes one-click migration importers for Linear, Jira, and CSV datasets. Your team tags, assignees, priorities, and descriptions are preserved and organized instantly.',
    },
    {
      number: '003',
      question: 'What happens to my data and privacy?',
      answer:
        'Your data is encrypted both in transit (TLS 1.3) and at rest (AES-256). We never train public AI models on customer tasks or proprietary company code. Enterprise private clouds and on-premise deployments are fully supported.',
    },
    {
      number: '004',
      question: 'Does TaskFlow work offline on mobile and desktop?',
      answer:
        'Yes! TaskFlow is a fully featured Progressive Web App (PWA) with service-worker caching and offline sync. You can install it natively on iOS, Android, macOS, and Windows to work anywhere with zero latency.',
    },
    {
      number: '005',
      question: 'Can I switch between different AI models?',
      answer:
        'Yes. TaskFlow integrates seamlessly with Anthropic Claude, OpenAI GPT, Google Gemini, and Grok. You can configure custom API keys or leverage our managed inference router for sprint generation.',
    },
    {
      number: '006',
      question: 'What is included in the 14-day free trial?',
      answer:
        'The free trial gives you full access to all Pro features—including unlimited tasks, Kanban and Calendar views, sprint velocity analytics, workflow automations, and team invite seats. No credit card is required to begin.',
    },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white text-black selection:bg-black/10 selection:text-black dark:bg-black dark:text-white dark:selection:bg-white/20 dark:selection:text-white font-sans tracking-tight">
      {/* ─────────────────────────────────────────────────────────────────────────
          BACKGROUND AMBIENT LIQUID ORBS (Anime.js animated)
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
        <div className="anime-orb-1 absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-blue-500/15 blur-[120px] dark:bg-blue-600/15" />
        <div className="anime-orb-2 absolute top-1/3 -right-32 h-[520px] w-[520px] rounded-full bg-purple-500/15 blur-[130px] dark:bg-purple-600/15" />
        <div className="anime-orb-3 absolute -bottom-32 left-1/4 h-[440px] w-[440px] rounded-full bg-pink-500/10 blur-[110px] dark:bg-pink-600/10" />
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          1. NAVIGATION BAR (KokonutUI Lume Pattern)
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="fixed top-0 right-0 left-0 z-50">
        <header className="w-full tracking-tighter transition-all duration-300 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-black/5 dark:border-white/10">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex h-16 items-center justify-between gap-8">
              {/* Brand Logo */}
              <div className="flex items-center">
                <Link aria-label="TaskFlow" className="flex items-center gap-2.5 group" href="/">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black shadow-xs group-hover:scale-105 transition-transform duration-200">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 50 50">
                      <title>TaskFlow Logo</title>
                      <path d="M27.5308 40.1395C27.5757 35.5502 26.4122 31.8182 24.9322 31.8037C23.4521 31.7893 22.2159 35.4979 22.1711 40.0871C22.1262 44.6764 23.2897 48.4085 24.7697 48.4229C26.2498 48.4374 27.486 44.7288 27.5308 40.1395Z" />
                      <path d="M18.947 39.0972C21.4661 35.2608 22.5052 31.4922 21.268 30.6798C20.0307 29.8674 16.9856 32.3188 14.4666 36.1552C11.9475 39.9916 10.9084 43.7601 12.1456 44.5726C13.3829 45.385 16.4279 42.9336 18.947 39.0972Z" />
                      <path d="M12.2792 33.593C16.4726 31.7278 19.3843 29.1194 18.7827 27.767C18.1812 26.4146 14.2942 26.8304 10.1008 28.6957C5.90744 30.5609 2.99571 33.1693 3.59726 34.5217C4.1988 35.8741 8.08584 35.4583 12.2792 33.593Z" />
                    </svg>
                  </div>
                  <span className="font-bold text-2xl text-black tracking-tighter transition-colors dark:text-white">
                    TaskFlow
                  </span>
                </Link>
              </div>

              {/* Desktop Nav Links */}
              <div className="hidden items-center gap-1 lg:flex">
                <nav className="group/nav flex items-center gap-1">
                  <div className="relative">
                    <button
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] text-black tracking-tighter transition-all duration-200 hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('features');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Products
                      <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-200" />
                    </button>
                  </div>
                  <div className="relative">
                    <button
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] text-black tracking-tighter transition-all duration-200 hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('features');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Solutions
                      <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-200" />
                    </button>
                  </div>
                  <div className="relative">
                    <button
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] text-black tracking-tighter transition-all duration-200 hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('faq');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Resources
                      <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-200" />
                    </button>
                  </div>
                  <div className="relative">
                    <button
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] text-black tracking-tighter transition-all duration-200 hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('pricing');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Pricing
                    </button>
                  </div>
                </nav>

                <div className="mx-3 h-4 w-px bg-black/10 dark:bg-white/10" />

                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-black/15 dark:border-white/20 bg-transparent hover:bg-black/5 dark:hover:bg-white/10 rounded-md px-3 text-xs h-9 tracking-tighter text-black dark:text-white"
                >
                  Contact Sales
                </Link>

                <button
                  onClick={handleLaunch}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-sm rounded-md px-3 text-xs h-9 tracking-tighter"
                >
                  {isAuthenticated ? 'Open Workspace' : 'Try TaskFlow'}
                </button>
              </div>

              {/* Mobile Menu Trigger */}
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10 h-10 w-10 text-black dark:text-white"
                  aria-label="Toggle mobile menu"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Menu Overlay */}
          {mobileMenuOpen && (
            <div className="border-b border-black/10 dark:border-white/10 bg-white dark:bg-black px-6 py-4 lg:hidden space-y-3">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-black/80 dark:text-white/80"
              >
                Features
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-black/80 dark:text-white/80"
              >
                Pricing
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-black/80 dark:text-white/80"
              >
                FAQ
              </a>
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-lg border border-black/15 dark:border-white/20 text-xs font-semibold text-black dark:text-white"
                >
                  Sign In
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLaunch();
                  }}
                  className="w-full text-center py-2.5 rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-semibold"
                >
                  {isAuthenticated ? 'Open Workspace' : 'Get Started Free'}
                </button>
              </div>
            </div>
          )}
        </header>
      </div>

      <main className="relative min-h-screen w-full overflow-hidden scroll-smooth">
        {/* ─────────────────────────────────────────────────────────────────────────
            2. HERO SECTION (KokonutUI Liquid Glass + Lume Layout)
            ───────────────────────────────────────────────────────────────────────── */}
        <section className="relative mx-auto flex min-h-[92vh] w-full max-w-7xl items-center px-4 pt-24 pb-12 sm:px-6 sm:pt-32 sm:pb-16">
          <div className="grid w-full items-center gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left Content Column */}
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <h1 className="anime-hero-fade font-semibold text-3xl text-black leading-[1.1] tracking-[-0.02em] sm:text-4xl md:text-5xl lg:text-6xl dark:text-white">
                  Tasks that flow, organize, and get results for you.
                </h1>

                <p className="anime-hero-fade max-w-lg text-sm text-black/60 leading-relaxed tracking-tight sm:text-base md:text-lg dark:text-white/60">
                  Accelerate your team velocity with project management that understands context, tracks sprints seamlessly, and keeps deliverables aligned—with zero cognitive friction.
                </p>
              </div>

              {/* Action Area */}
              <div className="anime-hero-fade flex flex-wrap items-center gap-3">
                <button
                  onClick={handleLaunch}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-sm px-5 h-11 rounded-lg text-sm tracking-tight cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>{isAuthenticated ? 'Open Workspace' : 'Get Started Free'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors border border-black/15 dark:border-white/20 bg-transparent hover:bg-black/5 dark:hover:bg-white/10 px-4 h-11 rounded-lg text-sm tracking-tight text-black dark:text-white cursor-pointer"
                >
                  Sign In
                </Link>
              </div>

              {/* Social Proof Row */}
              <div className="anime-hero-fade flex flex-wrap items-center gap-3 pt-2 sm:gap-4">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="-space-x-1.5 flex sm:-space-x-2">
                    <div className="relative h-6 w-6 overflow-hidden rounded-full border-2 border-white sm:h-7 sm:w-7 dark:border-black shadow-xs">
                      <div className="flex h-full w-full items-center justify-center bg-black dark:bg-white">
                        <span className="text-[9px] text-white tracking-tight sm:text-[10px] dark:text-black font-semibold">
                          JD
                        </span>
                      </div>
                    </div>
                    <div className="relative h-6 w-6 overflow-hidden rounded-full border-2 border-white sm:h-7 sm:w-7 dark:border-black shadow-xs">
                      <div className="flex h-full w-full items-center justify-center bg-blue-600">
                        <span className="text-[9px] text-white tracking-tight sm:text-[10px] font-semibold">
                          SA
                        </span>
                      </div>
                    </div>
                    <div className="relative h-6 w-6 overflow-hidden rounded-full border-2 border-white sm:h-7 sm:w-7 dark:border-black shadow-xs">
                      <div className="flex h-full w-full items-center justify-center bg-purple-600">
                        <span className="text-[9px] text-white tracking-tight sm:text-[10px] font-semibold">
                          MK
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-black/50 tracking-tight sm:text-xs dark:text-white/50">
                    <span className="font-semibold text-black dark:text-white">{counters.users}+</span> users
                  </span>
                </div>

                <div className="hidden h-3 w-px bg-black/10 sm:block dark:bg-white/10" />

                <div className="flex items-center gap-1">
                  <div className="flex text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
                    ))}
                  </div>
                  <span className="text-[11px] text-black/50 tracking-tight sm:text-xs dark:text-white/50 font-medium">
                    5.0
                  </span>
                </div>

                <div className="hidden h-3 w-px bg-black/10 sm:block dark:bg-white/10" />

                <div className="flex items-center gap-2 text-[11px] text-black/50 sm:text-xs dark:text-white/50">
                  <Zap className="h-3.5 w-3.5 text-blue-500" />
                  <span>Powered by AI Engine</span>
                </div>
              </div>
            </div>

            {/* Right Column: KokonutUI Liquid Glass Interactive Showcase */}
            <div className="anime-hero-fade relative w-full">
              <LiquidGlassCard
                scale={24}
                className="w-full rounded-2xl sm:rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl p-4 sm:p-6 bg-gradient-to-br from-neutral-50/90 via-white/80 to-neutral-100/90 dark:from-neutral-900/90 dark:via-black/80 dark:to-neutral-950/90"
              >
                {/* Showcase Header */}
                <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-sm tracking-tight text-black dark:text-white">
                      Active Sprint 14
                    </span>
                    <span className="rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] font-mono text-black/60 dark:text-white/60">
                      7 days left
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    <span>84% complete</span>
                  </div>
                </div>

                {/* Interactive Task Cards with Refractive Glass Highlights */}
                <div className="py-4 space-y-2.5">
                  {/* Task Card 1 */}
                  <div
                    onClick={() => toggleTaskCompletion('task1')}
                    className="group/card flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm hover:border-black/15 dark:hover:border-white/20 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          tasksCompleted.task1
                            ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                            : 'border-black/20 dark:border-white/20'
                        }`}
                      >
                        {tasksCompleted.task1 && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div>
                        <p
                          className={`text-xs sm:text-sm font-medium transition-all ${
                            tasksCompleted.task1
                              ? 'line-through text-black/40 dark:text-white/40'
                              : 'text-black dark:text-white'
                          }`}
                        >
                          Auth Pipeline & Session Renewal v2
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                            #TK-108
                          </span>
                          <span className="text-[10px] text-black/40 dark:text-white/40">• High Priority</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-black/40 dark:text-white/40">2h ago</span>
                  </div>

                  {/* Task Card 2 */}
                  <div
                    onClick={() => toggleTaskCompletion('task2')}
                    className="group/card flex items-center justify-between p-3 rounded-xl border border-purple-500/20 dark:border-purple-400/20 bg-purple-500/[0.04] backdrop-blur-sm hover:border-purple-500/40 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          tasksCompleted.task2
                            ? 'bg-purple-600 text-white border-transparent'
                            : 'border-purple-400/30'
                        }`}
                      >
                        {tasksCompleted.task2 && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div>
                        <p
                          className={`text-xs sm:text-sm font-medium transition-all ${
                            tasksCompleted.task2
                              ? 'line-through text-black/40 dark:text-white/40'
                              : 'text-black dark:text-white'
                          }`}
                        >
                          KokonutUI Liquid Glass SVG Integration
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                            #TK-109
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            • In Progress
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex -space-x-1">
                      <div className="h-5 w-5 rounded-full bg-blue-600 text-[9px] text-white flex items-center justify-center font-bold">
                        D
                      </div>
                      <div className="h-5 w-5 rounded-full bg-purple-600 text-[9px] text-white flex items-center justify-center font-bold">
                        R
                      </div>
                    </div>
                  </div>

                  {/* Task Card 3 */}
                  <div
                    onClick={() => toggleTaskCompletion('task3')}
                    className="group/card flex items-center justify-between p-3 rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm hover:border-black/15 dark:hover:border-white/20 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          tasksCompleted.task3
                            ? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
                            : 'border-black/20 dark:border-white/20'
                        }`}
                      >
                        {tasksCompleted.task3 && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div>
                        <p
                          className={`text-xs sm:text-sm font-medium transition-all ${
                            tasksCompleted.task3
                              ? 'line-through text-black/40 dark:text-white/40'
                              : 'text-black dark:text-white'
                          }`}
                        >
                          Real-time WebSocket & Kanban Drag Sync
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-black/50 dark:text-white/50 font-mono">
                            #TK-110
                          </span>
                          <span className="text-[10px] text-black/40 dark:text-white/40">• Upcoming</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-black/40 dark:text-white/40">Sprint backlog</span>
                  </div>
                </div>

                {/* Mini Audio / Pulse Velocity Stream (Inspired by KokonutUI volume center) */}
                <div className="pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
                    <span className="text-[11px] font-medium text-black/70 dark:text-white/70">
                      Live sync active
                    </span>
                  </div>
                  <div className="flex items-end gap-1 h-3.5">
                    {[12, 18, 8, 22, 14, 20, 10, 16].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-blue-500/70"
                        style={{
                          height: `${h}px`,
                          animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </LiquidGlassCard>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────
            3. FEATURES SECTION ("Everything you need to succeed")
            ───────────────────────────────────────────────────────────────────────── */}
        <section
          id="features"
          className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pt-16 pb-24 sm:pt-24 sm:pb-32"
        >
          <div className="mb-12 text-center">
            <h2 className="mb-3 font-semibold text-3xl text-black tracking-tight sm:text-4xl lg:text-5xl dark:text-white">
              Everything you need to succeed
            </h2>
            <p className="mx-auto max-w-2xl text-black/60 text-sm leading-relaxed tracking-tight sm:text-base dark:text-white/60">
              Powerful features designed to help you work smarter, not harder. Everything you need in one place.
            </p>
          </div>

          <div className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left Column: Interactive Liquid Glass Preview Card */}
            <div ref={featureShowcaseRef} className="relative h-[320px] w-full sm:h-[380px] lg:h-[420px]">
              <LiquidGlassCard
                scale={30}
                className="relative h-full w-full overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200 shadow-2xl p-6 dark:border-white/10 dark:from-neutral-900 dark:via-black dark:to-neutral-950 flex flex-col justify-between"
              >
                {/* Background Ambient Radial Glows */}
                <div className="absolute top-8 right-8 h-28 w-28 animate-pulse rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
                <div className="absolute bottom-10 left-10 h-32 w-32 animate-pulse rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

                {/* Active Feature Showcase View */}
                {activeFeatureIndex === 0 && (
                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
                      <div>
                        <span className="text-xs uppercase font-mono tracking-widest text-blue-600 dark:text-blue-400 font-semibold">
                          Analytics Engine
                        </span>
                        <h4 className="text-lg font-bold text-black dark:text-white">Team Velocity & Throughput</h4>
                      </div>
                      <span className="text-xs font-mono px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                        +28% this sprint
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 my-auto">
                      <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 backdrop-blur-sm">
                        <span className="text-[11px] text-black/50 dark:text-white/50">Completion</span>
                        <p className="text-xl font-bold text-black dark:text-white">94.2%</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 backdrop-blur-sm">
                        <span className="text-[11px] text-black/50 dark:text-white/50">Cycle Time</span>
                        <p className="text-xl font-bold text-black dark:text-white">2.1d</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 backdrop-blur-sm">
                        <span className="text-[11px] text-black/50 dark:text-white/50">Tasks Shipped</span>
                        <p className="text-xl font-bold text-black dark:text-white">128</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/80 dark:bg-white/[0.04] border border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
                      <span className="text-black/60 dark:text-white/60">Automated Burndown calculation</span>
                      <span className="font-mono text-black dark:text-white font-medium">Zero bottleneck detected</span>
                    </div>
                  </div>
                )}

                {activeFeatureIndex === 1 && (
                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
                      <div>
                        <span className="text-xs uppercase font-mono tracking-widest text-purple-600 dark:text-purple-400 font-semibold">
                          Workflow Automation
                        </span>
                        <h4 className="text-lg font-bold text-black dark:text-white">Trigger & Event Matrix</h4>
                      </div>
                      <Zap className="h-5 w-5 text-purple-500" />
                    </div>

                    <div className="space-y-2 my-auto">
                      <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-purple-500" />
                          <span>PR Merged in GitHub</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-black/40 dark:text-white/40" />
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Move Task to Done</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span>Sprint Due in 24h</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-black/40 dark:text-white/40" />
                        <span className="font-semibold text-blue-600 dark:text-blue-400">Alert Discord & Slack</span>
                      </div>
                    </div>

                    <div className="text-xs text-black/50 dark:text-white/50">
                      12 active background automations running without server configuration
                    </div>
                  </div>
                )}

                {activeFeatureIndex === 2 && (
                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
                      <div>
                        <span className="text-xs uppercase font-mono tracking-widest text-emerald-600 dark:text-emerald-400 font-semibold">
                          Live Collaboration
                        </span>
                        <h4 className="text-lg font-bold text-black dark:text-white">Real-Time Team Presence</h4>
                      </div>
                      <Users className="h-5 w-5 text-emerald-500" />
                    </div>

                    <div className="space-y-2.5 my-auto">
                      <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-start gap-3">
                        <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          S
                        </div>
                        <div className="text-xs">
                          <p className="font-semibold text-black dark:text-white">Sarah Jenkins commented on #TK-108</p>
                          <p className="text-black/60 dark:text-white/60 mt-0.5">
                            "Updated the JWT rotation cookie. Ready for staging deploy."
                          </p>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>4 team members viewing board</span>
                        </div>
                        <span className="font-mono text-black/40 dark:text-white/40">Sub-10ms sync</span>
                      </div>
                    </div>

                    <div className="text-xs text-black/50 dark:text-white/50">
                      Zero lock-in, WebSocket synchronized board states
                    </div>
                  </div>
                )}

                {activeFeatureIndex === 3 && (
                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
                      <div>
                        <span className="text-xs uppercase font-mono tracking-widest text-amber-600 dark:text-amber-400 font-semibold">
                          AI Context Engine
                        </span>
                        <h4 className="text-lg font-bold text-black dark:text-white">Intelligent Issue Summaries</h4>
                      </div>
                      <Sparkles className="h-5 w-5 text-amber-500" />
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 text-xs space-y-2 my-auto">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-black dark:text-white">Auto-Generated Release Notes</span>
                        <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded font-mono">
                          Gemini 1.5
                        </span>
                      </div>
                      <p className="text-black/70 dark:text-white/70 leading-relaxed">
                        • Replaced legacy transitions with KokonutUI Apple liquid glass card effects.
                        <br />• Enhanced hero with anime.js timeline sequencing.
                        <br />• Reduced cumulative layout shift to absolute zero.
                      </p>
                    </div>

                    <div className="text-xs text-black/50 dark:text-white/50">
                      Context understanding across all project threads and commits
                    </div>
                  </div>
                )}
              </LiquidGlassCard>
            </div>

            {/* Right Column: Accordion Items Matching Lume Design */}
            <div className="flex flex-col justify-center">
              <div className="flex flex-col gap-4">
                {features.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = activeFeatureIndex === idx;

                  return (
                    <div
                      key={item.id}
                      className="group border-neutral-200 border-b dark:border-neutral-800 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleFeatureChange(idx)}
                        className="flex w-full items-center justify-between py-4 text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <Icon className={`h-6 w-6 transition-all duration-200 ${item.accent}`} />
                          <span
                            className={`font-semibold text-xl tracking-tight transition-colors duration-200 sm:text-2xl ${
                              isActive
                                ? 'text-black dark:text-white'
                                : 'text-black/60 group-hover:text-black dark:text-white/60 dark:group-hover:text-white'
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-black/40 transition-transform duration-300 dark:text-white/40 ${
                            isActive ? 'rotate-180 text-black dark:text-white' : ''
                          }`}
                        />
                      </button>

                      {isActive && (
                        <div className="pb-6 pl-10 animate-in fade-in slide-in-from-top-2 duration-300">
                          <p className="text-base text-black/60 leading-relaxed tracking-tight dark:text-white/60">
                            {item.description}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────
            4. PRICING SECTION ("Pricing that scales with you")
            ───────────────────────────────────────────────────────────────────────── */}
        <section
          id="pricing"
          className="relative mx-auto flex w-full max-w-5xl flex-col px-6 pt-12 pb-24 sm:pt-16 sm:pb-32"
        >
          <div className="mb-16 text-center">
            <h2 className="mb-3 font-semibold text-3xl text-black tracking-tight sm:text-4xl lg:text-5xl dark:text-white">
              Pricing that scales with you
            </h2>
            <p className="mx-auto max-w-2xl text-black/60 text-sm leading-relaxed tracking-tight sm:text-base dark:text-white/60">
              Choose your plan and adjust anytime. All plans include a 14-day free trial with full access.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Plan 1: Free */}
            <LiquidGlassCard
              glassTone="blue"
              scale={25}
              className="group relative flex flex-col rounded-2xl p-6 backdrop-blur-md transition-all duration-300 hover:shadow-xl"
            >
              <h3 className="mb-2 font-semibold text-2xl text-black tracking-tighter dark:text-white">Free</h3>
              <p className="mb-6 text-black/60 text-sm leading-relaxed tracking-tighter dark:text-white/60">
                Perfect for individuals exploring task management
              </p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-5xl text-black tracking-tighter dark:text-white">Free</span>
                </div>
              </div>

              <Link
                href="/auth/signup"
                className="group/btn relative mb-6 flex h-9 w-full items-center justify-center overflow-hidden rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-medium tracking-tighter shadow-sm transition-all duration-300 hover:shadow-lg"
              >
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100 dark:via-black/10" />
              </Link>

              <div className="space-y-2.5">
                {[
                  '1 Active Workspace',
                  'Up to 50 active tasks',
                  'Community support',
                  'Basic Kanban & List views',
                  'Mobile PWA access',
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/5">
                      <Check className="h-2.5 w-2.5 text-black dark:text-white" />
                    </div>
                    <span className="text-black/70 text-sm leading-tight tracking-tighter dark:text-white/70">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </LiquidGlassCard>

            {/* Plan 2: Pro */}
            <LiquidGlassCard
              glassTone="purple"
              scale={30}
              className="group relative flex flex-col rounded-2xl p-6 backdrop-blur-md transition-all duration-300 hover:shadow-2xl ring-1 ring-purple-500/30"
            >
              <div className="absolute -top-3 right-6 rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-semibold text-white tracking-tight uppercase shadow-xs">
                Popular
              </div>

              <h3 className="mb-2 font-semibold text-2xl text-black tracking-tighter dark:text-white">Pro</h3>
              <p className="mb-6 text-black/60 text-sm leading-relaxed tracking-tighter dark:text-white/60">
                For fast-moving teams scaling workflows
              </p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-5xl text-black tracking-tighter dark:text-white">$49</span>
                  <span className="text-base text-black/60 tracking-tighter dark:text-white/60">/month</span>
                </div>
              </div>

              <Link
                href="/auth/signup"
                className="group/btn relative mb-6 flex h-9 w-full items-center justify-center overflow-hidden rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-medium tracking-tighter shadow-sm transition-all duration-300 hover:shadow-lg"
              >
                <span className="relative z-10">Start Free Trial</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100 dark:via-black/10" />
              </Link>

              <div className="space-y-2.5">
                {[
                  'Unlimited Tasks & Projects',
                  'Kanban, Calendar & Reports',
                  'Priority support 24/7',
                  'Advanced velocity analytics',
                  'Custom workflow automations',
                  'Team collaboration & invites',
                  'Webhook & GitHub integrations',
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/5">
                      <Check className="h-2.5 w-2.5 text-black dark:text-white" />
                    </div>
                    <span className="text-black/70 text-sm leading-tight tracking-tighter dark:text-white/70">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </LiquidGlassCard>

            {/* Plan 3: Sales / Enterprise */}
            <LiquidGlassCard
              glassTone="pink"
              scale={25}
              className="group relative flex flex-col rounded-2xl p-6 backdrop-blur-md transition-all duration-300 hover:shadow-xl"
            >
              <h3 className="mb-2 font-semibold text-2xl text-black tracking-tighter dark:text-white">Sales</h3>
              <p className="mb-6 text-black/60 text-sm leading-relaxed tracking-tighter dark:text-white/60">
                Custom enterprise solutions & SLA
              </p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-5xl text-black tracking-tighter dark:text-white">$299</span>
                  <span className="text-base text-black/60 tracking-tighter dark:text-white/60">/month</span>
                </div>
              </div>

              <Link
                href="/auth/login"
                className="group/btn relative mb-6 flex h-9 w-full items-center justify-center overflow-hidden rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-medium tracking-tighter shadow-sm transition-all duration-300 hover:shadow-lg"
              >
                <span className="relative z-10">Contact Sales</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100 dark:via-black/10" />
              </Link>

              <div className="space-y-2.5">
                {[
                  'Unlimited Workspaces & Seats',
                  'Dedicated support engineer',
                  'Custom AI training & models',
                  '99.9% SLA uptime guarantee',
                  'Advanced security & audit logs',
                  'Single Sign-On (SAML/Okta)',
                  'On-premise deployment option',
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/5">
                      <Check className="h-2.5 w-2.5 text-black dark:text-white" />
                    </div>
                    <span className="text-black/70 text-sm leading-tight tracking-tighter dark:text-white/70">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </LiquidGlassCard>
          </div>

          <div className="mt-12 text-center">
            <p className="mx-auto max-w-2xl text-black/60 text-sm tracking-tighter dark:text-white/60">
              Prices shown do not include applicable tax. * Usage limits apply.
            </p>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────
            5. FAQ SECTION (Matching KokonutUI Lume (001) Numbered Style)
            ───────────────────────────────────────────────────────────────────────── */}
        <section
          id="faq"
          className="relative mx-auto flex w-full max-w-3xl flex-col px-6 pt-12 pb-24 sm:pt-16 sm:pb-32"
        >
          <div className="mb-12 text-center">
            <h2 className="mb-2 font-semibold text-2xl text-black tracking-tight sm:text-3xl dark:text-white">
              Frequently asked questions
            </h2>
            <p className="mx-auto max-w-xl text-black/60 text-sm leading-relaxed tracking-tight dark:text-white/60">
              Everything you need to know about the product and billing. Can't find the answer you're looking for?{' '}
              <a
                className="font-medium text-black underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black/40 dark:text-white dark:decoration-white/20 dark:hover:decoration-white/40"
                href="#contact"
              >
                Contact us
              </a>
              .
            </p>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;

              return (
                <div
                  key={faq.number}
                  className="group relative border-neutral-200 border-t dark:border-neutral-800 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="relative flex w-full items-center justify-between py-4 text-left cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-neutral-400 text-xs transition-colors duration-200 group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-400">
                        ({faq.number})
                      </span>
                      <h3 className="font-medium text-sm tracking-tight transition-colors duration-200 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 text-black dark:text-white">
                        {faq.question}
                      </h3>
                    </div>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                      {isOpen ? (
                        <Minus className="h-4 w-4 text-neutral-400 transition-colors duration-200 group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-400" />
                      ) : (
                        <Plus className="h-4 w-4 text-neutral-400 transition-colors duration-200 group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-400" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="pb-4 pl-8 animate-in fade-in slide-in-from-top-1 duration-200">
                      <p className="text-neutral-600 text-sm leading-relaxed tracking-tight dark:text-neutral-400">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ─────────────────────────────────────────────────────────────────────────
          6. FOOTER (Matching KokonutUI Lume Template Structure)
          ───────────────────────────────────────────────────────────────────────── */}
      <footer className="relative mx-auto w-full max-w-7xl px-6 pt-24 pb-12 sm:pt-32 sm:pb-16 border-t border-black/10 dark:border-white/10">
        <div className="flex flex-col gap-16 md:flex-row md:items-start md:justify-between">
          {/* Brand Info */}
          <div className="max-w-sm shrink-0">
            <Link
              className="flex items-center gap-2 font-semibold text-3xl text-black tracking-tight transition-opacity hover:opacity-80 dark:text-white"
              href="/"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 50 50">
                  <path d="M27.5308 40.1395C27.5757 35.5502 26.4122 31.8182 24.9322 31.8037C23.4521 31.7893 22.2159 35.4979 22.1711 40.0871C22.1262 44.6764 23.2897 48.4085 24.7697 48.4229C26.2498 48.4374 27.486 44.7288 27.5308 40.1395Z" />
                </svg>
              </div>
              <span>TaskFlow</span>
            </Link>
            <p className="mt-4 text-base text-black/60 leading-relaxed tracking-tight dark:text-white/60">
              We are a team of developers and designers passionate about creating frictionless project management experiences.
            </p>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-2 gap-12 sm:grid-cols-3 md:gap-16">
            <div className="space-y-4">
              <h3 className="font-semibold text-black text-sm tracking-tight dark:text-white">Product</h3>
              <ul className="space-y-3">
                <li>
                  <a
                    className="text-black/60 text-sm leading-relaxed tracking-tight transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
                    href="#features"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    className="text-black/60 text-sm leading-relaxed tracking-tight transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
                    href="#pricing"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    className="text-black/60 text-sm leading-relaxed tracking-tight transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
                    href="/app"
                  >
                    Workspace
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => setIsPWAModalOpen(true)}
                    className="text-black/60 text-sm leading-relaxed tracking-tight transition-colors hover:text-black dark:text-white/60 dark:hover:text-white text-left"
                  >
                    Install PWA App
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-black text-sm tracking-tight dark:text-white">Company</h3>
              <ul className="space-y-3">
                <li>
                  <a
                    className="text-black/60 text-sm leading-relaxed tracking-tight transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
                    href="#"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    className="text-black/60 text-sm leading-relaxed tracking-tight transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
                    href="#"
                  >
                    Careers
                  </a>
                </li>
                <li>
                  <a
                    className="text-black/60 text-sm leading-relaxed tracking-tight transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
                    href="#"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    className="text-black/60 text-sm leading-relaxed tracking-tight transition-colors hover:text-black dark:text-white/60 dark:hover:text-white"
                    href="#"
                  >
                    Privacy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Stay Updated Newsletter Form */}
          <div className="max-w-sm shrink-0 space-y-4">
            <h3 className="font-semibold text-black text-sm tracking-tight dark:text-white">Stay updated</h3>
            <p className="text-black/60 text-sm leading-relaxed tracking-tight dark:text-white/60">
              Get the latest updates on high-velocity sprints and AI workflows.
            </p>
            <form onSubmit={e => e.preventDefault()} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  required
                  className="flex w-full border py-1 shadow-xs transition-colors h-9 flex-1 rounded-lg border-black/10 bg-transparent px-3 text-sm tracking-tight placeholder:text-black/40 focus:border-black focus:ring-1 focus:ring-black dark:border-white/10 dark:focus:border-white dark:focus:ring-white dark:placeholder:text-white/40 text-black dark:text-white"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium text-sm group h-9 w-9 rounded-lg bg-black p-0 text-white shadow-xs transition-all duration-300 hover:bg-black/90 hover:shadow-lg dark:bg-white dark:text-black dark:hover:bg-white/90"
                >
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
              <p className="text-black/40 text-xs tracking-tight dark:text-white/40">
                No spam. Unsubscribe anytime.
              </p>
            </form>
          </div>
        </div>

        {/* Bottom Legal / Copyright */}
        <div className="mt-16 flex flex-col justify-between gap-4 border-black/10 border-t pt-8 text-black/50 text-xs tracking-tight sm:flex-row sm:items-center dark:border-white/10 dark:text-white/50">
          <p>© 2025 TaskFlow. All rights reserved.</p>
          <div className="flex gap-6">
            <a className="transition-colors hover:text-black dark:hover:text-white" href="#">
              Terms
            </a>
            <a className="transition-colors hover:text-black dark:hover:text-white" href="#">
              Privacy
            </a>
            <a className="transition-colors hover:text-black dark:hover:text-white" href="#">
              Cookies
            </a>
          </div>
        </div>
      </footer>

      {/* PWA Modal Component */}
      <PWAModal isOpen={isPWAModalOpen} onClose={() => setIsPWAModalOpen(false)} />
    </div>
  );
}
