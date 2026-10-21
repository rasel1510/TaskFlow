'use client';

import React, { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Brand data
// ─────────────────────────────────────────────────────────────────────────────
const BRANDS = [
  {
    id: 'orvis',
    name: 'Orvis',
    accent: '#064e3b',
    tagline: 'Since 1856',
    front: () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <span style={{ color: '#064e3b', fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: 20, letterSpacing: '0.22em' }}>
          ORVIS
        </span>
        <span style={{ color: '#064e3b', fontSize: 9, fontWeight: 700, alignSelf: 'flex-start', marginTop: 2, opacity: 0.7 }}>®</span>
      </div>
    ),
  },
  {
    id: 'lands-end',
    name: "Lands' End",
    accent: '#00205b',
    tagline: 'Built for real life',
    front: () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#00205b' }}>
        <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>LANDS&apos; END</span>
        <svg style={{ height: 16, width: 13, flexShrink: 0 }} viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 2h6l-1 4H10L9 2z" fill="currentColor" fillOpacity="0.2" />
          <path d="M8 6h8" /><path d="M10 6L7 22h10l-3-16" />
          <line x1="12" y1="9" x2="12" y2="11" /><line x1="12" y1="14" x2="12" y2="16" />
          <rect x="10.5" y="19" width="3" height="3" fill="currentColor" />
          <path d="M4 25c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 4 1" />
        </svg>
      </div>
    ),
  },
  {
    id: 'office-depot',
    name: 'Office Depot',
    accent: '#cc0000',
    tagline: 'Taking care of business',
    front: () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1, color: '#cc0000' }}>
          <span style={{ fontWeight: 600, fontSize: 14, marginRight: 3 }}>Office</span>
          <span style={{ fontWeight: 900, fontSize: 17, textTransform: 'uppercase' }}>DEPOT</span>
        </div>
        <span style={{ fontSize: 7, fontStyle: 'italic', opacity: 0.7, marginTop: 2, letterSpacing: '0.05em', color: '#cc0000' }}>
          Taking Care of Business
        </span>
      </div>
    ),
  },
  {
    id: 'petsmart',
    name: 'PetSmart',
    accent: '#0072ce',
    tagline: 'Anything for pets',
    front: () => (
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 900, fontSize: 19, color: '#0072ce' }}>PET</span>
        <span style={{ position: 'relative', fontWeight: 700, fontSize: 16, color: '#0072ce', margin: '0 -2px' }}>
          <span style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#e31837', display: 'block' }} />
          s
        </span>
        <span style={{ fontWeight: 900, fontSize: 19, color: '#e31837', textTransform: 'uppercase' }}>MART</span>
      </div>
    ),
  },
  {
    id: 'costco',
    name: 'Costco Wholesale',
    accent: '#e31837',
    tagline: 'Members save more',
    front: () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontWeight: 900, fontStyle: 'italic', fontSize: 19, color: '#e31837', textTransform: 'uppercase', lineHeight: 1 }}>COSTCO</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3, width: '100%' }}>
          <div style={{ height: 1.5, flex: 1, backgroundColor: '#005dab' }} />
          <span style={{ fontSize: 6, fontWeight: 700, letterSpacing: '0.18em', color: '#005dab', textTransform: 'uppercase' }}>WHOLESALE</span>
          <div style={{ height: 1.5, flex: 1, backgroundColor: '#005dab' }} />
        </div>
      </div>
    ),
  },
  {
    id: 'walmart',
    name: 'Walmart',
    accent: '#0071ce',
    tagline: 'Save money, live better',
    front: () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 19, color: '#0071ce' }}>Walmart</span>
        <svg style={{ height: 17, width: 17 }} viewBox="0 0 24 24" fill="#ffc220">
          <g transform="translate(12,12)">
            {[0,60,120,180,240,300].map(d => (
              <rect key={d} x="-1.4" y="-9" width="2.8" height="5.5" rx="1.4" transform={`rotate(${d})`} />
            ))}
          </g>
        </svg>
      </div>
    ),
  },
  {
    id: 'taskflow',
    name: 'TaskFlow',
    accent: '#2563EB',
    tagline: 'Ship faster, together',
    front: () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </div>
        <span style={{ fontWeight: 800, fontSize: 18, color: '#2563EB' }}>TaskFlow</span>
      </div>
    ),
  },
  {
    id: 'linear',
    name: 'Linear',
    accent: '#5E6AD2',
    tagline: 'The issue tracker',
    front: () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="linGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="12" fill="url(#linGrad)" />
          <path d="M7 17L17 7M7 12L12 7M12 17L17 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#111' }}>Linear</span>
      </div>
    ),
  },
  {
    id: 'vercel',
    name: 'Vercel',
    accent: '#111111',
    tagline: 'Deploy at the edge',
    front: () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="17" height="17" viewBox="0 0 76 65" fill="none">
          <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#111111" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#111' }}>Vercel</span>
      </div>
    ),
  },
  {
    id: 'notion',
    name: 'Notion',
    accent: '#111111',
    tagline: 'All-in-one workspace',
    front: () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#111" />
          <path d="M7 7h4l5 6V7h1v10h-4L8 11v6H7V7z" fill="white" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#111' }}>Notion</span>
      </div>
    ),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Flip Card — flips automatically on a staggered cycle
