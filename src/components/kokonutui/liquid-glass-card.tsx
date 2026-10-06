'use client';

/**
 * @author: @dorianbaffier (KokonutUI)
 * @description: Liquid Glass Card & Button - Apple-inspired refractive effect with SVG displacement filters
 * @license: MIT
 * @website: https://kokonutui.com
 */

import React, { useId, useMemo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';

// Constants for Apple-inspired liquid glass specular and inner refraction shadows
const GLASS_SHADOW_LIGHT =
  'shadow-[0_0_6px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3px_rgba(0,0,0,0.9),inset_-3px_-3px_0.5px_-3px_rgba(0,0,0,0.85),inset_1px_1px_1px_-0.5px_rgba(0,0,0,0.6),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.6),inset_0_0_6px_6px_rgba(0,0,0,0.12),inset_0_0_2px_2px_rgba(0,0,0,0.06),0_0_12px_rgba(255,255,255,0.15)]';

const GLASS_SHADOW_DARK =
  'dark:shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_-3px_-3px_0.5px_-3.5px_rgba(255,255,255,0.85),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.6),inset_-1px_-1px_1px_-0.5px_rgba(255,255,255,0.6),inset_0_0_6px_6px_rgba(255,255,255,0.12),inset_0_0_2px_2px_rgba(255,255,255,0.06),0_0_12px_rgba(0,0,0,0.15)]';

export const GLASS_SHADOW = `${GLASS_SHADOW_LIGHT} ${GLASS_SHADOW_DARK}`;

export const DEFAULT_GLASS_FILTER_SCALE = 30;
export const BUTTON_GLASS_FILTER_SCALE = 70;

// Shared SVG glass filter component
interface GlassFilterProps {
  id: string;
  scale?: number;
}

export const GlassFilter = React.memo(({ id, scale = DEFAULT_GLASS_FILTER_SCALE }: GlassFilterProps) => (
  <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden" focusable={false}>
    <title>Glass Effect Filter</title>
    <defs>
      <filter
        colorInterpolationFilters="sRGB"
        height="200%"
        id={id}
        width="200%"
        x="-50%"
        y="-50%"
      >
        <feTurbulence
          baseFrequency="0.05 0.05"
          numOctaves="1"
          result="turbulence"
          seed="1"
          type="fractalNoise"
        />
        <feGaussianBlur
          in="turbulence"
          result="blurredNoise"
          stdDeviation="2"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="blurredNoise"
          result="displaced"
          scale={scale}
          xChannelSelector="R"
          yChannelSelector="B"
        />
        <feGaussianBlur in="displaced" result="finalBlur" stdDeviation="4" />
        <feComposite in="finalBlur" in2="finalBlur" operator="over" />
      </filter>
    </defs>
  </svg>
));
GlassFilter.displayName = 'GlassFilter';

// Liquid Button - extends Button with glass effect
const liquidButtonVariants = cva(
  'relative transition-all duration-200 motion-reduce:transition-none cursor-pointer',
  {
    variants: {
      liquidVariant: {
        default:
          'active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:hover:scale-100 [@media(hover:hover)]:hover:scale-[1.02]',
        none: '',
      },
    },
    defaultVariants: {
      liquidVariant: 'default',
    },
  }
);

export type LiquidButtonProps = ButtonProps &
  VariantProps<typeof liquidButtonVariants> & {
    enableFilter?: boolean;
  };

export function LiquidButton({
  className,
  liquidVariant = 'default',
  enableFilter = true,
  children,
  ...props
}: LiquidButtonProps) {
  const rawId = useId();
  const filterId = useMemo(() => `liquid-btn-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [rawId]);

  return (
    <>
      <Button
        className={cn(
          liquidButtonVariants({ liquidVariant }),
          'relative overflow-hidden border border-black/10 dark:border-white/15 bg-white/70 dark:bg-black/60 backdrop-blur-md',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-0 rounded-[inherit]',
            GLASS_SHADOW
          )}
        />
        {enableFilter && (
          <div
            className="pointer-events-none absolute inset-0 isolate -z-10 overflow-hidden rounded-[inherit]"
            style={{ backdropFilter: `url("#${filterId}")` }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </Button>
      {enableFilter && <GlassFilter id={filterId} scale={BUTTON_GLASS_FILTER_SCALE} />}
    </>
  );
}

// Liquid Glass Card - KokonutUI Apple-inspired card
const liquidGlassCardVariants = cva(
  'group relative overflow-hidden backdrop-blur-md transition-all duration-300',
  {
    variants: {
      glassSize: {
        sm: 'p-4',
        default: 'p-6',
        lg: 'p-8',
      },
      glassTone: {
        default: 'bg-white/60 dark:bg-black/50 border-black/10 dark:border-white/10',
        blue: 'bg-blue-50/30 dark:bg-blue-950/20 border-blue-500/20 dark:border-blue-400/20',
        purple: 'bg-purple-50/30 dark:bg-purple-950/20 border-purple-500/20 dark:border-purple-400/20',
        pink: 'bg-pink-50/30 dark:bg-pink-950/20 border-pink-500/20 dark:border-pink-400/20',
      },
    },
    defaultVariants: {
      glassSize: 'default',
      glassTone: 'default',
    },
  }
);

export type LiquidGlassCardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof liquidGlassCardVariants> & {
    glassEffect?: boolean;
    scale?: number;
  };

export function LiquidGlassCard({
  className,
  glassSize,
  glassTone,
  glassEffect = true,
  scale = DEFAULT_GLASS_FILTER_SCALE,
  children,
  ...props
}: LiquidGlassCardProps) {
  const rawId = useId();
  const filterId = useMemo(() => `liquid-card-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [rawId]);

  return (
    <div
      className={cn(
        'rounded-2xl border',
        liquidGlassCardVariants({ glassSize, glassTone }),
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-[inherit]',
          GLASS_SHADOW
        )}
      />

      {glassEffect && (
        <>
          <div
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
            style={{ backdropFilter: `url("#${filterId}")` }}
          />
          <GlassFilter id={filterId} scale={scale} />
        </>
      )}

      {/* Subtle specular sheen sweep on hover */}
      <div className="pointer-events-none absolute -inset-full bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 -rotate-45" />

      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default LiquidGlassCard;
