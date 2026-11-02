'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LiquidGlassCard, LiquidButton } from '@/components/kokonutui/liquid-glass-card';
import PWAModal from '@/components/PWAModal';
import TrustedBySection from '@/components/TrustedBySection';
import StreamlineVelocitySection from '@/components/StreamlineVelocitySection';
import WireStackIntegrationsSection from '@/components/WireStackIntegrationsSection';
import Footer from '@/components/Footer';
import CloudSky from '@/components/CloudSky';

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

  // Orbix Studio style continuous slow-motion scroll physics for navbar
  const navbarRef = useRef<HTMLDivElement>(null);

  // Dedicated Sky portion ref: limits cloud cursor interaction strictly to the sky
  const skyAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let currentY = 0;
    let targetY = 0;
    let currentOpacity = 1;
    let targetOpacity = 1;
    let animationFrameId: number | null = null;
    let isRunning = false;

    const updateMotion = () => {
      // Smooth linear interpolation (lerp) for organic slow-motion inertia
      currentY += (targetY - currentY) * 0.085;
      currentOpacity += (targetOpacity - currentOpacity) * 0.085;

      if (navbarRef.current) {
        navbarRef.current.style.transform = `translate3d(0, ${currentY.toFixed(2)}px, 0)`;
        navbarRef.current.style.opacity = `${Math.max(0, Math.min(1, currentOpacity)).toFixed(3)}`;
        navbarRef.current.style.pointerEvents = currentOpacity <= 0.05 ? 'none' : 'auto';
      }

      // Continue animation until motion fully settles
      if (Math.abs(targetY - currentY) > 0.1 || Math.abs(targetOpacity - currentOpacity) > 0.005) {
        animationFrameId = requestAnimationFrame(updateMotion);
      } else {
        currentY = targetY;
        currentOpacity = targetOpacity;
        if (navbarRef.current) {
          navbarRef.current.style.transform = `translate3d(0, ${currentY}px, 0)`;
          navbarRef.current.style.opacity = `${currentOpacity}`;
          navbarRef.current.style.pointerEvents = currentOpacity <= 0.05 ? 'none' : 'auto';
        }
        isRunning = false;
      }
    };

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      // In the initial scroll (0-90px), the navbar moves up in slow motion and exits first
      const progress = Math.min(Math.max(scrollY / 90, 0), 1);
      targetY = -progress * 110;
      targetOpacity = Math.max(0, 1 - progress * 1.1);

      if (!isRunning) {
        isRunning = true;
        animationFrameId = requestAnimationFrame(updateMotion);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

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

  // GSAP: Pinned Panels with Overscroll for Features and FAQ
  const slidesWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    const wrapper = slidesWrapperRef.current;
    if (!wrapper) return;

    let ctx: gsap.Context | null = null;

    const setupPinnedPanels = () => {
      if (ctx) ctx.revert();

      ctx = gsap.context(() => {
        // Collect all panels inside slides wrapper
        const panels = gsap.utils.toArray<HTMLElement>('.section', wrapper);
        // Pop the trailing element leaving our active sections
        panels.pop();

        panels.forEach((panel) => {
          // Get the element holding the content inside the panel
          const innerpanel = panel.querySelector<HTMLElement>('.section-inner');
          if (!innerpanel) return;

          // Clear previous inline styles before measurement
          panel.style.marginBottom = '';
          gsap.set(innerpanel, { clearProps: 'transform' });
          gsap.set(panel, { clearProps: 'transform,opacity' });

          // Get the Height of the content inside the panel
          const panelHeight = innerpanel.offsetHeight;
          // Get the window height
          const windowHeight = window.innerHeight;

          const difference = panelHeight - windowHeight;

          // ratio (between 0 and 1) representing the portion of the overall animation that's for the fake-scrolling
          const fakeScrollRatio = difference > 0 ? difference / (difference + windowHeight) : 0;

          // if we need to fake scroll (because the panel is taller than the window), add the appropriate amount of margin to the bottom so that the next element comes in at the proper time.
          if (fakeScrollRatio) {
            panel.style.marginBottom = panelHeight * fakeScrollRatio + 'px';
          }

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: panel,
              start: 'bottom bottom',
              end: () => (fakeScrollRatio ? `+=${innerpanel.offsetHeight}` : 'bottom top'),
              pinSpacing: false,
              pin: true,
              scrub: true,
              invalidateOnRefresh: true,
            },
          });

          // fake scroll. We use 1 because that's what the rest of the timeline consists of (0.9 scale + 0.1 fade)
          if (fakeScrollRatio) {
            tl.to(innerpanel, {
              yPercent: -100,
              y: window.innerHeight,
              duration: 1 / (1 - fakeScrollRatio) - 1,
              ease: 'none',
            });
          }

          tl.fromTo(panel, { scale: 1, opacity: 1 }, { scale: 0.7, opacity: 0.5, duration: 0.9 })
            .to(panel, { opacity: 0, duration: 0.1 });
        });
      }, wrapper);
    };

    const mountTimer = setTimeout(() => {
      setupPinnedPanels();
    }, 120);

    const handleResize = () => {
      setupPinnedPanels();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(mountTimer);
      window.removeEventListener('resize', handleResize);
      if (ctx) ctx.revert();
    };
  }, []);

  // Update margins and refresh ScrollTrigger on accordion / tab changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const wrapper = slidesWrapperRef.current;
      if (!wrapper) return;
      const panels = wrapper.querySelectorAll<HTMLElement>('.section');
      panels.forEach((panel) => {
        const innerpanel = panel.querySelector<HTMLElement>('.section-inner');
        if (!innerpanel) return;
        const panelHeight = innerpanel.offsetHeight;
        const windowHeight = window.innerHeight;
        const difference = panelHeight - windowHeight;
        const fakeScrollRatio = difference > 0 ? difference / (difference + windowHeight) : 0;
        if (fakeScrollRatio) {
          panel.style.marginBottom = panelHeight * fakeScrollRatio + 'px';
        } else {
          panel.style.marginBottom = '0px';
        }
      });
      ScrollTrigger.refresh();
    }, 250);

    return () => clearTimeout(timer);
  }, [openFaqIndex, activeFeatureIndex]);

  // Feature items matching KokonutUI Lume template structure
  const features = [
    {
      id: 'analytics',
      title: 'Advanced Analytics',
      icon: Compass,
      accent: 'text-blue-500 dark:text-blue-400',
      description:
        'Get deep insights into your team velocity with powerful analytics tools. Track sprint metrics, cycle times, throughput rates, and make data-driven decisions with ease.',
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
        'Keep distributed teams perfectly synchronized with live cursor presence, instant task updates, threaded inline comments, and seamless cross-project tagging.',
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
      question: 'How does context understanding work in FlowSync?',
      answer:
        'FlowSync maintains project context across tasks, documents, and sprints. It analyzes related issues, pull request links, and blocker dependencies, allowing teams to instantly see root causes and summarize weekly progress.',
    },
    {
      number: '002',
      question: 'Can I switch between or import from Jira, Linear, or Trello?',
      answer:
        'Yes. FlowSync includes one-click migration importers for Linear, Jira, and CSV datasets. Your team tags, assignees, priorities, and descriptions are preserved and organized instantly.',
    },
    {
      number: '003',
      question: 'What happens to my data and privacy?',
      answer:
        'Your data is encrypted both in transit (TLS 1.3) and at rest (AES-256). We never train public AI models on customer tasks or proprietary company code. Enterprise private clouds and on-premise deployments are fully supported.',
    },
    {
      number: '004',
      question: 'Does FlowSync work offline on mobile and desktop?',
      answer:
        'Yes! FlowSync is a fully featured Progressive Web App (PWA) with service-worker caching and offline sync. You can install it natively on iOS, Android, macOS, and Windows to work anywhere with zero latency.',
    },
    {
      number: '005',
      question: 'Can I switch between different AI models?',
      answer:
        'Yes. FlowSync integrates seamlessly with Anthropic Claude, OpenAI GPT, Google Gemini, and Grok. You can configure custom API keys or leverage our managed inference router for sprint generation.',
    },
    {
      number: '006',
      question: 'How do I invite teammates to my workspace?',
      answer:
        'You can invite collaborators directly by email or share a workspace invite link. Team members can be assigned Admin, Project Manager, or Member designations with granular permissions.',
    },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-x-clip bg-white text-black selection:bg-black/10 selection:text-black dark:bg-black dark:text-white dark:selection:bg-white/20 dark:selection:text-white font-sans tracking-tight">
      {/* ─────────────────────────────────────────────────────────────────────────
          BACKGROUND AMBIENT LIQUID ORBS (Anime.js animated)
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
        <div className="anime-orb-1 absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-blue-500/15 blur-[120px] dark:bg-blue-600/15" />
        <div className="anime-orb-2 absolute top-1/3 -right-32 h-[520px] w-[520px] rounded-full bg-purple-500/15 blur-[130px] dark:bg-purple-600/15" />
        <div className="anime-orb-3 absolute -bottom-32 left-1/4 h-[440px] w-[440px] rounded-full bg-pink-500/10 blur-[110px] dark:bg-pink-600/10" />
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          1. NAVIGATION BAR (Orbix Studio Parallax Motion)
          ───────────────────────────────────────────────────────────────────────── */}
      <div
        ref={navbarRef}
        className="fixed top-0 right-0 left-0 z-50 pointer-events-auto will-change-transform"
      >
        <header className="w-full tracking-tighter transition-all duration-300 bg-transparent border-none">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex h-16 sm:h-20 items-center justify-between gap-8">
              {/* Brand Logo */}
              <div className="flex items-center">
                <Link aria-label="FlowSync" className="flex items-center gap-2.5 group" href="/">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black shadow-xs group-hover:scale-105 transition-transform duration-200">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 50 50">
                      <title>FlowSync Logo</title>
                      <path d="M27.5308 40.1395C27.5757 35.5502 26.4122 31.8182 24.9322 31.8037C23.4521 31.7893 22.2159 35.4979 22.1711 40.0871C22.1262 44.6764 23.2897 48.4085 24.7697 48.4229C26.2498 48.4374 27.486 44.7288 27.5308 40.1395Z" />
                      <path d="M18.947 39.0972C21.4661 35.2608 22.5052 31.4922 21.268 30.6798C20.0307 29.8674 16.9856 32.3188 14.4666 36.1552C11.9475 39.9916 10.9084 43.7601 12.1456 44.5726C13.3829 45.385 16.4279 42.9336 18.947 39.0972Z" />
                      <path d="M12.2792 33.593C16.4726 31.7278 19.3843 29.1194 18.7827 27.767C18.1812 26.4146 14.2942 26.8304 10.1008 28.6957C5.90744 30.5609 2.99571 33.1693 3.59726 34.5217C4.1988 35.8741 8.08584 35.4583 12.2792 33.593Z" />
                    </svg>
                  </div>
                  <span className="font-bold text-2xl text-black tracking-tighter transition-colors dark:text-white">
                    FlowSync
                  </span>
                </Link>
              </div>

              {/* Right Action Button */}
              <div className="flex items-center">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-xl shadow-black/20 rounded-full px-6 py-2.5 text-xs sm:text-[13px] h-9 sm:h-10 tracking-tight cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  Try FlowSync
                </Link>
              </div>
            </div>
          </div>
        </header>
      </div>

      <main className="relative min-h-screen w-full overflow-x-clip scroll-smooth">
        {/* ─────────────────────────────────────────────────────────────────────────
            2. HERO SECTION (Scenic Landscape Panoramic + Centered Editorial Design)
            ───────────────────────────────────────────────────────────────────────── */}
        <section className="relative w-full min-h-screen flex flex-col justify-between items-center px-4 pt-36 sm:pt-44 md:pt-48 pb-6 sm:pb-8 overflow-hidden select-none">
          {/* Explicit Sky Interaction Zone: Restricts cursor movement reaction strictly to the Sky portion of the hero */}
          <div
            ref={skyAreaRef}
            data-sky-portion="true"
            className="absolute inset-x-0 top-0 h-[38%] pointer-events-none z-0"
            aria-hidden="true"
          />

          {/* Panoramic Meadow Landscape Background */}
          <div className="absolute inset-0 z-0 select-none pointer-events-none">
            {/* Animated WebGL Cloud Sky Background (Originkit Drifting Cumulus Clouds) */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <CloudSky
                targetRef={skyAreaRef}
                className="w-full h-full"
                background="#0075FF"
                baseColor="#B4D2F0"
                accentColor="#FFFFFF"
                density={100}
                speed={64}
                size={130}
                clouds={{ cirrus: 100, shadow: 70, softness: 200 }}
                sun={{ x: 100, y: 100, glow: "#FFFFFF" }}
                pointer={{ wind: 300, damping: 50, parallax: 300 }}
              />
            </div>

            {/* Landscape with Hills & Foreground (masked at top to blend seamlessly with CloudSky) */}
            <Image
              src="/hero-landscape.jpg"
              alt="Scenic Green Grassland Landscape"
              fill
              priority
              className="object-cover object-[center_35%] w-full h-full scale-105"
              style={{
                maskImage: 'linear-gradient(to bottom, transparent 0%, transparent 20%, black 40%, black 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, transparent 20%, black 40%, black 100%)',
              }}
            />
            {/* Ambient Daylight Overlay for optimal text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/95 dark:from-transparent dark:via-black/40 dark:to-[#0c0d0e]" />

            {/* Seamless Soft Bottom Fade into next section */}
            <div className="absolute inset-x-0 bottom-0 h-32 sm:h-44 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-[#0c0d0e] dark:via-[#0c0d0e]/80 dark:to-transparent" />
          </div>

          {/* Centered Editorial Content */}
          <div className="relative z-10 mx-auto max-w-4xl w-full flex flex-col items-center text-center space-y-6 sm:space-y-7 my-auto pt-8 sm:pt-14 md:pt-16">
            {/* 1. Main Title */}
            <h1 className="anime-hero-fade font-bold text-4xl sm:text-5xl md:text-6xl lg:text-[4.15rem] text-neutral-950 dark:text-white leading-[1.08] tracking-tight max-w-3xl">
              Smart Task & Project Management<br className="hidden sm:inline" /> Built for Modern Teams
            </h1>

            {/* 3. Subtitle */}
            <p className="anime-hero-fade max-w-2xl text-sm sm:text-base md:text-[16.5px] text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal">
              Empower any team to plan, track, and execute tasks and projects with effortless efficiency. Streamline workflows, eliminate bottlenecks, and ship high-impact work faster.
            </p>

            {/* 4. Rating & Reviews Block */}
            <div className="anime-hero-fade pt-1 pb-1 flex items-center justify-center">
              <div className="flex items-center gap-3">
                {/* 5.0 Rating Badge */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-950 text-white dark:bg-white dark:text-black flex items-center justify-center text-xs font-bold shadow-xs">
                    <span className="font-bold text-[13px] leading-none">★</span>
                  </div>
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-neutral-950 dark:text-white leading-none">
                    5.0
                  </span>
                </div>

                {/* 5 Coral Red Stars + Reviews */}
                <div className="flex flex-col items-start justify-center leading-none">
                  <div className="flex text-[#FF4D4D] gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-[#FF4D4D] text-[#FF4D4D]" />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mt-1">
                    Loved by 1,200+ Teams
                  </span>
                </div>
              </div>
            </div>


          </div>

          {/* 6. Floating Bottom Island Bar */}
          <div className="anime-hero-fade relative z-10 mt-8 sm:mt-12 mb-2 sm:mb-3 flex justify-center w-full">
            <div className="inline-flex items-center gap-6 sm:gap-8 px-5 py-2.5 rounded-full bg-neutral-950 text-white dark:bg-neutral-900 dark:border dark:border-neutral-800 shadow-2xl border border-neutral-800/80 backdrop-blur-lg">
              {/* Left Brand Icon */}
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                title="FlowSync"
              >
                <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 50 50">
                  <path d="M27.5308 40.1395C27.5757 35.5502 26.4122 31.8182 24.9322 31.8037C23.4521 31.7893 22.2159 35.4979 22.1711 40.0871C22.1262 44.6764 23.2897 48.4085 24.7697 48.4229C26.2498 48.4374 27.486 44.7288 27.5308 40.1395Z" />
                  <path d="M18.947 39.0972C21.4661 35.2608 22.5052 31.4922 21.268 30.6798C20.0307 29.8674 16.9856 32.3188 14.4666 36.1552C11.9475 39.9916 10.9084 43.7601 12.1456 44.5726C13.3829 45.385 16.4279 42.9336 18.947 39.0972Z" />
                  <path d="M12.2792 33.593C16.4726 31.7278 19.3843 29.1194 18.7827 27.767C18.1812 26.4146 14.2942 26.8304 10.1008 28.6957C5.90744 30.5609 2.99571 33.1693 3.59726 34.5217C4.1988 35.8741 8.08584 35.4583 12.2792 33.593Z" />
                </svg>
              </button>

              {/* Center Metric */}
              <span className="text-xs font-semibold text-neutral-300 tracking-tight select-none">
                0%
              </span>

              {/* Right Menu Trigger */}
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('features');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-neutral-300 transition-colors cursor-pointer"
              >
                <span className="text-[14px] leading-none">☰</span>
                <span>Menu</span>
              </button>
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
            2.8. DEVELOPER & AI PLATFORM SECTION (MCP + REST API)
            ───────────────────────────────────────────────────────────────────────── */}


        {/* ─────────────────────────────────────────────────────────────────────────
            PINNED PANELS WITH OVERSCROLL: FEATURES & FAQ SECTIONS
            ───────────────────────────────────────────────────────────────────────── */}
        <div ref={slidesWrapperRef} className="slides-wrapper relative w-full px-3 sm:px-6 lg:px-8 mt-12 sm:mt-16">
          {/* 2.8. WIRE YOUR STACK SECTION ("Wire your stack in, and through, FlowSync") */}
          <section
            id="integrations"
            className="section section-0 section-integrations w-full h-[calc(100vh-64px)] relative flex justify-center box-border overflow-hidden rounded-2xl sm:rounded-3xl border border-neutral-200/90 dark:border-neutral-800/80 bg-neutral-50/95 dark:bg-[#0e0f11] shadow-2xl backdrop-blur-sm"
          >
            <WireStackIntegrationsSection />
          </section>

          {/* 3. FEATURES SECTION ("Everything you need to succeed") */}
          <section
            id="features"
            className="section section-1 section-features w-full h-[calc(100vh-64px)] relative flex justify-center box-border overflow-hidden rounded-2xl sm:rounded-3xl border border-neutral-200/90 dark:border-neutral-800/80 bg-neutral-50/95 dark:bg-[#0e0f11] shadow-2xl backdrop-blur-sm"
          >
            <div className="section-content w-full h-full flex justify-center overflow-hidden">
              <div className="section-inner w-full max-w-7xl px-6 pt-12 pb-[20vh] sm:pt-16 md:pt-20 flex flex-col items-center">
                <div className="mb-12 text-center">
                  <h2 className="font-semibold text-3xl text-black tracking-tight sm:text-4xl lg:text-5xl dark:text-white">
                    Everything you need to succeed
                  </h2>
                </div>

                <div className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-16 my-auto">
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
                            <span className="text-black/60 dark:text-white/60">Automated velocity calculation</span>
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
                                  className={`font-semibold text-xl tracking-tight transition-colors duration-200 sm:text-2xl ${isActive
                                    ? 'text-black dark:text-white'
                                    : 'text-black/60 group-hover:text-black dark:text-white/60 dark:group-hover:text-white'
                                    }`}
                                >
                                  {item.title}
                                </span>
                              </div>
                              <ChevronDown
                                className={`h-5 w-5 text-black/40 transition-transform duration-300 dark:text-white/40 ${isActive ? 'rotate-180 text-black dark:text-white' : ''
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
              </div>
            </div>
          </section>

          {/* 4. FAQ SECTION (Matching KokonutUI Lume (001) Numbered Style) */}
          <section
            id="faq"
            className="section section-2 section-faq w-full h-[calc(100vh-64px)] relative flex justify-center box-border overflow-hidden rounded-2xl sm:rounded-3xl border border-neutral-200/90 dark:border-neutral-800/80 bg-white dark:bg-[#111215] shadow-2xl backdrop-blur-sm"
          >
            <div className="section-content w-full h-full flex justify-center overflow-hidden">
              <div className="section-inner w-full max-w-3xl px-6 pt-12 pb-[20vh] sm:pt-16 md:pt-20 flex flex-col items-center">
                <div className="mb-12 text-center">
                  <h2 className="font-semibold text-2xl text-black tracking-tight sm:text-3xl dark:text-white">
                    Frequently asked questions
                  </h2>
                </div>

                <div className="w-full space-y-2">
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
              </div>
            </div>
          </section>

          {/* Dummy / Anchor element so panels.pop() pops this end-marker leaving section-1 & section-2 as active overscrolling panels */}
          <div className="section section-end h-px w-full pointer-events-none opacity-0" />
        </div>
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
