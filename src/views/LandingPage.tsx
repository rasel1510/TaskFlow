'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowRight,
  ChevronDown,
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
import TrustedBySection from '@/components/TrustedBySection';
import StreamlineVelocitySection from '@/components/StreamlineVelocitySection';
import Footer from '@/components/Footer';

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
      question: 'How do I invite teammates to my workspace?',
      answer:
        'You can invite collaborators directly by email or share a workspace invite link. Team members can be assigned Owner, Lead, Contributor, or Viewer roles with granular project permissions.',
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
                </nav>

                <div className="mx-3 h-4 w-px bg-black/10 dark:bg-white/10" />

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
            2. HERO SECTION (Editorial AI Creator + Studio Animation Image)
            ───────────────────────────────────────────────────────────────────────── */}
        <section className="relative mx-auto flex min-h-[92vh] w-full max-w-7xl items-center px-4 pt-24 pb-12 sm:px-6 sm:pt-32 sm:pb-16">
          <div className="grid w-full items-center gap-10 sm:gap-14 lg:grid-cols-2 lg:gap-16">
            {/* Left Content Column */}
            <div className="space-y-6 sm:space-y-7">
              <div className="space-y-4">
                <h1 className="anime-hero-fade font-bold text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] text-slate-950 dark:text-white leading-[1.05] tracking-tight">
                  AI that thinks, does,<br />
                  and gets results for you.
                </h1>

                <p className="anime-hero-fade max-w-lg text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Accelerate your productivity with AI that understands context, generates insights, and helps you accomplish more—safely and securely.
                </p>
              </div>

              {/* Hero CTA Action */}
              <div className="anime-hero-fade pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleLaunch}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-semibold text-xs sm:text-sm tracking-tight transition-all active:scale-[0.98] shadow-sm cursor-pointer"
                >
                  <span>{isAuthenticated ? 'Open Workspace' : 'Get Started Free'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {/* Social Proof Row */}
              <div className="anime-hero-fade flex flex-wrap items-center gap-3 pt-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <div className="-space-x-1.5 flex sm:-space-x-2">
                    <div className="relative h-6 w-6 overflow-hidden rounded-full border-2 border-white sm:h-7 sm:w-7 dark:border-slate-900 shadow-xs bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center font-bold text-[9px] sm:text-[10px]">
                      JD
                    </div>
                    <div className="relative h-6 w-6 overflow-hidden rounded-full border-2 border-white sm:h-7 sm:w-7 dark:border-slate-900 shadow-xs bg-blue-600 text-white flex items-center justify-center font-bold text-[9px] sm:text-[10px]">
                      SA
                    </div>
                    <div className="relative h-6 w-6 overflow-hidden rounded-full border-2 border-white sm:h-7 sm:w-7 dark:border-slate-900 shadow-xs bg-purple-600 text-white flex items-center justify-center font-bold text-[9px] sm:text-[10px]">
                      MK
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 tracking-tight sm:text-xs dark:text-slate-400">
                    <strong className="font-semibold text-slate-900 dark:text-white">
                      {counters.users}+
                    </strong>{' '}
                    users
                  </span>
                </div>

                <div className="hidden h-3 w-px bg-slate-200 sm:block dark:bg-slate-800" />

                <div className="flex items-center gap-1">
                  <div className="flex text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-900 dark:text-white sm:text-xs">
                    5.0
                  </span>
                </div>

                <div className="hidden h-3 w-px bg-slate-200 sm:block dark:bg-slate-800" />

                <div className="flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <Zap className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <span>Powered by AI</span>
                </div>
              </div>
            </div>

            {/* Right Column: Professional Animated Editorial AI Image Card */}
            <div className="anime-hero-fade relative w-full flex items-center justify-center">
              <div className="group relative w-full max-w-[540px] aspect-square rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 bg-[#BA5939] transition-all duration-500 hover:shadow-[0_25px_60px_rgba(186,89,57,0.35)]">
                
                {/* Main Editorial Creative Image */}
                <img
                  src="/hero-ai-creator.jpg"
                  alt="AI Creator Workspace"
                  className="w-full h-full object-cover select-none transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  loading="eager"
                />

                {/* Subtle Ambient Vignette Overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

                {/* Dynamic Glowing Neon Code & Syntax Animation Stream */}
                <div className="pointer-events-none absolute inset-0 select-none">
                  
                  {/* Subtle Dotted Curving Arc Background Guide */}
                  <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 500 500" fill="none">
                    <path
                      d="M 50 250 C 70 140, 160 70, 320 65 C 370 68, 410 95, 430 135"
                      stroke="url(#neonArcGlow)"
                      strokeWidth="1.75"
                      strokeDasharray="4 8"
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="neonArcGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
                        <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#fb7185" stopOpacity="0.9" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Token Arc Segment 1: Upper Left Stream */}
                  <div className="absolute top-[8%] left-[6%] sm:top-[9%] sm:left-[8%] font-mono text-xs sm:text-sm font-semibold tracking-wider whitespace-nowrap animate-syntax-float-slow flex items-center gap-1 sm:gap-1.5 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">
                    <span className="text-[#34d399] drop-shadow-[0_0_8px_rgba(52,211,153,0.85)]">--\&gt;</span>
                    <span className="text-[#fb7185] drop-shadow-[0_0_8px_rgba(251,113,133,0.85)]">-</span>
                    <span className="text-[#fbbf24] drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]">•</span>
                    <span className="text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]">{`{ - }`}</span>
                    <span className="text-[#c084fc] drop-shadow-[0_0_8px_rgba(192,132,252,0.85)]">/</span>
                    <span className="text-[#fb7185] drop-shadow-[0_0_8px_rgba(251,113,133,0.85)]">&quot; - _ &quot;</span>
                    <span className="text-[#34d399] drop-shadow-[0_0_8px_rgba(52,211,153,0.85)]">)</span>
                    <span className="text-[#fbbf24] drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]">:</span>
                    <span className="text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]">{`{ }`}</span>
                  </div>

                  {/* Token Arc Segment 2: Middle Left Curved Stream */}
                  <div className="absolute top-[28%] left-[10%] sm:top-[30%] sm:left-[12%] font-mono text-xs sm:text-sm font-semibold tracking-wider whitespace-nowrap animate-syntax-float-fast flex items-center gap-1 sm:gap-1.5 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">
                    <span className="text-[#fb7185] drop-shadow-[0_0_8px_rgba(251,113,133,0.85)]">~</span>
                    <span className="text-[#34d399] drop-shadow-[0_0_8px_rgba(52,211,153,0.85)]">-</span>
                    <span className="text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]">&lt; / &gt;</span>
                    <span className="text-[#fbbf24] drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]">.</span>
                    <span className="text-[#c084fc] drop-shadow-[0_0_8px_rgba(192,132,252,0.85)]">:</span>
                    <span className="text-[#34d399] drop-shadow-[0_0_8px_rgba(52,211,153,0.85)]">{`} }`}</span>
                    <span className="text-[#fb7185] drop-shadow-[0_0_8px_rgba(251,113,133,0.85)]">.</span>
                  </div>

                  {/* Token Arc Segment 3: Lower Right Arc */}
                  <div className="absolute bottom-[34%] right-[7%] sm:bottom-[32%] sm:right-[9%] font-mono text-xs sm:text-sm font-semibold tracking-wider whitespace-nowrap animate-syntax-glow flex items-center gap-1 sm:gap-1.5 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">
                    <span className="text-[#fb7185] drop-shadow-[0_0_8px_rgba(251,113,133,0.85)]">&lt; / &gt;</span>
                    <span className="text-[#fbbf24] drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]">:</span>
                    <span className="text-[#34d399] drop-shadow-[0_0_8px_rgba(52,211,153,0.85)]">- *</span>
                  </div>

                  {/* Floating Glass Pill Badge */}
                  <div className="pointer-events-auto absolute bottom-5 left-5 sm:bottom-6 sm:left-6 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/20 text-white shadow-xl transition-transform hover:scale-105 duration-200">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </div>
                    <span className="text-xs font-medium tracking-tight">
                      TaskFlow AI Engine active
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────
            2.5. TRUSTED BY SECTION
            ───────────────────────────────────────────────────────────────────────── */}
        <TrustedBySection />

        {/* ─────────────────────────────────────────────────────────────────────────
            2.7. STREAMLINE SPRINTS & VELOCITY SECTION
            ───────────────────────────────────────────────────────────────────────── */}
        <StreamlineVelocitySection />

        {/* ─────────────────────────────────────────────────────────────────────────
            3. FEATURES SECTION ("Everything you need to succeed")
            ───────────────────────────────────────────────────────────────────────── */}
        <section
          id="features"
          className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pt-16 pb-24 sm:pt-24 sm:pb-32"
        >
          <div className="mb-12 text-center">
            <h2 className="font-semibold text-3xl text-black tracking-tight sm:text-4xl lg:text-5xl dark:text-white">
              Everything you need to succeed
            </h2>
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
            4. FAQ SECTION (Matching KokonutUI Lume (001) Numbered Style)
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
              Everything you need to know about the product and workspace. Can't find the answer you're looking for?{' '}
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
          6. FOOTER (Minimalist 5-Column Grid with Alpine Landscape Artwork)
          ───────────────────────────────────────────────────────────────────────── */}
      <Footer onOpenPWA={() => setIsPWAModalOpen(true)} />

      {/* PWA Modal Component */}
      <PWAModal isOpen={isPWAModalOpen} onClose={() => setIsPWAModalOpen(false)} />
    </div>
  );
}
