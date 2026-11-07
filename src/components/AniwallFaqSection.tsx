'use client';

import React, { useState } from 'react';
import { ArrowDown, Minus, Plus } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   Authored Iridescent Helix SVG (ThreeUI Aniwall Signature Artwork)
   ───────────────────────────────────────────────────────────────────────────── */
function IridescentHelix() {
  // 62 procedurally engineered sculptural vertical fins matching Aniwall geometry
  const fins = Array.from({ length: 62 }, (_, i) => {
    const t = i / 61; // normalized parameter [0..1]
    const x = 20 + t * 1160;

    // Organic helix ribbon elevation & undulating height curve
    const waveY = Math.sin(t * Math.PI * 1.7) * 28;
    const twistProgression = Math.max(0, (t - 0.42) / 0.58);
    
    // Left side: upright, slender slats. Right side: dynamic 3D fanning spiral
    const height = 48 + Math.pow(t, 2.1) * 125 + Math.sin(t * Math.PI * 3.2) * 16;
    const y = 24 + waveY + twistProgression * 42;
    const width = 6.5 + Math.sin(t * Math.PI) * 4.5 + twistProgression * 5.5;
    const angle = t < 0.4 ? 0 : Math.sin((t - 0.4) * Math.PI * 2.1) * 32 * twistProgression;
    const opacity = 0.4 + Math.sin(t * Math.PI * 0.9) * 0.42 + (t > 0.65 ? 0.18 : 0);
    const gradIndex = i % 3;

    return { i, x, y, width, height, angle, opacity, gradIndex };
  });

  return (
    <div className="relative w-full overflow-hidden select-none pointer-events-none -mt-4 sm:-mt-6">
      <svg
        viewBox="0 0 1200 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-28 sm:h-36 md:h-48 lg:h-56 object-cover object-top"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Iridescent Gradient 1: Lavender -> Indigo -> Sky Cyan */}
          <linearGradient id="helix-grad-0" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#818CF8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.9" />
          </linearGradient>

          {/* Iridescent Gradient 2: Royal Indigo -> Violet -> Magenta Rim */}
          <linearGradient id="helix-grad-1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#6366F1" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#4338CA" stopOpacity="0.95" />
          </linearGradient>

          {/* Iridescent Gradient 3: Translucent Cyan Mint -> Soft Periwinkle */}
          <linearGradient id="helix-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E0E7FF" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#818CF8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.75" />
          </linearGradient>

          {/* Ambient Diffuse Glow Filter */}
          <filter id="helix-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Back Glow Ribbon */}
        <path
          d="M 40 50 Q 400 10, 800 60 T 1180 160"
          stroke="url(#helix-grad-0)"
          strokeWidth="60"
          strokeLinecap="round"
          opacity="0.22"
          filter="url(#helix-glow)"
        />

        {/* Authored Iridescent Lamella Fin Array */}
        <g>
          {fins.map(f => (
            <rect
              key={f.i}
              x={f.x}
              y={f.y}
              width={f.width}
              height={f.height}
              rx={f.width / 2}
              transform={`rotate(${f.angle} ${f.x + f.width / 2} ${f.y + f.height / 2})`}
              fill={`url(#helix-grad-${f.gradIndex})`}
              opacity={f.opacity}
            />
          ))}
        </g>
      </svg>

      {/* Subtle radial daylight gradient fade into the content area */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-[#0B0C0E]" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Aniwall FAQ Data Models (Preserving all 6 canonical questions & answers)
   ───────────────────────────────────────────────────────────────────────────── */
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'How does context understanding work in FlowSync?',
    answer:
      'FlowSync maintains continuous project context across tasks, documents, and sprints. It analyzes related issues, pull request links, and blocker dependencies, allowing teams to instantly identify root causes, streamline workflows, and synthesize weekly progress without cognitive overhead.',
  },
  {
    id: 'faq-2',
    question: 'Can I switch between or import from Jira, Linear, or Trello?',
    answer:
      'Yes. FlowSync includes one-click migration importers for Linear, Jira, and CSV datasets. Your team tags, assignees, sprint milestones, priorities, and descriptions are preserved and organized instantly with zero data loss.',
  },
  {
    id: 'faq-3',
    question: 'What happens to my data and privacy?',
    answer:
      'Your workspace data is cryptographically protected with AES-256 encryption at rest and TLS 1.3 in transit. We strictly never train public AI models on your proprietary company code, sprint tasks, or team discussions. Enterprise private clouds and on-premise deployments are fully supported.',
  },
  {
    id: 'faq-4',
    question: 'Does FlowSync work offline on mobile and desktop?',
    answer:
      'Yes! FlowSync is engineered as a high-performance Progressive Web App (PWA) with service-worker caching and offline sync. You can install it natively on iOS, Android, macOS, and Windows to manage roadmaps and update tasks anywhere with zero latency.',
  },
  {
    id: 'faq-5',
    question: 'Can I switch between different AI models?',
    answer:
      'Yes. FlowSync integrates seamlessly with Anthropic Claude 3.7 / 3.5 Sonnet, OpenAI GPT-4o, Google Gemini 2.0 Flash, and DeepSeek. You can supply custom API keys, connect via Model Context Protocol (MCP), or utilize our low-latency managed inference router.',
  },
  {
    id: 'faq-6',
    question: 'How do I invite teammates to my workspace?',
    answer:
      'You can invite collaborators directly by email or generate secure role-scoped workspace invite links. Team members can be provisioned as Admin, Project Manager, or Member with granular role-based access control (RBAC).',
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Aniwall Editorial FAQ Section Component
   ───────────────────────────────────────────────────────────────────────────── */
export default function AniwallFaqSection() {
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-1'); // First item open by default like Aniwall preview

  const toggleFaq = (id: string) => {
    setOpenFaqId(prev => (prev === id ? null : id));
  };

  const scrollToFirstFaq = () => {
    const el = document.getElementById('faq-accordion-list');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <section
      id="faq"
      className="relative w-full pt-4 sm:pt-6 pb-20 sm:pb-28 md:pb-32 px-4 sm:px-6 lg:px-8 select-none"
    >
      <div className="max-w-4xl mx-auto rounded-3xl border border-neutral-200/90 dark:border-neutral-800/90 bg-white dark:bg-[#0B0C0E] shadow-2xl shadow-black/[0.04] overflow-hidden">
        
        {/* Top Iridescent Helix Sculptural Banner */}
        <IridescentHelix />

        {/* Content Wrapper */}
        <div className="px-6 sm:px-12 md:px-16 pt-2 sm:pt-4 pb-12 sm:pb-16 md:pb-20">
          
          {/* Editorial Heading + Circular Scroll Button */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-12 sm:mb-16">
            <div>
              <h2 className="text-4xl sm:text-5xl md:text-[54px] font-bold tracking-tight text-neutral-950 dark:text-white leading-[1.08]">
                Still have
                <span className="block font-serif italic font-normal text-neutral-900 dark:text-neutral-100 mt-1">
                  unanswered questions?
                </span>
              </h2>
            </div>

            <button
              type="button"
              onClick={scrollToFirstFaq}
              className="self-start sm:self-center w-11 h-11 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-all cursor-pointer shadow-xs shrink-0 group active:scale-95"
              aria-label="Scroll to FAQ list"
              title="View questions"
            >
              <ArrowDown className="w-4 h-4 text-neutral-600 dark:text-neutral-400 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>

          {/* Accessible Accordion Answers List */}
          <div id="faq-accordion-list" className="w-full divide-y divide-neutral-200/90 dark:divide-neutral-800/90">
            {FAQ_ITEMS.map((item) => {
              const isOpen = openFaqId === item.id;

              return (
                <div key={item.id} className="group transition-colors">
                  <h3>
                    <button
                      type="button"
                      id={`faq-btn-${item.id}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${item.id}`}
                      onClick={() => toggleFaq(item.id)}
                      className="flex w-full items-center justify-between py-6 sm:py-7 text-left cursor-pointer transition-colors"
                    >
                      <span className="font-semibold text-base sm:text-[17px] tracking-tight text-neutral-950 dark:text-white pr-6 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-colors">
                        {item.question}
                      </span>

                      <div className="flex h-6 w-6 shrink-0 items-center justify-center text-neutral-400 group-hover:text-neutral-800 dark:text-neutral-500 dark:group-hover:text-neutral-200 transition-colors">
                        {isOpen ? (
                          <Minus className="h-4 w-4 stroke-[2]" />
                        ) : (
                          <Plus className="h-4 w-4 stroke-[2]" />
                        )}
                      </div>
                    </button>
                  </h3>

                  {isOpen && (
                    <div
                      id={`faq-panel-${item.id}`}
                      role="region"
                      aria-labelledby={`faq-btn-${item.id}`}
                      className="pb-7 pr-6 sm:pr-12 animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                      <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-[15px] leading-relaxed tracking-tight max-w-2xl font-normal">
                        {item.answer}
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
  );
}
