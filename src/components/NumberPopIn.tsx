'use client';

import React, { useEffect, useState } from 'react';

interface NumberPopInProps {
  value: number | string;
  className?: string;
}

/**
 * Number Pop-in animation component
 * Implements transitions.dev #02 pattern:
 * Each digit enters with upward translate, blurred entry, and staggered timing for trailing digits.
 */
export function NumberPopIn({ value, className }: NumberPopInProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const str = String(value);

  useEffect(() => {
    setIsAnimating(false);
    const frameId = requestAnimationFrame(() => {
      setIsAnimating(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <span className={`t-digit-group ${isAnimating ? 'is-animating' : ''} ${className || ''}`}>
      {str.split('').map((char, idx, arr) => {
        let stagger: string | undefined = undefined;
        if (arr.length > 2) {
          if (idx === arr.length - 2) stagger = '1';
          else if (idx === arr.length - 1) stagger = '2';
        }
        return (
          <span key={idx} className="t-digit" data-stagger={stagger}>
            {char}
          </span>
        );
      })}
    </span>
  );
}
