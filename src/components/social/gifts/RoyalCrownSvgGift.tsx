'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Volume2, VolumeX, X } from 'lucide-react';

export interface RoyalCrownSvgGiftProps {
  senderName: string;
  senderAvatar?: string;
  combo?: number;
  onComplete: () => void;
}

interface CrownParticle {
  id: number;
  leftPercent: number;
  topPercent: number;
  driftX: number;
  driftY: number;
  sizePx: number;
  delaySec: number;
  durationSec: number;
  isDiamond: boolean;
}

const CROWN_PARTICLES: CrownParticle[] = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  leftPercent: 16 + ((i * 29) % 68),
  topPercent: 22 + ((i * 19) % 58),
  driftX: ((i % 5) - 2) * 26,
  driftY: -55 - (i % 4) * 24,
  sizePx: 4 + (i % 4) * 2.2,
  delaySec: (i % 8) * 0.22,
  durationSec: 1.6 + (i % 4) * 0.35,
  isDiamond: i % 3 === 0,
}));

const LIGHT_RAY_ANGLES = Array.from({ length: 12 }, (_, i) => i * 30);

/**
 * Lightweight SVG Preview Card Icon for the Gift Drawer (64x64 card)
 */
export function RoyalCrownSvgPreview({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={`${className} select-none overflow-visible`}
      aria-label="Royal Crown"
    >
      <defs>
        <radialGradient id="crownPreviewGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.6" />
          <stop offset="65%" stopColor="#f59e0b" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="crownPreviewGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="40%" stopColor="#fbbf24" />
          <stop offset="80%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="crownPreviewVelvet" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
      </defs>

      <circle cx="60" cy="60" r="52" fill="url(#crownPreviewGlow)" />

      {/* Velvet Inner Cap */}
      <path
        d="M 28 74 C 26 48, 44 38, 60 38 C 76 38, 94 48, 92 74 Z"
        fill="url(#crownPreviewVelvet)"
      />

      {/* Golden Crown Body */}
      <path
        d="M 22 78 L 18 44 L 40 58 L 60 28 L 80 58 L 102 44 L 98 78 Z"
        fill="url(#crownPreviewGold)"
        stroke="#78350f"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Crown Base Band */}
      <rect
        x="22"
        y="76"
        width="76"
        height="13"
        rx="4"
        fill="url(#crownPreviewGold)"
        stroke="#78350f"
        strokeWidth="1.6"
      />

      {/* Peak Diamonds */}
      <polygon points="60,18 65,24 60,30 55,24" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1" />
      <circle cx="18" cy="41" r="3.5" fill="#e0f2fe" />
      <circle cx="102" cy="41" r="3.5" fill="#e0f2fe" />

      {/* Center Ruby & Side Diamonds */}
      <polygon points="60,54 66,62 60,70 54,62" fill="#f43f5e" stroke="#fecdd3" strokeWidth="1" />
      <polygon points="38,63 42,67 38,71 34,67" fill="#e0f2fe" />
      <polygon points="82,63 86,67 82,71 78,67" fill="#e0f2fe" />
    </svg>
  );
}

/**
 * Fullscreen Animated Royal Crown SVG Gift
 * - Pure SVG + React + CSS Keyframe Animation (Zero Cloudflare video stream dependency)
 * - Features detailed golden crown with faceted diamonds & ruby gemstones, floating & gentle rotation,
 *   moving golden light reflections, sparkling gemstones, and magical particles.
 */
