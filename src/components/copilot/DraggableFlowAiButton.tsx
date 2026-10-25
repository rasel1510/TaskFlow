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

  // References to track drag gesture accurately without state latency
  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    initialButtonX: 0,
    initialButtonY: 0,
    hasMoved: false,
    pointerId: -1,
  });

  // Clamp coordinates within the viewport
  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };
    const btn = buttonRef.current;
    const width = btn ? btn.offsetWidth : 110;
    const height = btn ? btn.offsetHeight : 44;

    const minX = PADDING;
    const maxX = Math.max(minX, window.innerWidth - width - PADDING);
    const minY = PADDING;
    const maxY = Math.max(minY, window.innerHeight - height - PADDING);

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }, []);

  // Restore saved position on mount (or calculate default bottom-right)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setPosition(clampPosition(parsed.x, parsed.y));
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Default position: bottom-6 right-6
    const width = 112;
    const height = 44;
    const defaultX = window.innerWidth - width - 24;
    const defaultY = window.innerHeight - height - 24;
    setPosition(clampPosition(defaultX, defaultY));
  }, [clampPosition]);

  // Adjust position when viewport resizes or rotates on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setPosition(prev => (prev ? clampPosition(prev.x, prev.y) : null));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only respond to primary button (left click / single touch)
    if (e.button !== 0) return;

    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialButtonX: rect.left,
      initialButtonY: rect.top,
      hasMoved: false,
      pointerId: e.pointerId,
    };

    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragInfo.current.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - dragInfo.current.startX;
    const deltaY = e.clientY - dragInfo.current.startY;
    const distance = Math.hypot(deltaX, deltaY);

    if (!dragInfo.current.hasMoved && distance > 6) {
      dragInfo.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragInfo.current.hasMoved) {
      const newX = dragInfo.current.initialButtonX + deltaX;
      const newY = dragInfo.current.initialButtonY + deltaY;
      const clamped = clampPosition(newX, newY);
      setPosition(clamped);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragInfo.current.pointerId !== e.pointerId) return;

    const btn = buttonRef.current;
    if (btn) {
      try {
        btn.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    const hadMoved = dragInfo.current.hasMoved;
    dragInfo.current.pointerId = -1;
    setIsDragging(false);

    if (hadMoved) {
      // Persist the newly dropped position
      setPosition(currentPos => {
        if (currentPos) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPos));
          } catch {
            // ignore
          }
        }
        return currentPos;
      });
    } else {
      // Tap / click without dragging
      onClick();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragInfo.current.pointerId === e.pointerId) {
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
      title="FlowAi (Drag to move)"
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              right: 'auto',
              bottom: 'auto',
            }
          : undefined
      }
      className={`group fixed z-40 flex items-center justify-center rounded-full px-4 py-2.5 [isolation:isolate] select-none touch-none focus:outline-none transition-all duration-500 ${
        position ? '' : 'bottom-6 right-6'
      } ${
        isDragging
          ? 'cursor-grabbing scale-105 shadow-[0_0_50px_0px_rgba(234,88,12,0.85)]'
          : 'cursor-grab hover:scale-[1.03] active:scale-95 shadow-xl shadow-black/40 hover:shadow-[0_0_45px_-8px_rgba(234,88,12,0.65)]'
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
        className={`absolute -inset-5 sm:-inset-6 rounded-full pointer-events-none -z-30 transition-all duration-500 ease-out ${
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
        className={`absolute -inset-2.5 sm:-inset-3 rounded-full pointer-events-none -z-20 transition-all duration-500 ease-out ${
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
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-orange-500/0 blur-2xl rounded-full pointer-events-none transition-colors duration-500 group-hover:bg-orange-500/35" />
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
