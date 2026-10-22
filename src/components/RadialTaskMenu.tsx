'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface RadialTaskMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  taskTitle: string;
}

export function RadialTaskMenu({
  isOpen,
  onToggle,
  onEdit,
  onDelete,
  taskTitle,
}: RadialTaskMenuProps) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const icon = iconRef.current;
    const editBtn = editBtnRef.current;
    const deleteBtn = deleteBtnRef.current;
    if (!icon || !editBtn || !deleteBtn) return;

    if (isOpen) {
      // Smooth trigger icon rotation
      gsap.fromTo(
        icon,
        { rotation: -90, opacity: 0.5 },
        { rotation: 0, opacity: 1, duration: 0.22, ease: 'back.out(1.5)' }
      );

      // Item 1: Edit button pops out with balanced smooth timing
      gsap.to(editBtn, {
        x: -34,
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.32,
        ease: 'back.out(1.7)',
        pointerEvents: 'auto',
      });

      // Item 2: Delete button pops out alongside with 40ms stagger
      gsap.to(deleteBtn, {
        x: -68,
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.32,
        delay: 0.04,
        ease: 'back.out(1.7)',
        pointerEvents: 'auto',
      });
    } else {
      // Icon revert
      gsap.fromTo(
        icon,
        { rotation: 90, opacity: 0.5 },
        { rotation: 0, opacity: 1, duration: 0.18, ease: 'power2.inOut' }
      );

      // Smooth retraction back into trigger
      gsap.to([editBtn, deleteBtn], {
        x: 0,
        y: 0,
        scale: 0,
        opacity: 0,
        duration: 0.18,
        ease: 'power2.in',
        pointerEvents: 'none',
      });
    }
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center justify-end shrink-0">
      {/* Radial Item 2: Delete Task */}
      <button
        ref={deleteBtnRef}
        type="button"
        title="Delete task"
        aria-label={`Delete task ${taskTitle}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute w-7 h-7 rounded-full bg-white text-[#DC2626] border border-[#FECACA] shadow-sm flex items-center justify-center hover:bg-[#FEF2F2] hover:border-[#EF4444] hover:shadow hover:scale-105 active:scale-95 transition-all cursor-pointer z-20"
        style={{ transform: 'scale(0) translate(0px, 0px)', opacity: 0, pointerEvents: 'none' }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>

      {/* Radial Item 1: Edit Task */}
      <button
        ref={editBtnRef}
        type="button"
        title="Edit task"
        aria-label={`Edit task ${taskTitle}`}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="absolute w-7 h-7 rounded-full bg-white text-[#2563EB] border border-[#BFDBFE] shadow-sm flex items-center justify-center hover:bg-[#EFF6FF] hover:border-[#3B82F6] hover:shadow hover:scale-105 active:scale-95 transition-all cursor-pointer z-20"
        style={{ transform: 'scale(0) translate(0px, 0px)', opacity: 0, pointerEvents: 'none' }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

      {/* Main Action Trigger Button */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={`Actions for ${taskTitle}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer relative z-10 transition-all active:scale-95 ${
          isOpen
            ? 'bg-[#111111] text-white border border-[#111111] shadow-sm'
            : 'bg-white text-[rgba(17,17,17,0.55)] hover:text-[#111111] border border-[#E5E7EB] hover:border-[#CBD5E1] hover:bg-[#F9FAFB] shadow-xs'
        }`}
      >
        <span ref={iconRef} className="inline-flex items-center justify-center">
          {isOpen ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="19" cy="12" r="1.75" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}
