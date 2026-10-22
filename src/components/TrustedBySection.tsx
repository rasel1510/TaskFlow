'use client';

import React, { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// 10 Curated Brand Pairs (Front Company ⇄ Opposite Business Company)
// ─────────────────────────────────────────────────────────────────────────────

interface BrandPair {
  id: string;
  front: {
    name: string;
    category: string;
    accent: string;
    render: () => React.ReactNode;
  };
  opposite: {
    name: string;
    category: string;
    accent: string;
    render: () => React.ReactNode;
  };
}

const BRAND_PAIRS: BrandPair[] = [
  // ── ROW 1 ──────────────────────────────────────────────────────────────────
  // 1. Orvis ⇄ Shopify
  {
    id: 'orvis-shopify',
    front: {
      name: 'Orvis',
      category: 'Heritage Retail',
      accent: '#064e3b',
      render: () => (
        <div className="flex items-center gap-1 select-none">
          <span className="font-serif font-black text-xl sm:text-2xl tracking-[0.2em] text-[#064e3b] dark:text-[#34d399] uppercase">
            ORVIS
          </span>
          <span className="text-[10px] font-bold text-[#064e3b] dark:text-[#34d399] -mt-2 opacity-75">
            ®
          </span>
        </div>
      ),
    },
    opposite: {
      name: 'Shopify',
      category: 'Global Commerce',
      accent: '#008060',
      render: () => (
        <div className="flex items-center gap-2.5 select-none">
          <svg className="w-5 h-5 text-[#008060] dark:text-[#34d399] shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.33 6.07c-.04-.26-.26-.46-.53-.46-.06 0-1.89.04-1.89.04s-1.25-1.23-1.39-1.37c-.14-.14-.42-.1-.53-.08-.03 0-.62.19-1.58.5-.97-1.42-2.31-2.45-3.8-2.45-.1 0-.21 0-.31.02C8.6 2.37 8.08 3 7.8 3.86c-.83.27-1.42.45-1.45.46-.44.14-.45.15-.51.58L4.1 17.58l9.9 1.88 5.33-1.63V6.07zM11.63 4.1c.36-.78.96-1.12 1.63-1.12.06 0 .12 0 .18.01.99.11 1.95.83 2.68 1.95l-4.49 1.41V4.1z" />
          </svg>
          <span className="font-sans font-extrabold text-lg sm:text-xl tracking-tight text-[#008060] dark:text-[#34d399]">
            Shopify
          </span>
        </div>
      ),
    },
  },

  // 2. Lands' End ⇄ Stripe
  {
    id: 'lands-end-stripe',
    front: {
      name: "Lands' End",
      category: 'Classic Apparel',
      accent: '#00205b',
      render: () => (
        <div className="flex items-center gap-2 select-none text-[#00205b] dark:text-[#60a5fa]">
          <span className="font-sans font-black text-base sm:text-lg tracking-tight uppercase">
            LANDS&apos; END
          </span>
          <svg className="h-5 w-4 shrink-0" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M9 2h6l-1 4H10L9 2z" fill="currentColor" fillOpacity="0.2" />
            <path d="M8 6h8" />
            <path d="M10 6L7 22h10l-3-16" />
            <line x1="12" y1="9" x2="12" y2="11" />
            <line x1="12" y1="14" x2="12" y2="16" />
            <rect x="10.5" y="19" width="3" height="3" fill="currentColor" />
          </svg>
        </div>
      ),
    },
    opposite: {
      name: 'Stripe',
      category: 'Financial Infrastructure',
      accent: '#635BFF',
      render: () => (
        <div className="flex items-center gap-2 select-none text-[#635BFF] dark:text-[#818cf8]">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.96 15.688.5 12.35.5 6.455.5 2.378 3.593 2.378 8.784c0 6.643 7.828 6.273 7.828 9.539 0 1.05-.85 1.488-2.228 1.488-2.27 0-5.324-1.157-7.37-2.348L0 23.013C2.26 24.237 5.568 25 8.956 25c6.31 0 10.654-3.084 10.654-8.498 0-6.903-5.634-6.549-5.634-7.365z" />
          </svg>
          <span className="font-sans font-black text-xl sm:text-2xl tracking-tight">
            stripe
          </span>
        </div>
      ),
    },
  },

  // 3. Office Depot ⇄ Slack
  {
    id: 'office-depot-slack',
    front: {
      name: 'Office Depot',
      category: 'Enterprise Supplies',
      accent: '#cc0000',
      render: () => (
        <div className="flex items-baseline select-none text-[#cc0000] dark:text-[#f87171] leading-none">
          <span className="font-sans font-bold text-base sm:text-lg tracking-tight mr-1">Office</span>
          <span className="font-sans font-black text-lg sm:text-xl uppercase">DEPOT</span>
        </div>
      ),
    },
    opposite: {
      name: 'Slack',
      category: 'Team Communication',
      accent: '#4A154B',
      render: () => (
        <div className="flex items-center gap-2.5 select-none">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
            <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
            <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D" />
            <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E" />
          </svg>
          <span className="font-sans font-black text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white">
            Slack
          </span>
        </div>
      ),
    },
  },

  // 4. PetSmart ⇄ Datadog
  {
    id: 'petsmart-datadog',
    front: {
      name: 'PetSmart',
      category: 'Specialty Retail',
      accent: '#0072ce',
      render: () => (
        <div className="flex items-baseline select-none text-[#0072ce] dark:text-[#38bdf8]">
          <span className="font-sans font-black text-base sm:text-lg tracking-tight">PET</span>
          <span className="relative font-sans font-bold text-sm sm:text-base lowercase -mx-0.5">
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-[#e31837] dark:bg-[#fb7185]" />
            s
          </span>
          <span className="font-sans font-black text-base sm:text-lg text-[#e31837] dark:text-[#fb7185] uppercase">
            MART
          </span>
        </div>
      ),
    },
    opposite: {
      name: 'Datadog',
      category: 'Cloud Telemetry',
      accent: '#632CA6',
      render: () => (
        <div className="flex items-center gap-2 select-none text-[#632CA6] dark:text-[#a855f7]">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.46 8.35a3.86 3.86 0 0 0-3.66-2.55h-7.6a3.86 3.86 0 0 0-3.86 3.86v4.68a3.86 3.86 0 0 0 3.86 3.86h7.6a3.86 3.86 0 0 0 3.86-3.86V9.65a3.84 3.84 0 0 0-.2-1.3zm-6.2 6.65h-4.5a1.2 1.2 0 1 1 0-2.4h4.5a1.2 1.2 0 1 1 0 2.4z" />
          </svg>
          <span className="font-sans font-extrabold text-base sm:text-lg tracking-tight">
            Datadog
          </span>
        </div>
      ),
    },
  },

  // 5. Costco ⇄ Atlassian
  {
    id: 'costco-atlassian',
    front: {
      name: 'Costco Wholesale',
      category: 'Global Wholesale',
      accent: '#e31837',
      render: () => (
        <div className="flex flex-col items-center select-none leading-none">
          <span className="font-sans font-black italic text-base sm:text-lg text-[#e31837] dark:text-[#fb7185] tracking-tight uppercase">
            COSTCO
          </span>
          <div className="flex items-center gap-1 mt-0.5 w-full">
            <div className="h-[1px] flex-1 bg-[#005dab] dark:bg-[#38bdf8]" />
            <span className="text-[6px] font-sans font-bold tracking-widest text-[#005dab] dark:text-[#38bdf8] uppercase">
              WHOLESALE
            </span>
            <div className="h-[1px] flex-1 bg-[#005dab] dark:bg-[#38bdf8]" />
          </div>
        </div>
      ),
    },
    opposite: {
      name: 'Atlassian',
      category: 'Agile & DevOps',
      accent: '#0052CC',
      render: () => (
        <div className="flex items-center gap-2 select-none text-[#0052CC] dark:text-[#60a5fa]">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.53 1.96a.93.93 0 0 0-.93.93v8.52c0 3.32 2.7 6.02 6.02 6.02h2.46a.93.93 0 0 0 .93-.93c0-3.8-3.08-6.88-6.88-6.88h-.67V2.89a.93.93 0 0 0-.93-.93zM4.92 7.7a.93.93 0 0 0-.93.93c0 7.42 6.04 13.44 13.46 13.44h.59a.93.93 0 0 0 .93-.93v-2.46c0-3.32-2.7-6.02-6.02-6.02h-7.1V8.63a.93.93 0 0 0-.93-.93z" />
          </svg>
          <span className="font-sans font-bold text-base sm:text-lg tracking-tight">
            Atlassian
          </span>
        </div>
      ),
    },
  },

  // ── ROW 2 ──────────────────────────────────────────────────────────────────
  // 6. Walmart ⇄ Airbnb
  {
    id: 'walmart-airbnb',
    front: {
      name: 'Walmart',
      category: 'Retail Enterprise',
      accent: '#0071ce',
      render: () => (
        <div className="flex items-center gap-1.5 select-none text-[#0071ce] dark:text-[#60a5fa]">
          <span className="font-sans font-bold text-base sm:text-lg tracking-tight">Walmart</span>
          <svg className="h-4 w-4 text-[#ffc220] shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <g transform="translate(12, 12)">
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <rect key={deg} x="-1.2" y="-8.5" width="2.4" height="5" rx="1.2" transform={`rotate(${deg})`} />
              ))}
            </g>
          </svg>
        </div>
      ),
    },
    opposite: {
      name: 'Airbnb',
      category: 'Hospitality Tech',
      accent: '#FF385C',
      render: () => (
        <div className="flex items-center gap-2 select-none text-[#FF385C] dark:text-[#fb7185]">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C6.38 0 4.14 4.8 4.14 8.76c0 4.3 2.76 9.4 7.86 15.24.58.67 1.62.67 2.2 0 5.1-5.84 7.86-10.94 7.86-15.24C22.06 4.8 19.82 0 12.2 0zm0 15.8c-2.4 0-4.3-1.9-4.3-4.3s1.9-4.3 4.3-4.3 4.3 1.9 4.3 4.3-1.9 4.3-4.3 4.3z" />
          </svg>
          <span className="font-sans font-black text-lg sm:text-xl tracking-tight">
            airbnb
          </span>
        </div>
      ),
    },
  },

  // 7. Linear ⇄ GitHub
  {
    id: 'linear-github',
    front: {
      name: 'Linear',
      category: 'Issue Tracking',
      accent: '#5E6AD2',
      render: () => (
        <div className="flex items-center gap-2 select-none">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="linGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="12" fill="url(#linGrad)" />
            <path d="M7 17L17 7M7 12L12 7M12 17L17 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-sans font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
            Linear
          </span>
        </div>
      ),
    },
    opposite: {
      name: 'GitHub',
      category: 'Developer Platform',
      accent: '#24292e',
      render: () => (
        <div className="flex items-center gap-2 select-none text-slate-900 dark:text-white">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          <span className="font-sans font-bold text-base sm:text-lg tracking-tight">
            GitHub
          </span>
        </div>
      ),
    },
  },

  // 8. Vercel ⇄ Figma
  {
    id: 'vercel-figma',
    front: {
      name: 'Vercel',
      category: 'Frontend Cloud',
      accent: '#000000',
      render: () => (
        <div className="flex items-center gap-2 select-none text-slate-900 dark:text-white">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 76 65" fill="currentColor">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="font-sans font-bold text-base sm:text-lg tracking-tight">
            Vercel
          </span>
        </div>
      ),
    },
    opposite: {
      name: 'Figma',
      category: 'Design Systems',
      accent: '#F24E1E',
      render: () => (
        <div className="flex items-center gap-2 select-none">
          <svg className="w-4 h-6 shrink-0" viewBox="0 0 38 57">
            <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE" />
            <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83" />
            <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262" />
            <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E" />
            <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF" />
          </svg>
          <span className="font-sans font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
            Figma
          </span>
        </div>
      ),
    },
  },

  // 9. Notion ⇄ Dropbox
  {
    id: 'notion-dropbox',
    front: {
      name: 'Notion',
      category: 'Connected Workspace',
      accent: '#000000',
      render: () => (
        <div className="flex items-center gap-2 select-none text-slate-900 dark:text-white">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="currentColor" />
            <path d="M7 7h4l5 6V7h1v10h-4L8 11v6H7V7z" fill="white" className="dark:fill-slate-900" />
          </svg>
          <span className="font-sans font-bold text-base sm:text-lg tracking-tight">
            Notion
          </span>
        </div>
      ),
    },
    opposite: {
      name: 'Dropbox',
      category: 'Cloud Storage',
      accent: '#0061FF',
      render: () => (
        <div className="flex items-center gap-2 select-none text-[#0061FF] dark:text-[#60a5fa]">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 2l6 4-6 4-6-4 6-4zm12 0l6 4-6 4-6-4 6-4zM0 14l6-4 6 4-6 4-6-4zm24 0l-6-4-6 4 6 4 6-4zM6 19.5l6-4 6 4-6 4.5-6-4.5z" />
          </svg>
          <span className="font-sans font-extrabold text-base sm:text-lg tracking-tight">
            Dropbox
          </span>
        </div>
      ),
    },
  },

  // 10. FlowSync ⇄ HubSpot
  {
    id: 'flowsync-hubspot',
    front: {
      name: 'FlowSync',
      category: 'Agile Orchestration',
      accent: '#2563EB',
      render: () => (
        <div className="flex items-center gap-2 select-none">
          <div className="w-5 h-5 rounded-md bg-[#2563EB] flex items-center justify-center shrink-0 shadow-xs">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <span className="font-sans font-extrabold text-base sm:text-lg tracking-tight text-[#2563EB] dark:text-[#60a5fa]">
            FlowSync
          </span>
        </div>
      ),
    },
    opposite: {
      name: 'HubSpot',
      category: 'Inbound Growth CRM',
      accent: '#FF7A59',
      render: () => (
        <div className="flex items-center gap-2 select-none text-[#FF7A59] dark:text-[#fb923c]">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.8 7.3c-.6 0-1.1.2-1.5.5L14 5.4c.1-.3.1-.6.1-.9 0-1.7-1.4-3.1-3.1-3.1S7.9 2.8 7.9 4.5c0 .5.1.9.3 1.3L5.4 7.7c-.4-.4-1-.6-1.6-.6-1.5 0-2.8 1.3-2.8 2.8 0 1.5 1.3 2.8 2.8 2.8.7 0 1.3-.3 1.8-.7l2.8 2c-.1.3-.1.6-.1.9 0 1.7 1.4 3.1 3.1 3.1s3.1-1.4 3.1-3.1c0-.4-.1-.8-.2-1.2l3-1.8c.4.3.9.5 1.4.5 1.5 0 2.8-1.3 2.8-2.8.2-1.6-1-2.9-2.6-2.9z" />
          </svg>
          <span className="font-sans font-bold text-base sm:text-lg tracking-tight">
            HubSpot
          </span>
        </div>
      ),
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Individual 3D Flip Card Component
// ─────────────────────────────────────────────────────────────────────────────

interface FlipCardProps {
  pair: BrandPair;
  staggerDelay: number;
}

function FlipCard({ pair, staggerDelay }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Automatic periodic flipping sequence
  useEffect(() => {
    let flipTimeout: NodeJS.Timeout;
    let revertTimeout: NodeJS.Timeout;

    const intervalId = setInterval(() => {
      // Don't interrupt if user is actively hovering
      if (isHovered) return;

      setFlipped(true);
      revertTimeout = setTimeout(() => {
        setFlipped(false);
      }, 3000);
    }, 7200);

    // Initial stagger delay so cards flip sequentially in a wave
    flipTimeout = setTimeout(() => {
      if (!isHovered) {
        setFlipped(true);
        revertTimeout = setTimeout(() => {
          setFlipped(false);
        }, 3000);
      }
    }, staggerDelay);

    return () => {
      clearInterval(intervalId);
      clearTimeout(flipTimeout);
      clearTimeout(revertTimeout);
    };
  }, [staggerDelay, isHovered]);

  const showOpposite = isHovered || flipped;

  return (
    <div
      className="group relative h-20 sm:h-22 md:h-24 w-full cursor-pointer select-none"
      style={{ perspective: '1100px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${pair.front.name} ⇄ ${pair.opposite.name}`}
    >
      <div
        className="relative h-full w-full rounded-xl transition-transform duration-700 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: showOpposite ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── FRONT SIDE: Logo & Name perfectly centered vertically & horizontally ── */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl border border-slate-200/90 dark:border-white/[0.12] bg-white dark:bg-slate-900/90 shadow-xs group-hover:shadow-md transition-shadow px-4 py-3"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {pair.front.render()}
        </div>

        {/* ── OPPOSITE (BACK) SIDE: Logo & Name perfectly centered vertically & horizontally ── */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl border border-slate-200/90 dark:border-white/[0.12] bg-white dark:bg-slate-900 shadow-sm group-hover:shadow-md transition-shadow px-4 py-3"
          style={{
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {pair.opposite.render()}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Section: 2 Rows of 5 Cards Grid
// ─────────────────────────────────────────────────────────────────────────────

export default function TrustedBySection() {
  const row1 = BRAND_PAIRS.slice(0, 5);
  const row2 = BRAND_PAIRS.slice(5, 10);

  return (
    <section
      aria-label="Trusted Enterprise Partners"
      className="relative w-full bg-white dark:bg-black py-8 sm:py-12 select-none"
    >
      <div className="relative mx-auto max-w-[1360px] px-3 sm:px-6 lg:px-8">
        {/* Title above cards */}
        <div className="mb-6 sm:mb-8 text-center">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Trusted Users
          </p>
        </div>

        {/* 2 Rows of 5 Separated Cards Grid with reduced gap and wider card layout */}
        <div className="flex flex-col gap-2 sm:gap-2.5 lg:gap-3 w-full">
          {/* Row 1 — 5 Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5 lg:gap-3">
            {row1.map((pair, index) => (
              <FlipCard
                key={pair.id}
                pair={pair}
                staggerDelay={800 + index * 1100}
              />
            ))}
          </div>

          {/* Row 2 — 5 Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5 lg:gap-3">
            {row2.map((pair, index) => (
              <FlipCard
                key={pair.id}
                pair={pair}
                staggerDelay={1400 + index * 1100}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
