'use client';

import React, { useEffect, useState, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { 
  Kanban, 
  CheckCircle2, 
  Layers, 
  Activity, 
  FolderGit2, 
  Sparkles,
  TrendingUp,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export default function StreamlineVelocitySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeBarIndex, setActiveBarIndex] = useState<number>(0); // Month 1 default highlighted as in reference
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [barsAnimated, setBarsAnimated] = useState(false);

  // Sprint Velocity Data matching reference image proportions
  const chartBars = [
    { label: 'Sprint 1', month: 'Month 1', height: 60, value: '184 tasks', velocity: '$11.2k', fill: 'from-[#4f46e5] to-[#6366f1]' },
    { label: 'Sprint 2', month: 'Month 2', height: 28, value: '92 tasks', velocity: '$5.4k', fill: 'from-[#4f46e5] to-[#6366f1]' },
    { label: 'Sprint 3', month: 'Month 3', height: 84, value: '240 tasks', velocity: '$14.8k', fill: 'from-[#7c3aed] to-[#9333ea]', isFeatured: true },
    { label: 'Sprint 4', month: 'Month 4', height: 52, value: '146 tasks', velocity: '$9.6k', fill: 'from-[#4f46e5] to-[#6366f1]' },
  ];

  // 4 Y-Axis Ticks matching the screenshot ($15k, $10k, $5k, $0)
  const yAxisTicks = ['$15k', '$10k', '$5k', '$0'];

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Trigger bar growth animation
    const timer = setTimeout(() => {
      setBarsAnimated(true);
    }, 150);

    // Anime.js: Stagger entrance for floating cards & chart elements
    try {
      animate('.anime-velocity-left', {
        opacity: [0, 1],
        scale: [0.95, 1],
        translateY: [20, 0],
        duration: 900,
        ease: 'outExpo',
      });

      animate('.anime-velocity-right', {
        opacity: [0, 1],
        translateX: [24, 0],
        duration: 800,
        ease: 'outExpo',
      });

      animate('.anime-float-badge', {
        opacity: [0, 1],
        translateY: [-15, 0],
        delay: stagger(120, { start: 200 }),
        duration: 800,
        ease: 'outExpo',
      });
    } catch (err) {
      console.warn('Anime.js velocity section fallback:', err);
    }

    return () => clearTimeout(timer);
  }, []);

  // Coordinated physical movement on side modules when any bar is hovered
  const getMilestonesStyle = () => {
    if (hoveredBarIndex === null) return {};
    const transforms = [
      'translate3d(-8px, -10px, 0) scale(1.04) rotate(-1.5deg)',
      'translate3d(-4px, -6px, 0) scale(1.02) rotate(-0.8deg)',
      'translate3d(3px, -3px, 0) scale(1.01) rotate(0.8deg)',
      'translate3d(6px, -2px, 0) scale(1.02) rotate(1.2deg)',
    ];
    return {
      transform: transforms[hoveredBarIndex] || '',
      boxShadow: '0 20px 35px -10px rgba(245, 158, 11, 0.22), 0 8px 16px -6px rgba(0, 0, 0, 0.08)',
    };
  };

  const getActiveSprintsStyle = () => {
    if (hoveredBarIndex === null) return {};
    const transforms = [
      'translate3d(-10px, -8px, 0) scale(1.04) rotate(-2deg)',
      'translate3d(-6px, -5px, 0) scale(1.02) rotate(-1deg)',
      'translate3d(-2px, -2px, 0) scale(1.01) rotate(0.5deg)',
      'translate3d(4px, 4px, 0) scale(0.98) rotate(1.2deg)',
    ];
    return {
      transform: transforms[hoveredBarIndex] || '',
      boxShadow: '0 20px 35px -10px rgba(99, 102, 241, 0.25), 0 8px 16px -6px rgba(0, 0, 0, 0.08)',
    };
  };

  const getTlAvatarStyle = () => {
    if (hoveredBarIndex === null) return {};
    const transforms = [
      'translate3d(-6px, -12px, 0) scale(1.12) rotate(-4deg)',
      'translate3d(-3px, -8px, 0) scale(1.08) rotate(-2deg)',
      'translate3d(2px, -4px, 0) scale(1.05) rotate(1.5deg)',
      'translate3d(5px, -2px, 0) scale(1.03) rotate(2.5deg)',
    ];
    return {
      transform: transforms[hoveredBarIndex] || '',
      boxShadow: '0 20px 30px -8px rgba(124, 58, 237, 0.38)',
    };
  };

  const getProjectsCardStyle = () => {
    if (hoveredBarIndex === null) return {};
    const transforms = [
      'translate3d(-4px, 5px, 0) rotate(-0.8deg)',
      'translate3d(-2px, 3px, 0) rotate(-0.4deg)',
      'translate3d(6px, -8px, 0) scale(1.03) rotate(1.2deg)',
      'translate3d(8px, -6px, 0) scale(1.03) rotate(1.6deg)',
    ];
    return {
      transform: transforms[hoveredBarIndex] || '',
      boxShadow: '0 25px 45px -12px rgba(99, 102, 241, 0.18), 0 10px 20px -5px rgba(0, 0, 0, 0.06)',
    };
  };

  const getPmAvatarStyle = () => {
    if (hoveredBarIndex === null) return {};
    const transforms = [
      'translate3d(-3px, -3px, 0) scale(1.05) rotate(-1.5deg)',
      'translate3d(0px, -5px, 0) scale(1.07) rotate(0deg)',
      'translate3d(6px, -10px, 0) scale(1.12) rotate(3deg)',
      'translate3d(8px, -9px, 0) scale(1.12) rotate(4deg)',
    ];
    return {
      transform: transforms[hoveredBarIndex] || '',
      boxShadow: '0 20px 30px -8px rgba(245, 158, 11, 0.32)',
    };
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Workflow Streamlining & Sprint Velocity"
      className="relative w-full py-20 sm:py-28 lg:py-36 overflow-hidden bg-white dark:bg-black"
    >
      {/* Inline styles for subtle idle floating motion */}
      <style jsx>{`
        @keyframes tf-float-tl {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(-1deg); }
        }
        @keyframes tf-float-sprints {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(0.8deg); }
        }
        @keyframes tf-float-milestones {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(-0.6deg); }
        }
        @keyframes tf-float-projects {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(0.6deg); }
        }
        @keyframes tf-float-pm {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-5px) scale(1.03); }
        }
        .tf-idle-tl {
          animation: tf-float-tl 6.5s ease-in-out infinite;
        }
        .tf-idle-sprints {
          animation: tf-float-sprints 7s ease-in-out infinite;
        }
        .tf-idle-milestones {
          animation: tf-float-milestones 6.2s ease-in-out infinite;
        }
        .tf-idle-projects {
          animation: tf-float-projects 7.8s ease-in-out infinite;
        }
        .tf-idle-pm {
          animation: tf-float-pm 6s ease-in-out infinite;
        }
      `}</style>

      {/* Background Ambient Radial Glow */}
      <div className="pointer-events-none absolute -top-40 right-10 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl dark:from-indigo-500/15 dark:via-purple-500/10" />
      <div className="pointer-events-none absolute -bottom-40 left-10 h-[450px] w-[450px] rounded-full bg-gradient-to-tr from-blue-500/10 via-emerald-500/5 to-transparent blur-3xl dark:from-blue-500/15" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-16 xl:gap-20">

          {/* ─────────────────────────────────────────────────────────────
              LEFT COLUMN: Exact Layered Chart Mockup with Animated Bars
              ───────────────────────────────────────────────────────────── */}
          <div className="anime-velocity-left relative flex items-center justify-center lg:col-span-7 xl:col-span-7">
            <div className="relative w-full max-w-[620px] select-none py-6 sm:py-8">

              {/* ───────────────────────────────────────────────────────
                  1. BACKGROUND CARD (Top-Right): Manage Multiple Projects
                  ─────────────────────────────────────────────────────── */}
              <div
                style={{
                  ...getProjectsCardStyle(),
                  transition: 'transform 1400ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 1400ms cubic-bezier(0.25, 1, 0.5, 1)',
                }}
                className={`anime-float-badge absolute top-0 right-2 sm:right-6 z-10 w-64 sm:w-72 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-3.5 shadow-xl backdrop-blur-md ${
                  hoveredBarIndex === null ? 'tf-idle-projects' : ''
                }`}
              >
                {/* Header with 4-square grid icon */}
                <div className="mb-3 flex items-center gap-2">
                  <div className="grid grid-cols-2 gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-[2px] bg-amber-500" />
                    <span className="h-1.5 w-1.5 rounded-[2px] bg-amber-500" />
                    <span className="h-1.5 w-1.5 rounded-[2px] bg-amber-500" />
                    <span className="h-1.5 w-1.5 rounded-[2px] bg-amber-500" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tracking-tight">
                    Manage Multiple Projects
                  </span>
                </div>

                {/* Sub-item 1: Design System */}
                <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 opacity-60">
                  <div className="flex h-4 w-4 items-center justify-center text-slate-400">
                    <Layers className="h-3.5 w-3.5 text-cyan-500" />
                  </div>
                  <span className="font-medium">Design System UI</span>
                </div>

                {/* Sub-item 2: Active Highlighted Card (Core API Engine) */}
                <div className="my-1 flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-white/[0.06] px-3 py-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-500 text-white shadow-2xs">
                      <FolderGit2 className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Core API Engine
                    </span>
                  </div>
                  <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────
                  2. FLOATING CARD (Top Left): Milestones (1.2k closed)
                  ─────────────────────────────────────────────────────── */}
              <div
                style={{
                  ...getMilestonesStyle(),
                  transition: 'transform 1400ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 1400ms cubic-bezier(0.25, 1, 0.5, 1)',
                }}
                className={`anime-float-badge absolute top-2 sm:top-4 left-16 sm:left-24 z-20 flex items-center gap-3 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 px-3.5 py-2.5 shadow-lg backdrop-blur-md ${
                  hoveredBarIndex === null ? 'tf-idle-milestones' : ''
                }`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-900 dark:text-white">Milestones</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">1.2k closed</div>
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────
                  3. FLOATING CARD (Middle Left): Active Sprints (3.6k tasks)
                  ─────────────────────────────────────────────────────── */}
              <div
                style={{
                  ...getActiveSprintsStyle(),
                  transition: 'transform 1400ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 1400ms cubic-bezier(0.25, 1, 0.5, 1)',
                }}
                className={`anime-float-badge absolute top-28 sm:top-32 -left-2 sm:left-2 z-20 flex flex-col rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-3.5 shadow-xl backdrop-blur-md ${
                  hoveredBarIndex === null ? 'tf-idle-sprints' : ''
                }`}
              >
                <div className="mb-1 flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  {/* Vertical bars icon matching reference */}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 16V8" />
                    <path d="M12 16V4" />
                    <path d="M18 16V11" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Active Sprints</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">3.6k tasks</span>
              </div>

              {/* ───────────────────────────────────────────────────────
                  4. FLOATING AVATAR (Bottom Left): Tech Lead Avatar "TL"
                  ─────────────────────────────────────────────────────── */}
              <div
                style={{
                  ...getTlAvatarStyle(),
                  transition: 'transform 1400ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 1400ms cubic-bezier(0.25, 1, 0.5, 1)',
                }}
                className={`anime-float-badge absolute bottom-4 -left-3 sm:left-4 z-20 flex items-center justify-center ${
                  hoveredBarIndex === null ? 'tf-idle-tl' : ''
                }`}
              >
                <div className="relative">
                  {/* Avatar Circle */}
                  <div className="h-12 w-12 sm:h-14 sm:w-14 overflow-hidden rounded-full border-2 border-white dark:border-slate-800 shadow-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    <span className="text-sm font-semibold tracking-tighter">TL</span>
                  </div>
                  {/* Top-Right Badge: Active Check */}
                  <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-md ring-2 ring-white dark:ring-slate-900">
                    <CheckCircle2 className="h-3 w-3 stroke-[3]" />
                  </div>
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────
                  5. FLOATING AVATAR (Top Right): Sprint Lead Avatar "PM"
                  ─────────────────────────────────────────────────────── */}
              <div
                style={{
                  ...getPmAvatarStyle(),
                  transition: 'transform 1400ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 1400ms cubic-bezier(0.25, 1, 0.5, 1)',
                }}
                className={`anime-float-badge absolute -top-4 right-0 sm:right-2 z-30 flex flex-col items-center ${
                  hoveredBarIndex === null ? 'tf-idle-pm' : ''
                }`}
              >
                {/* Speech Bubble / Role Pill with pointer */}
                <div className="relative mb-1 rounded-full bg-[#f2545b] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md tracking-tight">
                  Sprint Lead
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rotate-45 bg-[#f2545b]" />
                </div>
                {/* Avatar with gold border */}
                <div className="relative h-11 w-11 sm:h-12 sm:w-12 overflow-hidden rounded-full border-2 border-amber-400 bg-amber-100 dark:bg-amber-950/60 shadow-xl flex items-center justify-center text-amber-900 dark:text-amber-200 font-bold text-xs">
                  <span>PM</span>
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────
                  6. MAIN FOREGROUND CARD: Interactive Animated Velocity Chart
                  ─────────────────────────────────────────────────────── */}
              <div className="relative z-10 mt-12 sm:mt-16 ml-8 sm:ml-12 rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">

                <div className="flex h-56 sm:h-64 w-full">
                  {/* Y-Axis Column */}
                  <div className="flex flex-col justify-between pr-3 sm:pr-4 text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 select-none">
                    {yAxisTicks.map((tick, i) => (
                      <span key={i} className="leading-none text-right">
                        {tick}
                      </span>
                    ))}
                  </div>

                  {/* Chart Grid & Animated Bars Container */}
                  <div className="relative flex-1 flex flex-col justify-between">

                    {/* Dashed Horizontal Grid Lines */}
                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                      {yAxisTicks.map((_, i) => (
                        <div
                          key={i}
                          className="w-full border-b border-dashed border-slate-200/90 dark:border-white/[0.08]"
                        />
                      ))}
                    </div>

                    {/* Bars Grid */}
                    <div className="relative z-10 flex h-full w-full items-end justify-around px-2 sm:px-4 pb-0.5">
                      {chartBars.map((bar, idx) => {
                        const isSelected = activeBarIndex === idx;
                        const isHovered = hoveredBarIndex === idx;
                        const effectiveHeight = barsAnimated
                          ? (isHovered ? Math.min(96, bar.height + 14) : bar.height)
                          : 0;

                        return (
                          <div
                            key={idx}
                            onMouseEnter={() => {
                              setHoveredBarIndex(idx);
                              setActiveBarIndex(idx);
                            }}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                            className="group/bar relative flex flex-col items-center h-full justify-end cursor-pointer"
                            style={{
                              width: '21%',
                              transform: isHovered ? 'translateY(-10px)' : 'translateY(0px)',
                              transition: 'transform 1400ms cubic-bezier(0.25, 1, 0.5, 1), opacity 800ms ease',
                              opacity: hoveredBarIndex !== null && !isHovered ? 0.75 : 1,
                            }}
                          >
                            {/* Outer Tinted Lavender Pill Container (matches reference) */}
                            <div className={`relative w-full h-full rounded-2xl bg-[#eff2fe] dark:bg-indigo-950/30 overflow-hidden flex flex-col justify-end transition-all duration-1000 ease-out ${
                              isHovered
                                ? 'bg-indigo-100/90 dark:bg-indigo-950/60 ring-2 ring-indigo-400/40 shadow-md'
                                : 'group-hover/bar:bg-indigo-100/70 dark:group-hover/bar:bg-indigo-950/50'
                            }`}>

                              {/* Interactive Tooltip Badge on Hover */}
                              <div
                                className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-lg bg-slate-900 dark:bg-white px-2 py-1 text-[10px] font-bold text-white dark:text-slate-950 shadow-lg transition-all duration-700 ease-out ${
                                  isHovered
                                    ? 'opacity-100 scale-100 -translate-y-2'
                                    : 'opacity-0 scale-95 pointer-events-none'
                                }`}
                              >
                                {bar.velocity} • {bar.value}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rotate-45 bg-slate-900 dark:bg-white" />
                              </div>

                              {/* The Inner Animated Fill Bar (Grows UP slowly on Hover!) */}
                              <div
                                className={`relative w-full rounded-2xl bg-gradient-to-t ${bar.fill} shadow-sm`}
                                style={{
                                  height: `${effectiveHeight}%`,
                                  transition: 'height 1400ms cubic-bezier(0.25, 1, 0.5, 1)',
                                }}
                              >
                                {/* Diagonal Texture overlay on featured Bar 3 (matches reference) */}
                                {bar.isFeatured && (
                                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:6px_6px]" />
                                )}

                                {/* Interactive Handle Indicator at top of Bar 3 */}
                                {bar.isFeatured && (
                                  <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white dark:bg-slate-900 shadow-md ring-2 ring-indigo-500 transition-transform duration-700 ease-out ${
                                    isHovered ? 'scale-125 ring-4' : 'animate-pulse'
                                  }`} />
                                )}
                              </div>
                            </div>

                            {/* Column Label / Month beneath Bar */}
                            <div className="mt-3 text-center">
                              <span
                                className={`block text-[11px] sm:text-xs font-semibold tracking-tight transition-all duration-700 ease-out ${
                                  isSelected || isHovered
                                    ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {bar.month}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              RIGHT COLUMN: Typography & Messaging (STRICTLY NO BUTTONS)
              ───────────────────────────────────────────────────────────── */}
          <div className="anime-velocity-right flex flex-col items-start lg:col-span-5 xl:col-span-5">

            {/* Main Headline */}
            <h2 className="mb-4 font-bold text-3xl sm:text-4xl lg:text-[2.75rem] text-slate-950 dark:text-white leading-[1.12] tracking-tight">
              Streamline Sprints,<br />
              Ship Faster
            </h2>

            {/* Subtitle Copy */}
            <p className="max-w-md text-sm sm:text-base text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
              Track sprint velocity, unblock dependencies, and deliver milestones with zero cognitive clutter.
            </p>

            {/* High-signal Micro Metric Badges (Informational, No Buttons) */}
            <div className="mt-8 flex flex-wrap items-center gap-6 pt-4 border-t border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">99.4% On-Time</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Milestone delivery</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">2.4x Faster</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Sprint cycle time</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
