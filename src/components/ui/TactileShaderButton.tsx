'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface TactileShaderButtonProps {
  href: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onMouseEnter?: () => void;
  onTouchStart?: () => void;
  prefetch?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const VS_SOURCE = `
attribute vec2 p;
void main() {
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const FS_SOURCE = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_level;
uniform float u_tilt;
uniform float u_slosh;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for(int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.04 + vec2(11.3, 7.1);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float ar = u_res.x / u_res.y;
  float x = uv.x * ar;
  float t = u_time;
  float amp = 0.012 + u_slosh * 0.045;
  float surf = u_level
    + u_tilt * (uv.x - 0.5) * 0.34
    + amp * sin(x * 5.1 + t * 4.6)
    + amp * 0.62 * sin(x * 9.7 + t * (-6.8) + 1.7)
    + amp * 0.38 * sin(x * 14.3 + t * 8.9 + 4.2);
  float d = surf - uv.y;
  vec3 col = mix(vec3(0.03, 0.06, 0.1), vec3(0.05, 0.09, 0.15), uv.y);
  col += vec3(0.02, 0.05, 0.1) * pow(max(0.0, 1.0 - abs(uv.y - 0.88) * 6.0), 2.0);
  float inside = smoothstep(0.0, 0.012, d);
  float depth = clamp(d / max(u_level, 0.001), 0.0, 1.0);
  vec3 liq = mix(vec3(0.0, 0.9, 1.0), vec3(0.02, 0.15, 0.45), depth);
  float caust = fbm(vec2(x * 4.2, (uv.y + t * 0.14) * 4.2));
  liq *= 0.8 + 0.42 * caust;
  liq += vec3(0.02, 0.25, 0.35) * pow(max(0.0, d * 3.0), 1.5) * u_slosh;
  col = mix(col, liq, inside);
  col += vec3(0.4, 0.9, 1.0) * exp(-abs(d) * 80.0) * 0.85;
  col += vec3(0.8, 0.98, 1.0) * exp(-abs(d) * 220.0) * 0.5;
  vec2 e = uv * (1.0 - uv);
  col *= 0.55 + 0.45 * pow(e.x * e.y * 16.0, 0.22);
  gl_FragColor = vec4(col, 1.0);
}
`;

