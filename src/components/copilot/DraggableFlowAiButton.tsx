'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface DraggableFlowAiButtonProps {
  onClick: () => void;
}

const STORAGE_KEY = 'flowai_pill_position_v1';
const PADDING = 16; // Minimum distance from screen edge in px
// The button's effects play briefly after it appears, then rest until hovered, focused or dragged —
// a constantly animating element keeps the device redrawing and drains battery on every screen.
const INTRO_MS = 4000;

export default function DraggableFlowAiButton({ onClick }: DraggableFlowAiButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setIntro(false), INTRO_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Mutable refs for zero-latency, 120fps hardware-accelerated drag tracking
  const currentPos = useRef({ x: 0, y: 0 });
  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
    pointerId: -1,
    rafId: 0,
  });

  // Clamp coordinates within visible screen boundary
  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };
    const btn = buttonRef.current;
    const width = btn ? btn.offsetWidth : 112;
    const height = btn ? btn.offsetHeight : 44;

    const minX = PADDING;
    const maxX = Math.max(minX, window.innerWidth - width - PADDING);
    const minY = PADDING;
    // On mobile screens (<768px), keep above bottom navigation bar (56px) + safe area inset
    const bottomNavOffset = window.innerWidth < 768 ? 72 : 0;
    const maxY = Math.max(minY, window.innerHeight - height - PADDING - bottomNavOffset);

    return {
      x: Math.round(Math.min(Math.max(x, minX), maxX)),
      y: Math.round(Math.min(Math.max(y, minY), maxY)),
    };
  }, []);

  /** x for docking against the left or right screen edge */
  const edgeX = useCallback((side: 'left' | 'right') => {
    const width = buttonRef.current ? buttonRef.current.offsetWidth : 112;
    return side === 'left' ? PADDING : window.innerWidth - width - PADDING;
  }, []);

  // Restore saved position (stored relative to the screen) or bottom-right by default
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let initX = 0;
    let initY = 0;
    let foundSaved = false;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const isMobile = window.innerWidth < 768;
        // Only reuse a position saved on the same kind of screen; pixel positions from a
        // desktop would otherwise land in the middle of a phone screen, covering content.
        if (
          (parsed.side === 'left' || parsed.side === 'right') &&
          typeof parsed.yRatio === 'number' &&
          parsed.mobile === isMobile
        ) {
          const clamped = clampPosition(edgeX(parsed.side), parsed.yRatio * window.innerHeight);
          initX = clamped.x;
          initY = clamped.y;
          foundSaved = true;
        }
      }
    } catch {}

    if (!foundSaved) {
      // Phones get the compact 44px round button; larger screens the labelled pill
      const width = window.innerWidth < 768 ? 44 : 112;
      const height = 44;
      const sideOffset = window.innerWidth < 768 ? 16 : 24;
      const bottomOffset = window.innerWidth < 768 ? 82 : 24;
      const defaultX = window.innerWidth - width - sideOffset;
      const defaultY = window.innerHeight - height - bottomOffset;
      const clamped = clampPosition(defaultX, defaultY);
      initX = clamped.x;
      initY = clamped.y;
    }

    currentPos.current = { x: initX, y: initY };
    setPosition({ x: initX, y: initY });

    if (buttonRef.current) {
      buttonRef.current.style.transform = `translate3d(${initX}px, ${initY}px, 0)`;
    }
  }, [clampPosition, edgeX]);

  // Adjust position when viewport resizes or rotates on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      // Stay docked to the same edge
      const btnWidth = buttonRef.current ? buttonRef.current.offsetWidth : 112;
      const side = currentPos.current.x + btnWidth / 2 < window.innerWidth / 2 ? 'left' : 'right';
      const clamped = clampPosition(edgeX(side), currentPos.current.y);
      currentPos.current = clamped;
      setPosition(clamped);
      if (buttonRef.current) {
        buttonRef.current.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0)`;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition, edgeX]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only primary button (left-click / single touch)
    if (e.button !== 0) return;

    const btn = buttonRef.current;
    if (!btn) return;

    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentPos.current.x,
      initialY: currentPos.current.y,
      hasMoved: false,
      pointerId: e.pointerId,
      rafId: 0,
    };

    try {
      btn.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragInfo.current.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - dragInfo.current.startX;
    const deltaY = e.clientY - dragInfo.current.startY;
    const distance = Math.hypot(deltaX, deltaY);

    if (!dragInfo.current.hasMoved && distance > 4) {
      dragInfo.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragInfo.current.hasMoved) {
      const rawX = dragInfo.current.initialX + deltaX;
      const rawY = dragInfo.current.initialY + deltaY;
      const clamped = clampPosition(rawX, rawY);

      currentPos.current = clamped;

      // Direct GPU transform update in next animation frame for fluid 120 FPS
      if (dragInfo.current.rafId) {
        cancelAnimationFrame(dragInfo.current.rafId);
      }

      dragInfo.current.rafId = requestAnimationFrame(() => {
        if (buttonRef.current) {
          buttonRef.current.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0)`;
        }
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragInfo.current.pointerId !== e.pointerId) return;

    if (dragInfo.current.rafId) {
      cancelAnimationFrame(dragInfo.current.rafId);
    }

    const btn = buttonRef.current;
    if (btn) {
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch {}
    }

    const wasDragging = dragInfo.current.hasMoved;
    dragInfo.current.pointerId = -1;
    setIsDragging(false);

    if (wasDragging) {
      // Snap to the nearest side edge so the button never rests over page content
      const btnWidth = btn ? btn.offsetWidth : 112;
      const side: 'left' | 'right' =
        currentPos.current.x + btnWidth / 2 < window.innerWidth / 2 ? 'left' : 'right';
      const finalPos = clampPosition(edgeX(side), currentPos.current.y);
      currentPos.current = finalPos;
      setPosition(finalPos);
      if (btn) {
        btn.style.transition = 'transform 180ms ease-out';
        btn.style.transform = `translate3d(${finalPos.x}px, ${finalPos.y}px, 0)`;
        window.setTimeout(() => {
          if (buttonRef.current) buttonRef.current.style.transition = '';
        }, 200);
      }
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ side, yRatio: finalPos.y / window.innerHeight, mobile: window.innerWidth < 768 })
        );
      } catch {}
    } else {
      // Clean tap without drag
      onClick();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragInfo.current.pointerId === e.pointerId) {
      if (dragInfo.current.rafId) cancelAnimationFrame(dragInfo.current.rafId);
      dragInfo.current.pointerId = -1;
      setIsDragging(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      aria-label="Open FlowAi"
      title="FlowAi (Drag to move anywhere)"
      style={{
        left: 0,
        top: 0,
        transform: position
          ? `translate3d(${position.x}px, ${position.y}px, 0)`
          : 'translate3d(calc(100vw - 136px), calc(100vh - 68px), 0)',
        willChange: 'transform',
      }}
      className={`flowai-fab ${intro || isDragging ? 'flowai-awake' : ''} group fixed z-40 flex items-center justify-center rounded-full w-11 h-11 md:w-auto md:h-auto md:px-4 md:py-2.5 [isolation:isolate] select-none touch-none focus:outline-none ${
        isDragging
          ? 'cursor-grabbing scale-105 shadow-[0_0_50px_0px_rgba(234,88,12,0.85)] transition-none'
          : 'cursor-grab hover:scale-[1.03] active:scale-95 shadow-xl shadow-black/40 hover:shadow-[0_0_45px_-8px_rgba(234,88,12,0.65)] transition-transform duration-200 ease-out'
      }`}
    >
      <style>{`
        @keyframes beam-spin { to { transform: rotate(360deg); } }
        @keyframes dots-move { to { transform: translate3d(12px, 12px, 0); } }
        @keyframes flowai-pulse { 50% { opacity: 0.5; } }
        /* Effects rest (paused) unless the button is new, hovered, focused or being dragged */
        .flowai-fab { --flowai-play: paused; }
        .flowai-fab.flowai-awake, .flowai-fab:focus-visible { --flowai-play: running; }
        @media (hover: hover) { .flowai-fab:hover { --flowai-play: running; } }
        @media (prefers-reduced-motion: reduce) { .flowai-fab { --flowai-play: paused !important; } }
      `}</style>

      {/* Surrounding Ambient Gradient Background Light (Outer Soft Halo) - Displays on Hover */}
      <div
        className={`absolute -inset-5 sm:-inset-6 rounded-full pointer-events-none -z-30 transition-all duration-300 ease-out ${
          isDragging ? 'opacity-100 scale-110' : 'opacity-0'
        } group-hover:opacity-100 group-hover:scale-110`}
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(234, 88, 12, 0.45) 0%, rgba(249, 115, 22, 0.22) 42%, rgba(234, 88, 12, 0.08) 68%, transparent 85%)',
          filter: 'blur(16px)',
        }}
      />

      {/* Surrounding Ambient Gradient Light (Concentrated Warm Rim Light) - Displays on Hover */}
      <div
        className={`absolute -inset-2.5 sm:-inset-3 rounded-full pointer-events-none -z-20 transition-all duration-300 ease-out ${
          isDragging ? 'opacity-100' : 'opacity-0'
        } group-hover:opacity-100`}
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(251, 146, 60, 0.48) 0%, rgba(234, 88, 12, 0.28) 55%, transparent 80%)',
          filter: 'blur(8px)',
        }}
      />

      {/* Full Border Beam (Single Beam) */}
      <div className="absolute inset-0 -z-10 rounded-full overflow-hidden p-[1px] pointer-events-none">
        <div
          className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0_280deg,#ea580c_340deg,#fdba74_360deg)]"
          style={{ animation: 'beam-spin 3s linear infinite var(--flowai-play, paused)' }}
        />
        <div className="absolute inset-[1px] rounded-full bg-black" />
      </div>

      {/* Inner Background & Effects */}
      <div className="absolute -z-5 overflow-hidden bg-zinc-950 rounded-full top-[1.5px] right-[1.5px] bottom-[1.5px] left-[1.5px] pointer-events-none">
        {/* Light Monotone Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/60 to-transparent" />

        {/* Animated Dots Pattern — moved with a GPU transform (one 12px tile per loop) instead of
            animating background-position, which forces a repaint on every frame */}
        <div
          className="opacity-30 mix-blend-overlay absolute"
          style={{
            top: -12,
            left: -12,
            right: 0,
            bottom: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '12px 12px',
            animation: 'dots-move 4s linear infinite var(--flowai-play, paused)',
          }}
        />

        {/* Orange Glow on Hover (Inner Base Light) */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-orange-500/0 blur-2xl rounded-full pointer-events-none transition-colors duration-300 group-hover:bg-orange-500/35" />
      </div>

      {/* Content - strictly preserved without altering icon or text */}
      <div className="relative z-10 flex items-center gap-2 pointer-events-none">
        <div className="w-6 h-6 md:w-5 md:h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 pointer-events-none transition-transform duration-300 group-hover:scale-110">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: 'flowai-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite var(--flowai-play, paused)' }}
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <span className="hidden md:inline text-[12.5px] font-semibold tracking-tight text-white/90 transition-colors duration-300 group-hover:text-white pointer-events-none">
          FlowAi
        </span>
      </div>
    </button>
  );
}
