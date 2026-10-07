'use client';

import React, { useEffect, useRef } from 'react';
import { animate } from 'animejs';

const BRANDS = [
  {
    id: 'orvis',
    name: 'Orvis',
    render: () => (
      <div className="flex items-center text-[#064e3b] dark:text-[#34d399] select-none">
        <span className="font-serif font-black text-xl sm:text-2xl md:text-[26px] tracking-[0.22em] uppercase">
          ORVIS
        </span>
        <span className="ml-0.5 text-[9px] font-sans font-bold self-start mt-0.5 opacity-80">
          ®
        </span>
      </div>
    ),
  },
  {
    id: 'lands-end',
    name: "Lands' End",
    render: () => (
      <div className="flex items-center gap-1.5 text-[#00205b] dark:text-[#60a5fa] select-none">
        <span className="font-sans font-black text-lg sm:text-xl md:text-[22px] tracking-tight uppercase">
          LANDS&apos; END
        </span>
        <svg
          className="h-5 w-4.5 sm:h-6 sm:w-5 text-[#00205b] dark:text-[#60a5fa] shrink-0"
          viewBox="0 0 24 28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 2h6l-1 4H10L9 2z" fill="currentColor" fillOpacity="0.2" />
          <path d="M8 6h8" />
          <path d="M10 6L7 22h10l-3-16" />
          <line x1="12" y1="9" x2="12" y2="11" />
          <line x1="12" y1="14" x2="12" y2="16" />
          <rect x="10.5" y="19" width="3" height="3" fill="currentColor" />
          <path d="M4 25c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 4 1" />
        </svg>
      </div>
    ),
  },
  {
    id: 'office-depot',
    name: 'Office Depot',
    render: () => (
      <div className="flex flex-col items-center select-none">
        <div className="flex items-baseline text-[#cc0000] dark:text-[#f87171] leading-none">
          <span className="font-sans font-bold text-base sm:text-lg md:text-[20px] tracking-tight mr-1">
            Office
          </span>
          <span className="font-sans font-black text-lg sm:text-xl md:text-[22px] tracking-tight uppercase">
            DEPOT
          </span>
        </div>
        <span className="text-[7px] sm:text-[8px] font-serif italic text-[#cc0000]/80 dark:text-[#f87171]/80 mt-0.5 tracking-wider">
          Taking Care of Business
        </span>
      </div>
    ),
  },
  {
    id: 'petsmart',
    name: 'PetSmart',
    render: () => (
      <div className="flex items-baseline select-none">
        <span className="font-sans font-black text-lg sm:text-xl md:text-[22px] text-[#0072ce] dark:text-[#38bdf8] tracking-tight">
          PET
        </span>
        <span className="relative font-sans font-bold text-base sm:text-lg md:text-[20px] text-[#0072ce] dark:text-[#38bdf8] lowercase -mx-0.5">
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-[#e31837] dark:bg-[#fb7185] shadow-xs" />
          s
        </span>
        <span className="font-sans font-black text-lg sm:text-xl md:text-[22px] text-[#e31837] dark:text-[#fb7185] tracking-tight uppercase">
          MART
        </span>
      </div>
    ),
  },
  {
    id: 'costco',
    name: 'Costco Wholesale',
    render: () => (
      <div className="flex flex-col items-center select-none">
        <span className="font-sans font-black italic text-lg sm:text-xl md:text-[22px] text-[#e31837] dark:text-[#fb7185] tracking-tight uppercase leading-none">
          COSTCO
        </span>
        <div className="flex items-center gap-1 mt-0.5 w-full">
          <div className="h-[1.5px] flex-1 bg-[#005dab] dark:bg-[#38bdf8]" />
          <span className="text-[6.5px] sm:text-[7.5px] font-sans font-bold tracking-[0.18em] text-[#005dab] dark:text-[#38bdf8] uppercase">
            WHOLESALE
          </span>
          <div className="h-[1.5px] flex-1 bg-[#005dab] dark:bg-[#38bdf8]" />
        </div>
      </div>
    ),
  },
  {
    id: 'walmart',
    name: 'Walmart',
    render: () => (
      <div className="flex items-center gap-1 select-none">
        <span className="font-sans font-bold text-lg sm:text-xl md:text-[22px] text-[#0071ce] dark:text-[#60a5fa] tracking-tight">
          Walmart
        </span>
        <svg
          className="h-4 w-4 sm:h-5 sm:w-5 text-[#ffc220] shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <g transform="translate(12, 12)">
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <rect
                key={deg}
                x="-1.5"
                y="-10"
                width="3"
                height="6"
                rx="1.5"
                transform={`rotate(${deg})`}
              />
            ))}
          </g>
        </svg>
      </div>
    ),
  },
];

export default function TrustedBySection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Smooth Entrance Reveal with Anime.js
    try {
      animate('.anime-trusted-fade', {
        opacity: [0, 1],
        translateY: [14, 0],
        duration: 750,
        ease: 'outExpo',
      });
    } catch (err) {
      console.warn('Anime.js TrustedBy fallback:', err);
    }
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="Trusted By"
      className="relative w-full border-y border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] backdrop-blur-xs py-9 sm:py-12 overflow-hidden select-none"
    >
      {/* Ambient background soft glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-24 w-3/4 max-w-4xl bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-emerald-500/5 blur-2xl" />
      </div>

      {/* Header Label: Trusted By */}
      <div className="anime-trusted-fade mb-7 sm:mb-9 text-center px-4">
        <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-slate-500 dark:text-slate-400">
          Trusted By
        </p>
      </div>

      {/* Marquee Wrapper with soft edge gradients */}
      <div className="anime-trusted-fade relative w-full overflow-hidden">
        {/* Left & Right Soft Fade Masks */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-16 sm:w-28 md:w-36 bg-gradient-to-r from-slate-50 dark:from-black to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-16 sm:w-28 md:w-36 bg-gradient-to-l from-slate-50 dark:from-black to-transparent" />

        {/* Infinite Right-to-Left Continuous Scrolling Track */}
        <div className="animate-marquee-track flex items-center gap-12 sm:gap-16 md:gap-20 lg:gap-24">
          {/* First loop of brands */}
          {BRANDS.map((brand, idx) => (
            <div
              key={`loop-1-${brand.id}-${idx}`}
              className="shrink-0 flex items-center justify-center px-2 py-1 transition-transform duration-300 hover:scale-110 cursor-pointer"
              title={brand.name}
            >
              {brand.render()}
            </div>
          ))}

          {/* Second identical loop of brands for seamless infinite loop */}
          {BRANDS.map((brand, idx) => (
            <div
              key={`loop-2-${brand.id}-${idx}`}
              className="shrink-0 flex items-center justify-center px-2 py-1 transition-transform duration-300 hover:scale-110 cursor-pointer"
              title={brand.name}
            >
              {brand.render()}
            </div>
          ))}

          {/* Third loop to guarantee zero gaps on ultra-wide screens */}
          {BRANDS.map((brand, idx) => (
            <div
              key={`loop-3-${brand.id}-${idx}`}
              className="shrink-0 flex items-center justify-center px-2 py-1 transition-transform duration-300 hover:scale-110 cursor-pointer"
              title={brand.name}
            >
              {brand.render()}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
