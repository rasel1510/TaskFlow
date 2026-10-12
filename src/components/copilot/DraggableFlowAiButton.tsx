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
      className={`fixed z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#111827] hover:bg-[#1F2937] text-white border border-white/10 select-none touch-none ${
        position ? '' : 'bottom-6 right-6'
      } ${
        isDragging
          ? 'cursor-grabbing scale-105 shadow-2xl shadow-black/40 ring-2 ring-blue-500/50'
          : 'cursor-grab hover:scale-105 active:scale-95 shadow-xl shadow-black/15 transition-transform duration-150'
      }`}
    >
      <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 pointer-events-none">
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
      <span className="text-[12.5px] font-semibold tracking-tight pointer-events-none">FlowAi</span>
    </button>
  );
}
