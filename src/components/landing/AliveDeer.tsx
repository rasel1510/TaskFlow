/**
 * The deer in the landing-page hero, brought to life.
 *
 * The hero photo (`/hero-landscape-scene.jpg`) has the original deer painted out; this SVG redraws it
 * in the same spot, size and colors. Its resting pose is the photo's grazing pose, then on a slow loop
 * it nibbles, raises its head, twitches its ears, looks forward and back over its shoulder, flicks its
 * tail and goes back to grazing. Animations live in globals.css (`.deer-*`) and stop for
 * `prefers-reduced-motion`, leaving the grazing pose.
 *
 * Coordinates are photo pixels relative to (1112, 424) in the 1376×768 source image.
 */

export const DEER_BOX = { x: 1112, y: 424, w: 48, h: 44, imageW: 1376, imageH: 768 } as const;

export default function AliveDeer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox={`0 0 ${DEER_BOX.w} ${DEER_BOX.h}`}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="deer-coat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7A4A2E" />
          <stop offset="0.55" stopColor="#5A3420" />
          <stop offset="1" stopColor="#3A2215" />
        </linearGradient>
        <linearGradient id="deer-neck" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6E4029" />
          <stop offset="1" stopColor="#4A2B1A" />
        </linearGradient>
        <radialGradient id="deer-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#1F3A08" stopOpacity="0.45" />
          <stop offset="1" stopColor="#1F3A08" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft contact shadow on the grass */}
      <ellipse cx="30" cy="37.8" rx="13" ry="2.2" fill="url(#deer-shadow)" />

      {/* Far-side legs (slightly darker) */}
      <g stroke="#26160D" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M36.4 25.4 L37.4 29.6 L36.9 34.2" />
        <path d="M25.2 26.6 L25.6 38" />
      </g>

      {/* Body (breathes): straight back, deep chest, tucked belly, rounded haunch */}
      <g className="deer-body">
        <path
          d="M21.8 17.6 C25.6 16.8 31.4 16.6 36.6 16.9 C39.6 17.1 41.4 18.4 41.6 20.6 C41.8 22.8 41 24.6 39.6 25.9 L37.8 26.2 C35.6 25.6 33 25.6 30.4 26.2 C27.8 26.8 25.2 27.6 23.4 27.6 C20.8 27.6 19 26.4 18.6 24.2 C18.2 21.6 19.2 18.6 21.8 17.6 Z"
          fill="url(#deer-coat)"
        />
        {/* Pale rump patch */}
        <path d="M40.4 18.6 C41.5 19.6 41.8 21.6 41.1 23.2 C40.2 22 39.9 20.2 40.4 18.6 Z" fill="#C9B79C" opacity="0.5" />
      </g>

      {/* Tail */}
      <g className="deer-tail">
        <path d="M41.2 18.2 C42.4 18.2 43.4 19.2 43 20.4 C42.2 20.2 41.5 19.5 41.2 18.2 Z" fill="#4A2B1A" />
      </g>

      {/* Near-side legs (hind leg has a hock) */}
      <g stroke="#2E1C12" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M39.4 25.4 L40.6 29.8 L40 34.4" />
        <path d="M21.9 26.8 L21.6 38.4" />
      </g>

      {/* Neck + head — drawn upright, rotated down into the grazing pose by CSS */}
      <g className="deer-neck">
        <path
          d="M18.9 22.8 C18.4 18.6 16.8 13.8 14.8 9.6 C15.6 8.4 17 7.9 18.2 8.4 C20.2 12.2 21.8 16 23 19.4 Z"
          fill="url(#deer-neck)"
        />
        <g className="deer-head">
          {/* Ears */}
          <g className="deer-ears" fill="#5A3420">
            <path d="M16.6 6.9 C16.8 5 17.7 3.5 18.9 3 C19.2 4.8 18.5 6.4 17.5 7.3 Z" />
            <path d="M15.3 6.8 C15.2 5 15.8 3.5 16.8 2.9 C17.2 4.6 16.9 6.2 16.1 7.2 Z" />
          </g>
          {/* Head: forehead to long muzzle */}
          <path
            d="M17.8 8.8 C18 7.1 16.8 6 15.3 6.4 C14 6.8 12.4 7.8 10.5 9 C9.7 9.5 9.8 10.7 10.8 10.8 C12.6 10.9 14.7 10.7 16 10.3 C17.1 10 17.7 9.6 17.8 8.8 Z"
            fill="#65391F"
          />
          <ellipse cx="10.2" cy="10" rx="0.75" ry="0.65" fill="#1A0F09" />
          <circle cx="15" cy="8" r="0.42" fill="#120A06" />
        </g>
      </g>
    </svg>
  );
}