export default function TactileShaderButton({
  href,
  onClick,
  onMouseEnter,
  onTouchStart,
  prefetch = true,
  className = '',
  children,
}: TactileShaderButtonProps) {
  const containerRef = useRef<HTMLAnchorElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);

  // WebGL simulation state
  const simRef = useRef({
    animId: 0,
    startTime: 0,
    lastTime: 0,
    slosh: 0.35,
    tilt: 0,
    tiltTarget: 0,
    level: 0.56,
    gulp: 0,
    lastX: null as number | null,
    isHovered: false,
    gl: null as WebGLRenderingContext | null,
    program: null as WebGLProgram | null,
    uRes: null as WebGLUniformLocation | null,
    uTime: null as WebGLUniformLocation | null,
    uLevel: null as WebGLUniformLocation | null,
    uTilt: null as WebGLUniformLocation | null,
    uSlosh: null as WebGLUniformLocation | null,
  });

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false }) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) {
      setWebGlSupported(false);
      return;
    }

    const compileShader = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('Shader compile error:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VS_SOURCE);
    const fs = compileShader(gl.FRAGMENT_SHADER, FS_SOURCE);
    if (!vs || !fs) {
      setWebGlSupported(false);
      return;
    }

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Shader link error:', gl.getProgramInfoLog(prog));
      setWebGlSupported(false);
      return;
    }

    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const locP = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);

    const sim = simRef.current;
    sim.gl = gl;
    sim.program = prog;
    sim.uRes = gl.getUniformLocation(prog, 'u_res');
    sim.uTime = gl.getUniformLocation(prog, 'u_time');
    sim.uLevel = gl.getUniformLocation(prog, 'u_level');
    sim.uTilt = gl.getUniformLocation(prog, 'u_tilt');
    sim.uSlosh = gl.getUniformLocation(prog, 'u_slosh');
    sim.startTime = performance.now();
    sim.lastTime = performance.now();

    // Initial sizing
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    const w = Math.max(1, Math.round((canvas.clientWidth || 135) * dpr));
    const h = Math.max(1, Math.round((canvas.clientHeight || 40) * dpr));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);

    return () => {
      if (sim.animId) cancelAnimationFrame(sim.animId);
      if (prog && gl) {
        gl.deleteProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      }
    };
  }, []);

  // Frame render loop
  const renderLoop = useCallback((now: number) => {
    const sim = simRef.current;
    const gl = sim.gl;
    const canvas = canvasRef.current;
    if (!gl || !canvas || !sim.program) return;

    const dt = Math.min(0.05, (now - sim.lastTime) / 1000);
    sim.lastTime = now;

    // Fluidics physics damping & interpolation
    sim.slosh *= Math.exp(-1.5 * dt);
    sim.gulp *= Math.exp(-1.1 * dt);
    sim.tilt += (sim.tiltTarget - sim.tilt) * Math.min(1, dt * 5);
    const levelTarget = 0.56 - 0.36 * sim.gulp;
    sim.level += (levelTarget - sim.level) * Math.min(1, dt * 5.5);

    // Dynamic resolution check
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const clientW = canvas.clientWidth || 135;
    const clientH = canvas.clientHeight || 40;
    const w = Math.max(1, Math.round(clientW * dpr));
    const h = Math.max(1, Math.round(clientH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }

    gl.useProgram(sim.program);
    gl.uniform2f(sim.uRes, canvas.width, canvas.height);
    gl.uniform1f(sim.uTime, (now - sim.startTime) / 1000);
    gl.uniform1f(sim.uLevel, sim.level);
    gl.uniform1f(sim.uTilt, sim.tilt);
    gl.uniform1f(sim.uSlosh, Math.max(0.12, sim.slosh));

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Keep running if hovered or still settling
    if (sim.isHovered || sim.slosh > 0.02 || Math.abs(sim.tilt) > 0.01) {
      sim.animId = requestAnimationFrame(renderLoop);
    } else {
      sim.animId = 0;
    }
  }, []);

  const startAnimation = useCallback(() => {
    const sim = simRef.current;
    if (!sim.animId) {
      sim.lastTime = performance.now();
      sim.animId = requestAnimationFrame(renderLoop);
    }
  }, [renderLoop]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    const sim = simRef.current;
    sim.isHovered = true;
    sim.slosh = Math.min(1.2, sim.slosh + 0.4);
    startAnimation();
    onMouseEnter?.();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(1, rect.width);
    const sim = simRef.current;
    if (sim.lastX !== null) {
      sim.slosh = Math.min(1.4, sim.slosh + Math.abs(x - sim.lastX) * 2.8);
    }
    sim.lastX = x;
    sim.tiltTarget = Math.max(-1, Math.min(1, (x - 0.5) * 2.2));
    startAnimation();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    const sim = simRef.current;
    sim.isHovered = false;
    sim.lastX = null;
    sim.tiltTarget = 0;
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const sim = simRef.current;
    sim.gulp = 1.0;
    sim.slosh = Math.min(1.4, sim.slosh + 0.8);
    startAnimation();
    onClick?.(e);
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center p-[1px] rounded-full transition-all duration-300 ${
        isHovered
          ? 'bg-gradient-to-b from-cyan-400/80 via-cyan-500/40 to-cyan-900/60 shadow-[0_12px_32px_rgba(6,182,212,0.38),0_2px_10px_rgba(5,10,15,0.45)] -translate-y-[1px]'
          : 'bg-transparent'
      }`}
    >
      <Link
        ref={containerRef}
        href={href}
        prefetch={prefetch}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={onTouchStart}
        onClick={handleClick}
        className={`group relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 rounded-full px-6 py-2.5 text-xs sm:text-[13px] h-9 sm:h-10 tracking-tight cursor-pointer overflow-hidden select-none active:scale-[0.98] ${
          isHovered
            ? 'bg-[#050b11] text-[#e0faff] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
            : 'bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-xl shadow-black/20'
        } ${className}`}
      >
        {/* Tactile Fluidics WebGL Shader Canvas */}
        {webGlSupported && (
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full pointer-events-none rounded-full transition-opacity duration-300 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Tactile Button Content & Text */}
        <span
          className={`relative z-10 transition-all duration-200 flex items-center gap-2 ${
            isHovered
              ? 'text-[#e0faff] drop-shadow-[0_1px_8px_rgba(0,18,25,0.9)] font-semibold'
              : ''
          }`}
        >
          {children}
        </span>
      </Link>
    </div>
  );
}