export default function RoyalCrownSvgGift({
  senderName,
  senderAvatar,
  combo = 1,
  onComplete,
}: RoyalCrownSvgGiftProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const hasCompletedRef = useRef(false);
  const timersRef = useRef<{ exit?: number; done?: number; manual?: number }>({});

  const fireOnCompleteOnce = () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    if (timersRef.current.exit) window.clearTimeout(timersRef.current.exit);
    if (timersRef.current.done) window.clearTimeout(timersRef.current.done);
    if (timersRef.current.manual) window.clearTimeout(timersRef.current.manual);
    onCompleteRef.current();
  };

  // Timeline lifecycle: 5.2s total (0-0.75s entrance, 0.75-4.2s float/rotate/sparkle, 4.2-5.2s smooth exit)
  useEffect(() => {
    hasCompletedRef.current = false;

    timersRef.current.exit = window.setTimeout(() => {
      setIsExiting(true);
    }, 4200);

    timersRef.current.done = window.setTimeout(() => {
      fireOnCompleteOnce();
    }, 5200);

    return () => {
      if (timersRef.current.exit) window.clearTimeout(timersRef.current.exit);
      if (timersRef.current.done) window.clearTimeout(timersRef.current.done);
      if (timersRef.current.manual) window.clearTimeout(timersRef.current.manual);
    };
  }, []);

  // Royal Fanfare + Sparkling Chime Web Audio Synthesizer
  useEffect(() => {
    if (typeof window === 'undefined' || !soundEnabled) return;

    let audioCtx: AudioContext | null = null;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        const master = audioCtx.createGain();
        master.gain.value = 0.18;
        master.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        // Royal Chord Fanfare (C5 - E5 - G5 - C6)
        const royalNotes = [
          { freq: 523.25, start: 0.08, dur: 0.45 },
          { freq: 659.25, start: 0.22, dur: 0.45 },
          { freq: 783.99, start: 0.36, dur: 0.55 },
          { freq: 1046.5, start: 0.52, dur: 1.65 },
        ];

        royalNotes.forEach(({ freq, start, dur }) => {
          if (!audioCtx) return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + start);

          gain.gain.setValueAtTime(0.001, now + start);
          gain.gain.linearRampToValueAtTime(0.32, now + start + 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

          osc.connect(gain);
          gain.connect(master);
          osc.start(now + start);
          osc.stop(now + start + dur + 0.05);
        });

        // Crystalline Diamond Sparkle Arpeggio
        const sparkleFreqs = [1318.5, 1567.98, 2093.0, 2637.02, 2093.0, 2637.02];
        sparkleFreqs.forEach((freq, idx) => {
          if (!audioCtx) return;
          const t = now + 1.0 + idx * 0.28;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

          osc.connect(gain);
          gain.connect(master);
          osc.start(t);
          osc.stop(t + 0.4);
        });
      }
    } catch (_) {}

    return () => {
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, [soundEnabled]);

  const handleManualClose = () => {
    if (hasCompletedRef.current) return;
    if (timersRef.current.exit) window.clearTimeout(timersRef.current.exit);
    if (timersRef.current.done) window.clearTimeout(timersRef.current.done);
    setIsExiting(true);
    timersRef.current.manual = window.setTimeout(() => {
      fireOnCompleteOnce();
    }, 220);
  };

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center overflow-hidden select-none transition-opacity duration-700 ${
        isExiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes rcrown-stage-enter {
          0% {
            opacity: 0;
            transform: scale(0.35) translateY(-45px);
          }
          18% {
            opacity: 1;
            transform: scale(1.06) translateY(4px);
          }
          28% {
            transform: scale(0.98) translateY(0px);
          }
          80% {
            opacity: 1;
            transform: scale(1.03) translateY(-4px);
          }
          100% {
            opacity: 0;
            transform: scale(1.12) translateY(-18px);
          }
        }

        @keyframes rcrown-float-rotate {
          0%, 100% {
            transform: translateY(0px) rotate(0deg) scale(1);
          }
          25% {
            transform: translateY(-14px) rotate(3.2deg) scale(1.03);
          }
          50% {
            transform: translateY(-4px) rotate(0deg) scale(1.05);
          }
          75% {
            transform: translateY(-14px) rotate(-3.2deg) scale(1.03);
          }
        }

        @keyframes rcrown-rays-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes rcrown-light-sweep {
          0% {
            transform: translateX(-280px) rotate(22deg);
          }
          55%, 100% {
            transform: translateX(340px) rotate(22deg);
          }
        }

        @keyframes rcrown-gem-sparkle {
          0%, 100% {
            transform: scale(0.45) rotate(0deg);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.25) rotate(45deg);
            opacity: 1;
          }
        }

        @keyframes rcrown-particle-rise {
          0% {
            opacity: 0;
            transform: translate(0px, 12px) scale(0.3);
          }
          30% {
            opacity: 1;
            transform: translate(calc(var(--dx) * 0.4), calc(var(--dy) * 0.4)) scale(1.15);
          }
          80% {
            opacity: 0.85;
          }
          100% {
            opacity: 0;
            transform: translate(var(--dx), var(--dy)) scale(0.2);
          }
        }

        .rcrown-stage-wrapper {
          animation: rcrown-stage-enter 5.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          will-change: transform, opacity;
        }
        .rcrown-floating-body {
          transform-origin: 250px 250px;
          animation: rcrown-float-rotate 3.2s ease-in-out infinite;
        }
        .rcrown-sunrays {
          transform-origin: 250px 250px;
          animation: rcrown-rays-spin 18s linear infinite;
        }
        .rcrown-shimmer-bar {
          animation: rcrown-light-sweep 2.1s ease-in-out infinite;
        }
        .rcrown-sparkle-1 {
          transform-box: fill-box;
          transform-origin: center;
          animation: rcrown-gem-sparkle 1.3s ease-in-out infinite;
        }
        .rcrown-sparkle-2 {
          transform-box: fill-box;
          transform-origin: center;
          animation: rcrown-gem-sparkle 1.5s ease-in-out 0.35s infinite;
        }
        .rcrown-sparkle-3 {
          transform-box: fill-box;
          transform-origin: center;
          animation: rcrown-gem-sparkle 1.4s ease-in-out 0.7s infinite;
        }
        .rcrown-particle {
          animation: rcrown-particle-rise var(--dur) ease-out var(--delay) infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .rcrown-stage-wrapper,
          .rcrown-floating-body,
          .rcrown-sunrays,
          .rcrown-shimmer-bar,
          .rcrown-sparkle-1,
          .rcrown-sparkle-2,
          .rcrown-sparkle-3,
          .rcrown-particle {
            animation: none !important;
          }
        }
      `}</style>

      {/* Subtle Royal Gold & Ruby Ambient Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, rgba(253, 224, 71, 0.22) 0%, rgba(245, 158, 11, 0.10) 36%, rgba(0, 0, 0, 0) 68%)',
        }}
      />

      {/* Top-Right Controls (Mute / Close) */}
      <div className="fixed top-16 right-4 z-50 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setSoundEnabled((prev) => !prev)}
          className="p-2.5 rounded-full bg-black/65 hover:bg-black/85 border border-amber-400/40 text-amber-300 backdrop-blur-md shadow-lg transition active:scale-95"
          aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={handleManualClose}
          className="p-2.5 rounded-full bg-black/65 hover:bg-black/85 border border-white/20 text-white/90 backdrop-blur-md shadow-lg transition active:scale-95"
          aria-label="Close gift animation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Center Stage Royal Crown SVG + Magical Particles */}
      <div className="rcrown-stage-wrapper relative flex items-center justify-center w-[min(86vw,430px)] h-[min(86vw,430px)] sm:w-[450px] sm:h-[450px]">
        {/* Magical Floating Particles (Gold Embers & Diamond Dust) */}
        <div className="absolute inset-0 pointer-events-none">
          {CROWN_PARTICLES.map((p) => (
            <span
              key={p.id}
              className="rcrown-particle absolute rounded-full"
              style={
                {
                  left: `${p.leftPercent}%`,
                  top: `${p.topPercent}%`,
                  width: `${p.sizePx}px`,
                  height: `${p.sizePx}px`,
                  background: p.isDiamond
                    ? 'radial-gradient(circle, #ffffff 0%, #bae6fd 60%, #38bdf8 100%)'
                    : 'radial-gradient(circle, #ffffff 0%, #fef08a 55%, #f59e0b 100%)',
                  boxShadow: p.isDiamond
                    ? '0 0 12px #e0f2fe, 0 0 20px #38bdf8'
                    : '0 0 12px #fef08a, 0 0 20px #f59e0b',
                  '--dx': `${p.driftX}px`,
                  '--dy': `${p.driftY}px`,
                  '--delay': `${p.delaySec}s`,
                  '--dur': `${p.durationSec}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* Master Custom SVG Royal Crown */}
        <svg
          viewBox="0 0 500 500"
          className="w-full h-full overflow-visible drop-shadow-[0_18px_42px_rgba(251,191,36,0.45)]"
          aria-label="Royal Crown"
        >
          <defs>
            {/* Radial Celestial Halo */}
            <radialGradient id="rcrownHaloGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.65" />
              <stop offset="45%" stopColor="#fbbf24" stopOpacity="0.24" />
              <stop offset="80%" stopColor="#b45309" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
            </radialGradient>

            {/* Primary Imperial 24K Gold Gradient */}
            <linearGradient id="rcrownGoldPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="18%" stopColor="#fef08a" />
              <stop offset="48%" stopColor="#fbbf24" />
              <stop offset="78%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>

            {/* Rich Sculpted Gold Band Gradient */}
            <linearGradient id="rcrownGoldBand" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="35%" stopColor="#f59e0b" />
              <stop offset="75%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>

            {/* Royal Crimson Velvet Cap Gradient */}
            <radialGradient id="rcrownCrimsonVelvet" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="45%" stopColor="#be123c" />
              <stop offset="85%" stopColor="#881337" />
              <stop offset="100%" stopColor="#4c0519" />
            </radialGradient>

            {/* Ruby Gemstone Facet Gradient */}
            <linearGradient id="rcrownRubyGem" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fda4af" />
              <stop offset="35%" stopColor="#e11d48" />
              <stop offset="75%" stopColor="#9f1239" />
              <stop offset="100%" stopColor="#4c0519" />
            </linearGradient>

            {/* Brilliant Cut Diamond Gradient */}
            <linearGradient id="rcrownDiamondGem" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="45%" stopColor="#e0f2fe" />
              <stop offset="80%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            {/* Moving Golden Light Reflection Gradient */}
            <linearGradient id="rcrownSpecularSweep" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="40%" stopColor="#fef9c3" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.88" />
              <stop offset="60%" stopColor="#fef9c3" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            {/* Clip Path matching the Golden Crown Silhouette for Moving Light Reflections */}
            <clipPath id="rcrownSilhouetteClip">
              <path d="M 108 322 L 82 178 L 154 236 L 194 148 L 250 222 L 306 148 L 346 236 L 418 178 L 392 322 Z" />
              <rect x="102" y="316" width="296" height="50" rx="14" />
            </clipPath>
          </defs>

          {/* Celestial Halo Glow */}
          <circle cx="250" cy="250" r="215" fill="url(#rcrownHaloGrad)" />

          {/* Rotating Golden Celestial Light Rays */}
          <g className="rcrown-sunrays" opacity="0.55">
            {LIGHT_RAY_ANGLES.map((deg) => (
              <polygon
                key={deg}
                points="250,250 236,42 264,42"
                fill="url(#rcrownHaloGrad)"
                transform={`rotate(${deg} 250 250)`}
              />
            ))}
          </g>

          {/* Floating & Gently Rotating Royal Crown Group */}
          <g className="rcrown-floating-body">
            {/* Under-Crown Floating Golden Shadow/Halo Ring */}
            <ellipse
              cx="250"
              cy="398"
              rx="135"
              ry="18"
              fill="url(#rcrownHaloGrad)"
              opacity="0.75"
            />

            {/* Royal Crimson Velvet Inner Cap (Monarch Cushion) */}
            <path
              d="M 118 320 C 102 222, 165 162, 250 162 C 335 162, 398 222, 382 320 Z"
              fill="url(#rcrownCrimsonVelvet)"
              stroke="#fbbf24"
              strokeWidth="2.5"
            />

            {/* Golden Imperial Arches Ribbing Over Velvet Cap */}
            <path
              d="M 162 318 C 165 215, 208 164, 250 164 C 292 164, 335 215, 338 318"
              fill="none"
              stroke="url(#rcrownGoldPrimary)"
              strokeWidth="7"
              strokeDasharray="6 6"
            />
            <line
              x1="250"
              y1="120"
              x2="250"
              y2="318"
              stroke="url(#rcrownGoldPrimary)"
              strokeWidth="8"
            />

            {/* Sovereign Monde & Cross at Very Top Peak */}
            <circle
              cx="250"
              cy="104"
              r="14"
              fill="url(#rcrownGoldPrimary)"
              stroke="#78350f"
              strokeWidth="2"
            />
            <polygon
              points="250,68 258,82 250,94 242,82"
              fill="url(#rcrownDiamondGem)"
              stroke="#ffffff"
              strokeWidth="1.5"
            />

            {/* Main Sculpted 5-Spire Golden Crown Frame */}
            <path
              d="M 108 322 L 82 178 L 154 236 L 194 148 L 250 118 L 306 148 L 346 236 L 418 178 L 392 322 Z"
              fill="url(#rcrownGoldPrimary)"
              stroke="#78350f"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />

            {/* Inner Gold Filigree Trim Along Crown Spires */}
            <path
              d="M 120 314 L 98 198 L 154 246 L 194 166 L 250 136 L 306 166 L 346 246 L 402 198 L 380 314 Z"
              fill="none"
              stroke="#fef9c3"
              strokeWidth="2"
              strokeOpacity="0.7"
              strokeLinejoin="round"
            />

            {/* Heavy Imperial Jeweled Base Band */}
            <rect
              x="102"
              y="316"
              width="296"
              height="50"
              rx="14"
              fill="url(#rcrownGoldBand)"
              stroke="#fef08a"
              strokeWidth="2.8"
            />
            {/* Upper & Lower Pearl-Studded Gold Mouldings */}
            <rect
              x="96"
              y="310"
              width="308"
              height="10"
              rx="5"
              fill="url(#rcrownGoldPrimary)"
              stroke="#78350f"
              strokeWidth="1.8"
            />
            <rect
              x="96"
              y="360"
              width="308"
              height="11"
              rx="5.5"
              fill="url(#rcrownGoldPrimary)"
              stroke="#78350f"
              strokeWidth="1.8"
            />

            {/* Moving Golden Light Reflection Sweep Clipped to Crown */}
            <g clipPath="url(#rcrownSilhouetteClip)">
              <rect
                x="180"
                y="80"
                width="95"
                height="340"
                fill="url(#rcrownSpecularSweep)"
                className="rcrown-shimmer-bar"
              />
            </g>

            {/* Spire Peak Brilliant-Cut Diamonds */}
            {/* Far-Left Peak Diamond */}
            <g transform="translate(82, 174)">
              <polygon
                points="0,-16 13,0 0,16 -13,0"
                fill="url(#rcrownDiamondGem)"
                stroke="#ffffff"
                strokeWidth="1.8"
              />
              <polygon points="0,-9 7,0 0,9 -7,0" fill="#ffffff" opacity="0.85" />
            </g>

            {/* Mid-Left Peak Diamond */}
            <g transform="translate(194, 144)">
              <polygon
                points="0,-18 14,0 0,18 -14,0"
                fill="url(#rcrownDiamondGem)"
                stroke="#ffffff"
                strokeWidth="1.8"
              />
              <polygon points="0,-10 8,0 0,10 -8,0" fill="#ffffff" opacity="0.85" />
            </g>

            {/* Center Sovereign Peak Diamond */}
            <g transform="translate(250, 118)">
              <polygon
                points="0,-22 17,0 0,22 -17,0"
                fill="url(#rcrownDiamondGem)"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <polygon points="0,-12 9,0 0,12 -9,0" fill="#ffffff" opacity="0.9" />
            </g>

            {/* Mid-Right Peak Diamond */}
            <g transform="translate(306, 144)">
              <polygon
                points="0,-18 14,0 0,18 -14,0"
                fill="url(#rcrownDiamondGem)"
                stroke="#ffffff"
                strokeWidth="1.8"
              />
              <polygon points="0,-10 8,0 0,10 -8,0" fill="#ffffff" opacity="0.85" />
            </g>

            {/* Far-Right Peak Diamond */}
            <g transform="translate(418, 174)">
              <polygon
                points="0,-16 13,0 0,16 -13,0"
                fill="url(#rcrownDiamondGem)"
                stroke="#ffffff"
                strokeWidth="1.8"
              />
              <polygon points="0,-9 7,0 0,9 -7,0" fill="#ffffff" opacity="0.85" />
            </g>

            {/* Central Imperial Cushion-Cut Ruby Gemstone on Crown Body */}
            <g transform="translate(250, 246)">
              {/* Gold Bezel Setting */}
              <polygon
                points="0,-42 36,0 0,42 -36,0"
                fill="url(#rcrownGoldBand)"
                stroke="#fef08a"
                strokeWidth="2.2"
              />
              {/* Faceted Ruby */}
              <polygon
                points="0,-34 29,0 0,34 -29,0"
                fill="url(#rcrownRubyGem)"
                stroke="#fecdd3"
                strokeWidth="1.8"
              />
              {/* Ruby Table Facet Highlight */}
              <polygon points="0,-20 17,0 0,20 -17,0" fill="#fb7185" opacity="0.65" />
              <polygon points="-6,-16 8,-10 -2,-2" fill="#ffffff" opacity="0.75" />
            </g>

            {/* Left & Right Flanking Diamonds on Crown Body */}
            <g transform="translate(168, 266)">
              <polygon
                points="0,-24 20,0 0,24 -20,0"
                fill="url(#rcrownDiamondGem)"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <polygon points="0,-13 11,0 0,13 -11,0" fill="#ffffff" opacity="0.85" />
            </g>
            <g transform="translate(332, 266)">
              <polygon
                points="0,-24 20,0 0,24 -20,0"
                fill="url(#rcrownDiamondGem)"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <polygon points="0,-13 11,0 0,13 -11,0" fill="#ffffff" opacity="0.85" />
            </g>

            {/* Base Band Jewels: Alternating Rubies & Diamonds */}
            {/* Center Band Ruby */}
            <polygon
              points="250,324 266,341 250,358 234,341"
              fill="url(#rcrownRubyGem)"
              stroke="#fecdd3"
              strokeWidth="1.5"
            />
            {/* Left & Right Band Diamonds */}
            <polygon
              points="192,326 206,341 192,356 178,341"
              fill="url(#rcrownDiamondGem)"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <polygon
              points="308,326 322,341 308,356 294,341"
              fill="url(#rcrownDiamondGem)"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            {/* Outer Band Rubies */}
            <polygon
              points="136,328 148,341 136,354 124,341"
              fill="url(#rcrownRubyGem)"
              stroke="#fecdd3"
              strokeWidth="1.4"
            />
            <polygon
              points="364,328 376,341 364,354 352,341"
              fill="url(#rcrownRubyGem)"
              stroke="#fecdd3"
              strokeWidth="1.4"
            />

            {/* Golden Pearl Studs Between Jewels */}
            {[164, 221, 279, 336].map((cx) => (
              <circle key={cx} cx={cx} cy="341" r="4.5" fill="#fef9c3" stroke="#92400e" strokeWidth="1" />
            ))}

            {/* Animated 4-Point Star Sparkle Glints on Gemstones */}
            <g className="rcrown-sparkle-1" transform="translate(250, 118)">
              <path
                d="M 0 -26 L 4 -4 L 26 0 L 4 4 L 0 26 L -4 4 L -26 0 L -4 -4 Z"
                fill="#ffffff"
              />
            </g>
            <g className="rcrown-sparkle-2" transform="translate(238, 232)">
              <path
                d="M 0 -22 L 3.5 -3.5 L 22 0 L 3.5 3.5 L 0 22 L -3.5 3.5 L -22 0 L -3.5 -3.5 Z"
                fill="#ffffff"
              />
            </g>
            <g className="rcrown-sparkle-3" transform="translate(168, 266)">
              <path
                d="M 0 -20 L 3 -3 L 20 0 L 3 3 L 0 20 L -3 3 L -20 0 L -3 -3 Z"
                fill="#ffffff"
              />
            </g>
            <g className="rcrown-sparkle-1" transform="translate(332, 266)">
              <path
                d="M 0 -20 L 3 -3 L 20 0 L 3 3 L 0 20 L -3 3 L -20 0 L -3 -3 Z"
                fill="#ffffff"
              />
            </g>
            <g className="rcrown-sparkle-2" transform="translate(194, 144)">
              <path
                d="M 0 -18 L 3 -3 L 18 0 L 3 3 L 0 18 L -3 3 L -18 0 L -3 -3 Z"
                fill="#fef08a"
              />
            </g>
            <g className="rcrown-sparkle-3" transform="translate(306, 144)">
              <path
                d="M 0 -18 L 3 -3 L 18 0 L 3 3 L 0 18 L -3 3 L -18 0 L -3 -3 Z"
                fill="#fef08a"
              />
            </g>
          </g>
        </svg>
      </div>

      {/* Bottom Gifter Announcement Pill */}
      <div className="relative z-10 mt-2 pointer-events-none flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-950/90 via-black/85 to-amber-950/90 border border-amber-400/60 shadow-[0_0_30px_rgba(245,158,11,0.45)] backdrop-blur-md">
        <Avatar className="h-9 w-9 border-2 border-amber-400 shadow-md">
          <AvatarImage src={senderAvatar || ''} />
          <AvatarFallback className="bg-amber-500 text-black font-black text-xs">
            {(senderName || 'U')[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col pr-1">
          <span className="text-xs sm:text-sm font-black text-amber-300 tracking-wide">
            {senderName}
          </span>
          <span className="text-[11px] font-bold text-white/90">
            sent <span className="text-amber-400 font-extrabold">Royal Crown</span> 👑
          </span>
        </div>
        {combo > 1 && (
          <span className="ml-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 text-black font-black text-xs sm:text-sm shadow">
            x{combo}
          </span>
        )}
      </div>
    </div>
  );
}
