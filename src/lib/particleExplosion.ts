/**
 * src/lib/particleExplosion.ts
 *
 * High-performance physics-based particle explosion effect.
 * Uses GSAP + Physics2DPlugin with gravity, ballistic velocity, and automatic DOM cleanup.
 * Inspired by GSAP physics-based particle demos.
 */

import gsap from 'gsap';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';

// Register Physics2DPlugin safely on the client
if (typeof window !== 'undefined') {
  try {
    gsap.registerPlugin(Physics2DPlugin);
  } catch (err) {
    console.warn('Physics2DPlugin registration fallback:', err);
  }
}

export interface ParticleExplosionOptions {
  /** Number of particles to spawn (default: 32) */
  count?: number;
  /** Minimum dot size in pixels (default: 6) */
  sizeMin?: number;
  /** Maximum dot size in pixels (default: 16) */
  sizeMax?: number;
  /** Velocity multiplier (default: 2.8) */
  speed?: number;
  /** Gravity multiplier pulling particles down (default: 2.4) */
  gravity?: number;
  /** Color palette for the particles */
  colors?: string[];
  /** Explosion emitter radius in pixels (default: 45) */
  emitterRadius?: number;
  /** Duration of animation in seconds (default: 1.1) */
  duration?: number;
}

// Crimson / Fire / Red hues tailored for destructive Delete actions
const DEFAULT_DELETE_COLORS = [
  '#DC2626', // Red 600
  '#EF4444', // Red 500
  '#F87171', // Red 400
  '#EA580C', // Orange 600
  '#F59E0B', // Amber 500
  '#B91C1C', // Red 700
  '#FF4D4D', // Coral Red
  '#FDA4AF', // Rose 300
];

/**
 * Triggers a physics-based particle explosion bursting from an element or coordinates.
 */
export function triggerParticleExplosion(
  target: HTMLElement | MouseEvent | { clientX: number; clientY: number } | DOMRect,
  options: ParticleExplosionOptions = {}
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const {
    count = 32,
    sizeMin = 6,
    sizeMax = 15,
    speed = 2.8,
    gravity = 2.4,
    colors = DEFAULT_DELETE_COLORS,
    emitterRadius = 40,
    duration = 1.05,
  } = options;

  // Resolve explosion origin coordinates
  let originX = 0;
  let originY = 0;

  if (target instanceof HTMLElement) {
    const rect = target.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;

    // Subtle tactile haptic button pop
    try {
      gsap.fromTo(
        target,
        { scale: 0.92 },
        { scale: 1, duration: 0.35, ease: 'back.out(2)' }
      );
    } catch {}
  } else if ('clientX' in target && 'clientY' in target) {
    originX = target.clientX;
    originY = target.clientY;
  } else if ('left' in target && 'top' in target && 'width' in target && 'height' in target) {
    originX = target.left + target.width / 2;
    originY = target.top + target.height / 2;
  }

  // Create isolated particle container attached to document.body
  const container = document.createElement('div');
  container.className = 'flowsync-particle-explosion';
  container.style.cssText = `
    position: fixed;
    left: ${originX}px;
    top: ${originY}px;
    width: 0px;
    height: 0px;
    overflow: visible;
    z-index: 999999;
    pointer-events: none;
    will-change: transform;
  `;
  document.body.appendChild(container);

  const tl = gsap.timeline({
    onComplete: () => {
      // Clean up DOM container and prevent memory leaks
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  });

  const hasPhysics = Boolean(gsap.plugins && (gsap.plugins as Record<string, unknown>).physics2D);

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    const size = gsap.utils.random(sizeMin, sizeMax, 1);
    const color = colors[Math.floor(Math.random() * colors.length)];

    dot.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: 50%;
      box-shadow: 0 0 ${Math.max(4, size / 2)}px ${color}88;
      pointer-events: none;
    `;
    container.appendChild(dot);

    const angle = Math.random() * Math.PI * 2; // radians
    const length = Math.random() * (emitterRadius - size / 2);

    // Initial position within emitter radius
    gsap.set(dot, {
      x: Math.cos(angle) * length,
      y: Math.sin(angle) * length,
      xPercent: -50,
      yPercent: -50,
      force3D: true,
      scale: 1,
      opacity: 1,
    });

    if (hasPhysics) {
      // GSAP Physics2D trajectory
      tl.to(
        dot,
        {
          physics2D: {
            angle: (angle * 180) / Math.PI,
            velocity: (110 + Math.random() * 260) * speed,
            gravity: 480 * gravity,
          },
          duration: duration + Math.random() * 0.3,
          ease: 'none',
        },
        0
      );
    } else {
      // Ballistic Fallback
      const distance = (120 + Math.random() * 200) * (speed / 2.5);
      tl.to(
        dot,
        {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance + 180 * (gravity / 2),
          duration: duration + Math.random() * 0.3,
          ease: 'power2.out',
        },
        0
      );
    }

    // Fade out and shrink near the end of life
    tl.to(
      dot,
      {
        opacity: 0,
        scale: 0.15,
        duration: 0.32,
        ease: 'power2.inOut',
      },
      duration * 0.62
    );
  }
}