// ─────────────────────────────────────────────────────────────────────────────
interface AutoFlipCardProps {
  brand: (typeof BRANDS)[0];
  entranceDelay: number; // ms stagger for fade-in
  flipOffset: number;    // ms offset within the global flip cycle
  isVisible: boolean;
}

function AutoFlipCard({ brand, entranceDelay, flipOffset, isVisible }: AutoFlipCardProps) {
  const [flipped, setFlipped] = useState(false);

  // Auto-flip: each card flips to back for ~2.5s, then returns, on a 6s cycle
  // staggered by flipOffset ms so they don't all flip at once
  useEffect(() => {
    if (!isVisible) return;

    let timer: ReturnType<typeof setTimeout>;

    const cycle = () => {
      // Flip to back
      setFlipped(true);
      timer = setTimeout(() => {
        // Flip back to front
        setFlipped(false);
        // Schedule next cycle (every ~5.5s)
        timer = setTimeout(cycle, 5500);
      }, 2200);
    };

    // Start first flip after initial offset so cards are staggered
    timer = setTimeout(cycle, flipOffset + 1200);

    return () => clearTimeout(timer);
  }, [isVisible, flipOffset]);

  return (
    <div
      style={{
        perspective: 900,
        width: '100%',
        height: '100%',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0px)' : 'translateY(20px)',
        transition: `opacity 0.5s cubic-bezier(0.16,1,0.3,1) ${entranceDelay}ms, transform 0.5s cubic-bezier(0.16,1,0.3,1) ${entranceDelay}ms`,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.65s cubic-bezier(0.45, 0, 0.55, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* FRONT */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            backgroundColor: '#ffffff',
            borderRadius: 14,
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
          }}
        >
          {brand.front()}
        </div>

        {/* BACK */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundColor: brand.accent,
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '0 12px',
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>
            Trusted Partner
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.25 }}>
            {brand.name}
          </span>
          <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            {brand.tagline}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Section
// ─────────────────────────────────────────────────────────────────────────────
export default function TrustedBySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const row1 = BRANDS.slice(0, 5);
  const row2 = BRANDS.slice(5, 10);

  const CARD_HEIGHT = 92;
  const GAP = 8;

  return (
    <section
      ref={sectionRef}
      aria-label="Trusted By"
      style={{
        width: '100%',
        backgroundColor: '#ffffff',
        padding: '64px 24px 72px',
      }}
    >
      {/* Label */}
      <p
        style={{
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(17,17,17,0.38)',
          marginBottom: 32,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'none' : 'translateY(10px)',
          transition: 'opacity 0.45s ease, transform 0.45s ease',
        }}
      >
        Trusted By
      </p>

      {/* Card Grid — max-width centered, gap between each separate card */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: GAP,
        }}
      >
        {/* Row 1 — 5 separate cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: GAP,
            height: CARD_HEIGHT,
          }}
        >
          {row1.map((brand, i) => (
            <AutoFlipCard
              key={brand.id}
              brand={brand}
              entranceDelay={i * 60}
              flipOffset={i * 620}
              isVisible={isVisible}
            />
          ))}
        </div>

        {/* Row 2 — 5 separate cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: GAP,
            height: CARD_HEIGHT,
          }}
        >
          {row2.map((brand, i) => (
            <AutoFlipCard
              key={brand.id}
              brand={brand}
              entranceDelay={300 + i * 60}
              flipOffset={310 + i * 620}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 680px) {
          .tb-row { grid-template-columns: repeat(3, 1fr) !important; height: auto !important; }
          .tb-row > * { height: 80px; }
        }
        @media (max-width: 440px) {
          .tb-row { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </section>
  );
}
