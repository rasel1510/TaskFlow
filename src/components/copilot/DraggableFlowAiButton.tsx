'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface DraggableFlowAiButtonProps {
  onClick: () => void;
}

const STORAGE_KEY = 'flowai_pill_position_v1';
const PADDING = 16; // Minimum distance from screen edge in px

export default function DraggableFlowAiButton({ onClick }: DraggableFlowAiButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    const maxY = Math.max(minY, window.innerHeight - height - PADDING);

    return {
      x: Math.round(Math.min(Math.max(x, minX), maxX)),
      y: Math.round(Math.min(Math.max(y, minY), maxY)),
    };
  }, []);

  // Restore saved position or position in bottom-right by default
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let initX = 0;
    let initY = 0;
    let foundSaved = false;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const clamped = clampPosition(parsed.x, parsed.y);
          initX = clamped.x;
          initY = clamped.y;
          foundSaved = true;
        }
      }
    } catch {}

    if (!foundSaved) {
      const width = 112;
      const height = 44;
      const defaultX = window.innerWidth - width - 24;
      const defaultY = window.innerHeight - height - 24;
      const clamped = clampPosition(defaultX, defaultY);
      initX = clamped.x;
      initY = clamped.y;
    }

    currentPos.current = { x: initX, y: initY };
    setPosition({ x: initX, y: initY });

    if (buttonRef.current) {
      buttonRef.current.style.transform = `translate3d(${initX}px, ${initY}px, 0)`;
    }
  }, [clampPosition]);

  // Adjust position when viewport resizes or rotates on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const clamped = clampPosition(currentPos.current.x, currentPos.current.y);
      currentPos.current = clamped;
      setPosition(clamped);
      if (buttonRef.current) {
        buttonRef.current.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0)`;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

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
      // Persist the final position
      const finalPos = currentPos.current;
      setPosition(finalPos);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos));
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
      className={`group fixed z-40 flex items-center justify-center rounded-full px-4 py-2.5 [isolation:isolate] select-none touch-none focus:outline-none ${
        isDragging
          ? 'cursor-grabbing scale-105 shadow-[0_0_50px_0px_rgba(234,88,12,0.85)] transition-none'
          : 'cursor-grab hover:scale-[1.03] active:scale-95 shadow-xl shadow-black/40 hover:shadow-[0_0_45px_-8px_rgba(234,88,12,0.65)] transition-transform duration-200 ease-out'
      }`}
    >
      <style>{`
        @keyframes beam-spin { to { transform: rotate(360deg); } }
        @keyframes dots-move { 
          0% { background-position: 0 0; } 
          100% { background-position: 24px 24px; } 
        }
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
          style={{ animation: 'beam-spin 3s linear infinite' }}
        />
        <div className="absolute inset-[1px] rounded-full bg-black" />
      </div>

      {/* Inner Background & Effects */}
      <div className="absolute -z-5 overflow-hidden bg-zinc-950 rounded-full top-[1.5px] right-[1.5px] bottom-[1.5px] left-[1.5px] pointer-events-none">
        {/* Light Monotone Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/60 to-transparent" />

        {/* Animated Dots Pattern */}
        <div
          className="opacity-30 mix-blend-overlay absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '12px 12px',
            animation: 'dots-move 8s linear infinite',
          }}
        />

        {/* Orange Glow on Hover (Inner Base Light) */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-orange-500/0 blur-2xl rounded-full pointer-events-none transition-colors duration-300 group-hover:bg-orange-500/35" />
      </div>

      {/* Content - strictly preserved without altering icon or text */}
      <div className="relative z-10 flex items-center gap-2 pointer-events-none">
        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 pointer-events-none transition-transform duration-300 group-hover:scale-110">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pulse"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <span className="text-[12.5px] font-semibold tracking-tight text-white/90 transition-colors duration-300 group-hover:text-white pointer-events-none">
          FlowAi
        </span>
      </div>
    </button>
  );
}
