'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Volume2, VolumeX, X } from 'lucide-react';

export interface GoldenLionSvgGiftProps {
  senderName: string;
  senderAvatar?: string;
  combo?: number;
  onComplete: () => void;
}

interface GoldEmber {
  id: number;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  sizePx: number;
  delaySec: number;
  durationSec: number;
}

const GOLD_EMBERS: GoldEmber[] = Array.from({ length: 26 }, (_, i) => {
  const side = i % 2 === 0 ? 1 : -1;
  return {
    id: i,
    startX: 50 + side * (8 + ((i * 13) % 32)),
    startY: 30 + ((i * 17) % 52),
    driftX: side * (22 + (i % 5) * 16),
    driftY: -55 - (i % 6) * 22,
    sizePx: 3 + (i % 4) * 2,
    delaySec: 0.15 + (i % 8) * 0.2,
    durationSec: 1.7 + (i % 4) * 0.4,
  };
});

/**
 * Lightweight 3D-Sculpted Golden Lion Preview Icon for the Gift Drawer (64x64 card)
 * Redesigned from scratch: anatomical lion head & flowing layered mane (no flower petals).
 */
export function GoldenLionSvgPreview({ className = 'w-12 h-12' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`${className} select-none overflow-visible`}
      aria-label="Golden Lion"
    >
      <defs>
        <radialGradient id="glPrevAura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#92400e" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="glPrevDeepMane" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="50%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#270e03" />
        </linearGradient>
        <linearGradient id="glPrevMidMane" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="45%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
        <linearGradient id="glPrevArmorGold" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="30%" stopColor="#fbbf24" />
          <stop offset="70%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="102" r="90" fill="url(#glPrevAura)" />

      {/* Outer Flowing Mane Silhouette (Swept Crown, Cheek Waves & Deep Chest Bib) */}
      <path
        d="M 100 14
           C 122 14, 146 24, 158 44
           C 176 54, 186 78, 178 104
           C 184 124, 172 150, 150 166
           C 134 180, 116 190, 100 194
           C 84 190, 66 180, 50 166
           C 28 150, 16 124, 22 104
           C 14 78, 24 54, 42 44
           C 54 24, 78 14, 100 14 Z"
        fill="url(#glPrevDeepMane)"
        stroke="#fbbf24"
        strokeWidth="2"
      />

      {/* Sculpted Flowing Mane Locks */}
      <path
        d="M 100 22
           C 118 22, 136 32, 146 48
           C 162 62, 168 86, 160 110
           C 162 132, 146 154, 126 168
           L 100 184
           L 74 168
           C 54 154, 38 132, 40 110
           C 32 86, 38 62, 54 48
           C 64 32, 82 22, 100 22 Z"
        fill="url(#glPrevMidMane)"
      />

      {/* Ears Recessed into Mane */}
      <path d="M 52 54 C 42 42, 48 28, 62 34 C 68 38, 70 48, 64 56 Z" fill="url(#glPrevArmorGold)" />
      <path d="M 148 54 C 158 42, 152 28, 138 34 C 132 38, 130 48, 136 56 Z" fill="url(#glPrevArmorGold)" />

      {/* Sculpted Cranium, Cheekbones & Muzzle */}
      <path
        d="M 62 56
           C 72 40, 128 40, 138 56
           L 148 86
           L 136 118
           L 118 144
           L 100 154
           L 82 144
           L 64 118
           L 52 86 Z"
        fill="url(#glPrevArmorGold)"
        stroke="#451a03"
        strokeWidth="2"
      />

      {/* Heavy Brow & Fierce Glowing Eyes */}
      <path d="M 62 78 L 92 88 L 100 84 L 108 88 L 138 78 L 132 70 L 100 78 L 68 70 Z" fill="#3b1302" />
      <polygon points="68,80 90,87 84,93 70,88" fill="#ffffff" />
      <polygon points="132,80 110,87 116,93 130,88" fill="#ffffff" />

      {/* Sculpted Nose Bridge & Roaring Fangs */}
      <polygon points="90,86 110,86 114,112 100,120 86,112" fill="#fef08a" opacity="0.85" />
      <polygon points="88,112 112,112 100,124" fill="#270902" />
      <path d="M 78 124 L 122 124 L 116 146 L 100 152 L 84 146 Z" fill="#270902" />
      <polygon points="82,124 86,138 90,124" fill="#ffffff" />
      <polygon points="118,124 114,138 110,124" fill="#ffffff" />
    </svg>
  );
}

/**
 * Fullscreen Animated Golden Lion SVG Gift (Complete Anatomical & 3D-Sculpted Redesign)
 * - Anatomically recognizable male lion with 3D-sculpted facial planes, brow ridges, cheekbones,
 *   snarling nose bridge, articulated roaring jaw with curved canine fangs, and thick flowing
 *   layered metallic-gold mane (zero radial flower petals).
 */
export default function GoldenLionSvgGift({
  senderName,
  senderAvatar,
  combo = 1,
  onComplete,
}: GoldenLionSvgGiftProps) {
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

  // Timeline lifecycle: 5.6s total (0-0.8s dramatic emerge, 0.8-4.5s fierce roar & shockwaves, 4.5-5.6s smooth exit)
  useEffect(() => {
    hasCompletedRef.current = false;

    timersRef.current.exit = window.setTimeout(() => {
      setIsExiting(true);
    }, 4500);

    timersRef.current.done = window.setTimeout(() => {
      fireOnCompleteOnce();
    }, 5600);

    return () => {
      if (timersRef.current.exit) window.clearTimeout(timersRef.current.exit);
      if (timersRef.current.done) window.clearTimeout(timersRef.current.done);
      if (timersRef.current.manual) window.clearTimeout(timersRef.current.manual);
    };
  }, []);

  // Acoustic + Web Audio synthesized roar sound effect
  useEffect(() => {
    if (typeof window === 'undefined' || !soundEnabled) return;

    const clips: HTMLAudioElement[] = [];
    const timers: number[] = [];

    const playClip = (src: string, delayMs: number, volume: number) => {
      const id = window.setTimeout(() => {
        try {
          const audio = new Audio(src);
          audio.volume = volume;
          audio.play().catch(() => {});
          clips.push(audio);
        } catch (_) {}
      }, delayMs);
      timers.push(id);
    };

    playClip('/gifts/audio/lion-growl.mp3', 100, 0.85);
    playClip('/gifts/audio/lion-roar.mp3', 1150, 0.98);

    let audioCtx: AudioContext | null = null;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        const master = audioCtx.createGain();
        master.gain.value = 0.22;
        master.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(110, now + 0.9);
        subOsc.frequency.exponentialRampToValueAtTime(34, now + 3.7);

        subGain.gain.setValueAtTime(0.001, now + 0.9);
        subGain.gain.linearRampToValueAtTime(0.42, now + 1.35);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);

        subOsc.connect(subGain);
        subGain.connect(master);
        subOsc.start(now + 0.9);
        subOsc.stop(now + 4.1);
      }
    } catch (_) {}

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      clips.forEach((c) => {
        c.pause();
        c.src = '';
      });
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
        @keyframes glion3d-emerge {
          0% {
            opacity: 0;
            transform: scale(0.42) translateY(36px);
          }
          15% {
            opacity: 1;
            transform: scale(1.04) translateY(-6px);
          }
          24% {
            transform: scale(0.97) translateY(4px);
          }
          38% {
            transform: scale(1.08) translateY(-8px);
          }
          78% {
            opacity: 1;
            transform: scale(1.03) translateY(0px);
          }
          100% {
            opacity: 0;
            transform: scale(1.12) translateY(-16px);
          }
        }

        @keyframes glion3d-head-thrash {
          0%, 14% {
            transform: translateY(4px) rotate(0deg) scale(0.98);
          }
          22% {
            transform: translateY(-12px) rotate(-1.8deg) scale(1.02);
          }
          32% {
            transform: translateY(6px) rotate(1.5deg) scale(1.08);
          }
          46% {
            transform: translateY(-6px) rotate(-1.2deg) scale(1.07);
          }
          62% {
            transform: translateY(3px) rotate(0.8deg) scale(1.04);
          }
          82%, 100% {
            transform: translateY(0px) rotate(0deg) scale(1);
          }
        }

        @keyframes glion3d-jaw-roar {
          0%, 16% {
            transform: translateY(-14px) scaleY(0.88);
          }
          26% {
            transform: translateY(28px) scaleY(1.14);
          }
          44% {
            transform: translateY(34px) scaleY(1.2);
          }
          56% {
            transform: translateY(18px) scaleY(1.04);
          }
          70% {
            transform: translateY(30px) scaleY(1.16);
          }
          86%, 100% {
            transform: translateY(-10px) scaleY(0.9);
          }
        }

        @keyframes glion3d-snarl-lift {
          0%, 16% {
            transform: translateY(4px) scaleX(0.98);
          }
          28%, 72% {
            transform: translateY(-8px) scaleX(1.04);
          }
          88%, 100% {
            transform: translateY(2px) scaleX(1);
          }
        }

        @keyframes glion3d-mane-billow {
          0%, 100% {
            transform: scale(1) translateY(0px);
          }
          34% {
            transform: scale(1.035, 1.02) translateY(-4px);
          }
          66% {
            transform: scale(1.02, 1.03) translateY(2px);
          }
        }

        @keyframes glion3d-eye-blaze {
          0%, 16% {
            opacity: 0.85;
            filter: drop-shadow(0 0 6px #fbbf24);
          }
          28%, 74% {
            opacity: 1;
            filter: drop-shadow(0 0 16px #ffffff) drop-shadow(0 0 30px #f59e0b);
          }
          100% {
            opacity: 0.85;
          }
        }

        @keyframes glion3d-roar-core {
          0%, 18% {
            opacity: 0.15;
            transform: scale(0.65);
          }
          30%, 52% {
            opacity: 1;
            transform: scale(1.18);
          }
          68% {
            opacity: 0.9;
            transform: scale(1.1);
          }
          86%, 100% {
            opacity: 0.15;
            transform: scale(0.7);
          }
        }

        @keyframes glion3d-shockwave {
          0% {
            opacity: 0;
            transform: scale(0.38);
          }
          18% {
            opacity: 0.88;
          }
          100% {
            opacity: 0;
            transform: scale(2.25);
          }
        }

        @keyframes glion3d-shimmer-sweep {
          0% {
            transform: translateX(-340px) rotate(25deg);
          }
          55%, 100% {
            transform: translateX(380px) rotate(25deg);
          }
        }

        @keyframes glion3d-ember-rise {
          0% {
            opacity: 0;
            transform: translate(0px, 12px) scale(0.35);
          }
          25% {
            opacity: 1;
            transform: translate(calc(var(--dx) * 0.4), calc(var(--dy) * 0.4)) scale(1.15);
          }
          80% {
            opacity: 0.85;
          }
          100% {
            opacity: 0;
            transform: translate(var(--dx), var(--dy)) scale(0.15);
          }
        }

        @keyframes glion3d-camera-shake {
          0%, 22%, 78%, 100% {
            transform: translate3d(0, 0, 0);
          }
          26% {
            transform: translate3d(-6px, 4px, 0);
          }
          31% {
            transform: translate3d(6px, -5px, 0);
          }
          36% {
            transform: translate3d(-5px, -3px, 0);
          }
          41% {
            transform: translate3d(5px, 5px, 0);
          }
          46% {
            transform: translate3d(-4px, 3px, 0);
          }
          52% {
            transform: translate3d(4px, -3px, 0);
          }
        }

        .glion3d-stage {
          animation: glion3d-emerge 5.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          will-change: transform, opacity;
        }
        .glion3d-shake {
          animation: glion3d-camera-shake 5.6s ease-in-out forwards;
        }
        .glion3d-head {
          transform-origin: 300px 290px;
          animation: glion3d-head-thrash 5.6s ease-in-out forwards;
        }
        .glion3d-mane-back {
          transform-origin: 300px 300px;
          animation: glion3d-mane-billow 2.6s ease-in-out infinite;
        }
        .glion3d-mane-front {
          transform-origin: 300px 300px;
          animation: glion3d-mane-billow 2.1s ease-in-out infinite reverse;
        }
        .glion3d-jaw {
          transform-origin: 300px 345px;
          animation: glion3d-jaw-roar 5.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .glion3d-snarl {
          transform-origin: 300px 315px;
          animation: glion3d-snarl-lift 5.6s ease-in-out forwards;
        }
        .glion3d-eyes {
          animation: glion3d-eye-blaze 5.6s ease-in-out forwards;
        }
        .glion3d-throat {
          transform-origin: 300px 370px;
          animation: glion3d-roar-core 5.6s ease-in-out forwards;
        }
        .glion3d-shock-1 {
          transform-origin: 300px 330px;
          animation: glion3d-shockwave 2.0s cubic-bezier(0.16, 1, 0.3, 1) 1.15s infinite;
        }
        .glion3d-shock-2 {
          transform-origin: 300px 330px;
          animation: glion3d-shockwave 2.0s cubic-bezier(0.16, 1, 0.3, 1) 1.55s infinite;
        }
        .glion3d-shock-3 {
          transform-origin: 300px 330px;
          animation: glion3d-shockwave 2.0s cubic-bezier(0.16, 1, 0.3, 1) 1.95s infinite;
        }
        .glion3d-shimmer {
          animation: glion3d-shimmer-sweep 2.4s ease-in-out infinite;
        }
        .glion3d-ember {
          animation: glion3d-ember-rise var(--dur) ease-out var(--delay) infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .glion3d-stage,
          .glion3d-shake,
          .glion3d-head,
          .glion3d-mane-back,
          .glion3d-mane-front,
          .glion3d-jaw,
          .glion3d-snarl,
          .glion3d-shock-1,
          .glion3d-shock-2,
          .glion3d-shock-3,
          .glion3d-shimmer,
          .glion3d-ember {
            animation: none !important;
          }
        }
      `}</style>

      {/* Cinematic Warm Gold Backlight Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.25) 0%, rgba(180, 83, 9, 0.12) 38%, rgba(0, 0, 0, 0) 68%)',
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

      {/* Center Stage Redesigned 3D-Sculpted Golden Lion */}
      <div className="glion3d-stage glion3d-shake relative flex items-center justify-center w-[min(92vw,470px)] h-[min(92vw,470px)] sm:w-[490px] sm:h-[490px]">
        {/* Floating Gold Embers */}
        <div className="absolute inset-0 pointer-events-none">
          {GOLD_EMBERS.map((e) => (
            <span
              key={e.id}
              className="glion3d-ember absolute rounded-full"
              style={
                {
                  left: `${e.startX}%`,
                  top: `${e.startY}%`,
                  width: `${e.sizePx}px`,
                  height: `${e.sizePx}px`,
                  background:
                    e.id % 3 === 0
                      ? 'radial-gradient(circle, #ffffff 0%, #fef08a 55%, #f59e0b 100%)'
                      : 'radial-gradient(circle, #fef08a 0%, #fbbf24 60%, #b45309 100%)',
                  boxShadow: '0 0 10px #fbbf24, 0 0 20px #d97706',
                  '--dx': `${e.driftX}px`,
                  '--dy': `${e.driftY}px`,
                  '--delay': `${e.delaySec}s`,
                  '--dur': `${e.durationSec}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* Master 3D-Sculpted Anatomical Male Lion SVG */}
        <svg
          viewBox="0 0 600 620"
          className="w-full h-full overflow-visible drop-shadow-[0_24px_48px_rgba(0,0,0,0.75)]"
          aria-label="Golden Lion"
        >
          <defs>
            {/* Sovereign Backlight Halo */}
            <radialGradient id="gl3dHalo" cx="50%" cy="48%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#d97706" stopOpacity="0.22" />
              <stop offset="80%" stopColor="#78350f" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>

            {/* Deep Obsidian-Bronze Shadow Mane */}
            <linearGradient id="gl3dManeShadow" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#78350f" />
              <stop offset="40%" stopColor="#451a03" />
              <stop offset="80%" stopColor="#270e02" />
              <stop offset="100%" stopColor="#120500" />
            </linearGradient>

            {/* Rich Burnished Bronze-Gold Mid Mane */}
            <linearGradient id="gl3dManeBronze" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="35%" stopColor="#d97706" />
              <stop offset="70%" stopColor="#92400e" />
              <stop offset="100%" stopColor="#3b1302" />
            </linearGradient>

            {/* Flowing 24K Metallic Gold Locks */}
            <linearGradient id="gl3dManeGold" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="25%" stopColor="#fde047" />
              <stop offset="60%" stopColor="#d97706" />
              <stop offset="90%" stopColor="#78350f" />
              <stop offset="100%" stopColor="#270e02" />
            </linearGradient>

            {/* Left-Lit Sculpted Gold Facial Armor Plane */}
            <linearGradient id="gl3dFaceLitLeft" x1="0%" y1="0%" x2="100%" y2="80%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="18%" stopColor="#fef08a" />
              <stop offset="55%" stopColor="#f59e0b" />
              <stop offset="88%" stopColor="#92400e" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>

            {/* Right-Lit Sculpted Gold Facial Armor Plane */}
            <linearGradient id="gl3dFaceLitRight" x1="100%" y1="0%" x2="0%" y2="80%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="18%" stopColor="#fef08a" />
              <stop offset="55%" stopColor="#f59e0b" />
              <stop offset="88%" stopColor="#92400e" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>

            {/* Center Bridge & Forehead Specular Gold */}
            <linearGradient id="gl3dCenterGold" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="22%" stopColor="#fef9c3" />
              <stop offset="52%" stopColor="#fbbf24" />
              <stop offset="82%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>

            {/* Deep Recessed Shadow Plane (Eye Sockets, Under-Cheeks, Under-Brow) */}
            <linearGradient id="gl3dRecessDark" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#451a03" />
              <stop offset="55%" stopColor="#230b01" />
              <stop offset="100%" stopColor="#0d0300" />
            </linearGradient>

            {/* 3D Ivory-Gold Curved Canine Fang Gradient */}
            <linearGradient id="gl3dFangGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#fef9c3" />
              <stop offset="85%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>

            {/* Molten Fiery Roar Throat Core */}
            <radialGradient id="gl3dMoltenThroat" cx="50%" cy="42%" r="55%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="28%" stopColor="#fef08a" />
              <stop offset="62%" stopColor="#ea580c" />
              <stop offset="88%" stopColor="#7c2d12" />
              <stop offset="100%" stopColor="#2a0804" />
            </radialGradient>

            {/* Shockwave Ring Gradient */}
            <radialGradient id="gl3dShockwaveGrad" cx="50%" cy="50%" r="50%">
              <stop offset="72%" stopColor="#fde047" stopOpacity="0" />
              <stop offset="91%" stopColor="#fbbf24" stopOpacity="0.65" />
              <stop offset="96%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
            </radialGradient>

            {/* Moving Metallic Specular Reflection */}
            <linearGradient id="gl3dMetallicSheen" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="42%" stopColor="#fef08a" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.65" />
              <stop offset="58%" stopColor="#fef08a" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            <clipPath id="gl3dFaceArmorClip">
              <path d="M 300 95 L 385 118 L 428 195 L 415 292 L 382 356 L 300 390 L 218 356 L 185 292 L 172 195 L 215 118 Z" />
            </clipPath>
          </defs>

          {/* Backlight Aura */}
          <circle cx="300" cy="300" r="275" fill="url(#gl3dHalo)" />

          {/* Expanding Roar Shockwaves */}
          <circle cx="300" cy="330" r="120" fill="url(#gl3dShockwaveGrad)" className="glion3d-shock-1" />
          <circle cx="300" cy="330" r="120" fill="url(#gl3dShockwaveGrad)" className="glion3d-shock-2" />
          <circle cx="300" cy="330" r="120" fill="url(#gl3dShockwaveGrad)" className="glion3d-shock-3" />

          {/* ==================== MAIN ANATOMICAL LION ASSEMBLY ==================== */}
          <g className="glion3d-head">
            {/* 1. DEEP BACK MANE SILHOUETTE (Broad Shoulders, Swept Side-Locks & Royal Chest Bib) */}
            <g className="glion3d-mane-back">
              {/* Outer Shadowed Mane Mass */}
              <path
                d="M 300 36
                   C 342 36, 388 52, 418 82
                   C 456 88, 492 118, 502 158
                   C 532 182, 546 226, 526 270
                   C 544 308, 528 358, 492 392
                   C 502 436, 468 488, 420 518
                   C 392 556, 346 584, 300 602
                   C 254 584, 208 556, 180 518
                   C 132 488, 98 436, 108 392
                   C 72 358, 56 308, 74 270
                   C 54 226, 68 182, 98 158
                   C 108 118, 144 88, 182 82
                   C 212 52, 258 36, 300 36 Z"
                fill="url(#gl3dManeShadow)"
                stroke="#b45309"
                strokeWidth="2.5"
              />

              {/* Left Swept Shoulder & Outer Cheek Locks (Hand-Sculpted S-Curves) */}
              <path
                d="M 210 64 C 156 76, 112 112, 96 164 C 122 148, 148 146, 174 156 Z"
                fill="url(#gl3dManeBronze)"
              />
              <path
                d="M 136 128 C 84 156, 58 212, 72 268 C 98 244, 128 232, 162 238 Z"
                fill="url(#gl3dManeGold)"
              />
              <path
                d="M 98 218 C 56 262, 58 326, 94 378 C 114 344, 142 324, 174 322 Z"
                fill="url(#gl3dManeBronze)"
              />
              <path
                d="M 106 322 C 82 378, 98 444, 148 492 C 158 448, 178 416, 206 398 Z"
                fill="url(#gl3dManeGold)"
              />

              {/* Right Swept Shoulder & Outer Cheek Locks (Mirrored S-Curves) */}
              <path
                d="M 390 64 C 444 76, 488 112, 504 164 C 478 148, 452 146, 426 156 Z"
                fill="url(#gl3dManeBronze)"
              />
              <path
                d="M 464 128 C 516 156, 542 212, 528 268 C 502 244, 472 232, 438 238 Z"
                fill="url(#gl3dManeGold)"
              />
              <path
                d="M 502 218 C 544 262, 542 326, 506 378 C 486 344, 458 324, 426 322 Z"
                fill="url(#gl3dManeBronze)"
              />
              <path
                d="M 494 322 C 518 378, 502 444, 452 492 C 442 448, 422 416, 394 398 Z"
                fill="url(#gl3dManeGold)"
              />

              {/* Deep Cascading Chest Bib Mane (Pointed V-Crest) */}
              <path
                d="M 164 388
                   C 146 448, 176 516, 232 558
                   L 300 598
                   L 368 558
                   C 424 516, 454 448, 436 388
                   C 394 426, 348 446, 300 446
                   C 252 446, 206 426, 164 388 Z"
                fill="url(#gl3dManeBronze)"
                stroke="#f59e0b"
                strokeWidth="1.8"
              />
              {/* Layered Golden Chest Locks */}
              <path
                d="M 196 408 C 192 468, 224 522, 268 558 L 300 582 L 300 442 C 260 442, 224 428, 196 408 Z"
                fill="url(#gl3dManeGold)"
              />
              <path
                d="M 404 408 C 408 468, 376 522, 332 558 L 300 582 L 300 442 C 340 442, 376 428, 404 408 Z"
                fill="url(#gl3dManeBronze)"
              />
              <path
                d="M 244 434 L 272 542 L 300 576 L 328 542 L 356 434 Q 300 458 244 434 Z"
                fill="url(#gl3dCenterGold)"
              />
            </g>

            {/* 2. ANATOMICAL FELINE EARS (Tucked Naturally into Upper Mane Crown) */}
            <g>
              {/* Left Ear */}
              <path
                d="M 188 156
                   C 152 126, 150 80, 186 74
                   C 216 70, 238 96, 234 134 Z"
                fill="url(#gl3dFaceLitLeft)"
                stroke="#3b1302"
                strokeWidth="3"
              />
              <path
                d="M 192 142 C 168 120, 168 92, 190 88 C 208 86, 222 104, 218 128 Z"
                fill="url(#gl3dRecessDark)"
              />
              {/* Left Ear Golden Fur Tuft */}
              <path
                d="M 178 118 Q 198 110 216 124 Q 198 134 178 118 Z"
                fill="#fde047"
                opacity="0.8"
              />

              {/* Right Ear */}
              <path
                d="M 412 156
                   C 448 126, 450 80, 414 74
                   C 384 70, 362 96, 366 134 Z"
                fill="url(#gl3dFaceLitRight)"
                stroke="#3b1302"
                strokeWidth="3"
              />
              <path
                d="M 408 142 C 432 120, 432 92, 410 88 C 392 86, 378 104, 382 128 Z"
                fill="url(#gl3dRecessDark)"
              />
              {/* Right Ear Golden Fur Tuft */}
              <path
                d="M 422 118 Q 402 110 384 124 Q 402 134 422 118 Z"
                fill="#fde047"
                opacity="0.8"
              />
            </g>

            {/* 3. INNER FRAMING MANE WAVES (Crown Crest & Cheek Framing Waves) */}
            <g className="glion3d-mane-front">
              {/* Swept-Back Top Crown Mane */}
              <path
                d="M 300 44
                   C 264 46, 224 68, 198 108
                   C 228 96, 262 94, 300 104
                   C 338 94, 372 96, 402 108
                   C 376 68, 336 46, 300 44 Z"
                fill="url(#gl3dManeGold)"
                stroke="#fef08a"
                strokeWidth="1.5"
              />
              {/* Center Swept Crown Plume */}
              <path
                d="M 300 32
                   C 276 54, 266 84, 274 114
                   L 300 102
                   L 326 114
                   C 334 84, 324 54, 300 32 Z"
                fill="url(#gl3dCenterGold)"
              />

              {/* Left Inner Cheek Mane Wave */}
              <path
                d="M 192 118
                   C 142 146, 112 204, 122 268
                   C 138 236, 160 218, 184 214 Z"
                fill="url(#gl3dManeGold)"
                stroke="#fde047"
                strokeWidth="1.2"
              />
              <path
                d="M 134 226
                   C 104 274, 114 342, 158 392
                   C 162 352, 178 322, 202 308 Z"
                fill="url(#gl3dManeGold)"
                stroke="#fde047"
                strokeWidth="1.2"
              />
              <path
                d="M 152 336
                   C 144 388, 174 438, 228 464
                   C 218 428, 218 396, 228 372 Z"
                fill="url(#gl3dManeBronze)"
              />

              {/* Right Inner Cheek Mane Wave */}
              <path
                d="M 408 118
                   C 458 146, 488 204, 478 268
                   C 462 236, 440 218, 416 214 Z"
                fill="url(#gl3dManeGold)"
                stroke="#fde047"
                strokeWidth="1.2"
              />
              <path
                d="M 466 226
                   C 496 274, 486 342, 442 392
                   C 438 352, 422 322, 398 308 Z"
                fill="url(#gl3dManeGold)"
                stroke="#fde047"
                strokeWidth="1.2"
              />
              <path
                d="M 448 336
                   C 456 388, 426 438, 372 464
                   C 382 428, 382 396, 372 372 Z"
                fill="url(#gl3dManeBronze)"
              />

              {/* Rim-Lit Hair Strand Highlights */}
              <g fill="none" stroke="#fef9c3" strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
                <path d="M 284 52 C 262 68, 248 86, 242 106" />
                <path d="M 316 52 C 338 68, 352 86, 358 106" />
                <path d="M 168 152 C 138 178, 124 214, 128 248" />
                <path d="M 432 152 C 462 178, 476 214, 472 248" />
                <path d="M 142 268 C 122 306, 128 346, 152 378" />
                <path d="M 458 268 C 478 306, 472 346, 448 378" />
                <path d="M 248 456 C 262 504, 280 542, 300 572" />
                <path d="M 352 456 C 338 504, 320 542, 300 572" />
              </g>
            </g>

            {/* 4. ARTICULATED LOWER JAW & ROARING ORAL CAVITY */}
            <g className="glion3d-jaw">
              {/* Outer Sculpted Mandible & Chin Bone */}
              <path
                d="M 218 328
                   L 224 416
                   C 234 452, 264 474, 300 478
                   C 336 474, 366 452, 376 416
                   L 382 328 Z"
                fill="url(#gl3dCenterGold)"
                stroke="#270e02"
                strokeWidth="3.5"
              />
              {/* Chin Mane Beard Tuft */}
              <path
                d="M 238 438
                   C 250 478, 274 506, 300 524
                   C 326 506, 350 478, 362 438
                   Q 300 464 238 438 Z"
                fill="url(#gl3dManeGold)"
                stroke="#fbbf24"
                strokeWidth="1.5"
              />

              {/* Deep Roaring Oral Cavity */}
              <path
                d="M 232 324
                   L 238 404
                   C 246 436, 270 450, 300 450
                   C 330 450, 354 436, 362 404
                   L 368 324 Z"
                fill="#1f0505"
                stroke="#451a03"
                strokeWidth="3"
              />

              {/* Stretching Cheek-Corner Folds (Commissures) */}
              <path d="M 224 326 Q 232 368 242 402" fill="none" stroke="#78350f" strokeWidth="4" />
              <path d="M 376 326 Q 368 368 358 402" fill="none" stroke="#78350f" strokeWidth="4" />

              {/* Molten Fiery Roar Throat Glow */}
              <ellipse
                cx="300"
                cy="376"
                rx="48"
                ry="38"
                fill="url(#gl3dMoltenThroat)"
                className="glion3d-throat"
              />

              {/* Sculpted Tongue Silhouette */}
              <path
                d="M 258 398 Q 300 374 342 398 C 336 428, 320 442, 300 442 C 280 442, 264 428, 258 398 Z"
                fill="#991b1b"
                stroke="#f59e0b"
                strokeWidth="1.2"
                opacity="0.85"
              />

              {/* Lower Gumline */}
              <path
                d="M 238 402 C 250 434, 274 446, 300 446 C 326 446, 350 434, 362 402"
                fill="none"
                stroke="#450a0a"
                strokeWidth="6"
                strokeLinecap="round"
              />

              {/* 3D Lower Curved Canine Fangs */}
              <path
                d="M 242 414 C 240 386, 246 364, 254 352 C 258 368, 262 392, 260 418 Z"
                fill="url(#gl3dFangGrad)"
                stroke="#78350f"
                strokeWidth="1.5"
              />
              <path
                d="M 358 414 C 360 386, 354 364, 346 352 C 342 368, 338 392, 340 418 Z"
                fill="url(#gl3dFangGrad)"
                stroke="#78350f"
                strokeWidth="1.5"
              />

              {/* Lower Incisor Row */}
              <polygon points="266,420 270,404 275,422" fill="#fef9c3" />
              <polygon points="278,424 282,408 287,425" fill="#ffffff" />
              <polygon points="290,426 295,410 299,426" fill="#ffffff" />
              <polygon points="301,426 305,410 310,426" fill="#ffffff" />
              <polygon points="313,425 318,408 322,424" fill="#ffffff" />
              <polygon points="325,422 330,404 334,420" fill="#fef9c3" />
            </g>

            {/* 5. 3D-SCULPTED CRANIUM, BROW RIDGES & ZYGOMATIC CHEEKBONES */}
            <g>
              {/* Base Cranial Armor Structure */}
              <path
                d="M 300 96
                   C 344 96, 384 114, 404 148
                   L 426 204
                   L 414 286
                   L 382 346
                   L 300 368
                   L 218 346
                   L 186 286
                   L 174 204
                   L 196 148
                   C 216 114, 256 96, 300 96 Z"
                fill="url(#gl3dCenterGold)"
                stroke="#270e02"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />

              {/* Left & Right Zygomatic Cheekbone Planes (Chiaroscuro 3D Facets) */}
              <path
                d="M 176 206 L 228 228 L 236 288 L 214 338 L 186 286 Z"
                fill="url(#gl3dFaceLitLeft)"
                stroke="#78350f"
                strokeWidth="1.5"
              />
              <path
                d="M 424 206 L 372 228 L 364 288 L 386 338 L 414 286 Z"
                fill="url(#gl3dFaceLitRight)"
                stroke="#78350f"
                strokeWidth="1.5"
              />

              {/* Recessed Sub-Cheek Shadow Planes */}
              <polygon points="188,284 234,288 220,342 196,316" fill="url(#gl3dRecessDark)" opacity="0.65" />
              <polygon points="412,284 366,288 380,342 404,316" fill="url(#gl3dRecessDark)" opacity="0.65" />

              {/* Sculpted Forehead Dome & Cranial Furrow */}
              <path
                d="M 224 126
                   C 248 106, 352 106, 376 126
                   L 362 186
                   L 300 206
                   L 238 186 Z"
                fill="url(#gl3dCenterGold)"
              />
              {/* Deep Central Forehead Furrow */}
              <path
                d="M 300 108 L 292 158 L 300 198 L 308 158 Z"
                fill="url(#gl3dRecessDark)"
                opacity="0.65"
              />
              {/* Forehead Muscular Brow Bosses */}
              <path
                d="M 234 142 C 254 130, 282 138, 290 168 C 268 176, 242 168, 234 142 Z"
                fill="#fef9c3"
                opacity="0.45"
              />
              <path
                d="M 366 142 C 346 130, 318 138, 310 168 C 332 176, 358 168, 366 142 Z"
                fill="#fef9c3"
                opacity="0.45"
              />

              {/* Heavy Overhanging Supraorbital Brow Ridge */}
              <path
                d="M 192 188
                   C 220 176, 262 186, 286 206
                   L 300 214
                   L 314 206
                   C 338 186, 380 176, 408 188
                   L 396 212
                   C 368 204, 336 214, 312 226
                   L 300 230
                   L 288 226
                   C 264 214, 232 204, 204 212 Z"
                fill="url(#gl3dRecessDark)"
                stroke="#fbbf24"
                strokeWidth="1.2"
              />

              {/* Deep Recessed Orbital Eye Sockets */}
              <path
                d="M 198 202 C 218 196, 254 206, 272 224 C 256 244, 218 242, 198 222 Z"
                fill="#120400"
              />
              <path
                d="M 402 202 C 382 196, 346 206, 328 224 C 344 244, 382 242, 402 222 Z"
                fill="#120400"
              />

              {/* Lacrimal Tear-Duct Channels Running Beside Nose Bridge */}
              <path
                d="M 268 226 C 262 254, 256 280, 246 302"
                fill="none"
                stroke="#1c0700"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              <path
                d="M 332 226 C 338 254, 344 280, 354 302"
                fill="none"
                stroke="#1c0700"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </g>

            {/* 6. FIERCE EXPRESSIVE PREDATOR EYES */}
            <g className="glion3d-eyes">
              {/* Left Eye */}
              <path
                d="M 206 208 C 224 202, 252 210, 266 224 C 248 236, 222 232, 206 208 Z"
                fill="#fef08a"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              <polygon points="214,211 258,222 244,229 218,222" fill="#ffffff" />
              <ellipse cx="238" cy="219" rx="4.5" ry="7" fill="#d97706" />
              <ellipse cx="238" cy="219" rx="2" ry="5.5" fill="#451a03" />
              <circle cx="235" cy="216" r="2" fill="#ffffff" />
              {/* Left Eye Energy Flare */}
              <path
                d="M 184 202 L 268 224"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.85"
              />

              {/* Right Eye */}
              <path
                d="M 394 208 C 376 202, 348 210, 334 224 C 352 236, 378 232, 394 208 Z"
                fill="#fef08a"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              <polygon points="386,211 342,222 356,229 382,222" fill="#ffffff" />
              <ellipse cx="362" cy="219" rx="4.5" ry="7" fill="#d97706" />
              <ellipse cx="362" cy="219" rx="2" ry="5.5" fill="#451a03" />
              <circle cx="365" cy="216" r="2" fill="#ffffff" />
              {/* Right Eye Energy Flare */}
              <path
                d="M 416 202 L 332 224"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.85"
              />
            </g>

            {/* 7. SNARLING NOSE BRIDGE, MUZZLE PADS & UPPER CANINE FANGS */}
            <g className="glion3d-snarl">
              {/* Anatomical Nasal Bridge */}
              <path
                d="M 274 214
                   L 326 214
                   L 338 286
                   L 300 304
                   L 262 286 Z"
                fill="url(#gl3dCenterGold)"
                stroke="#451a03"
                strokeWidth="2.2"
              />
              {/* Specular Ridge Down Center of Nose */}
              <polygon points="292,216 308,216 312,282 300,292 288,282" fill="#fef9c3" opacity="0.7" />

              {/* Fierce Roaring Snarl Wrinkles Across Nasal Bridge */}
              <g fill="none" stroke="#3b1302" strokeWidth="3.2" strokeLinecap="round">
                <path d="M 272 234 Q 300 224 328 234" />
                <path d="M 268 250 Q 300 238 332 250" />
                <path d="M 264 266 Q 300 254 336 266" />
              </g>
              <g fill="none" stroke="#fef08a" strokeWidth="1.4" strokeLinecap="round" opacity="0.75">
                <path d="M 274 237 Q 300 227 326 237" />
                <path d="M 270 253 Q 300 241 330 253" />
              </g>

              {/* Upper Gumline & Snarl Lip Line */}
              <path
                d="M 218 336 Q 258 316 300 328 Q 342 316 382 336 L 372 348 Q 300 334 228 348 Z"
                fill="#1a0502"
                stroke="#451a03"
                strokeWidth="2"
              />

              {/* Massive 3D-Shaded Upper Curved Canine Fangs */}
              <path
                d="M 232 332 C 230 364, 236 392, 246 406 C 252 388, 256 362, 254 334 Z"
                fill="url(#gl3dFangGrad)"
                stroke="#78350f"
                strokeWidth="1.6"
              />
              <path
                d="M 368 332 C 370 364, 364 392, 354 406 C 348 388, 344 362, 346 334 Z"
                fill="url(#gl3dFangGrad)"
                stroke="#78350f"
                strokeWidth="1.6"
              />

              {/* Upper Incisor Teeth Row */}
              <polygon points="260,334 265,352 271,334" fill="#fef9c3" />
              <polygon points="273,335 278,354 284,335" fill="#ffffff" />
              <polygon points="286,336 292,355 298,336" fill="#ffffff" />
              <polygon points="302,336 308,355 314,336" fill="#ffffff" />
              <polygon points="316,335 322,354 327,335" fill="#ffffff" />
              <polygon points="329,334 335,352 340,334" fill="#fef9c3" />

              {/* Left & Right Sculpted Whisker Muzzle Pads (Curled in a Snarl) */}
              <path
                d="M 262 288
                   C 234 278, 202 292, 198 320
                   C 196 340, 218 348, 246 338
                   C 272 328, 288 320, 300 330
                   L 300 308 Z"
                fill="url(#gl3dFaceLitLeft)"
                stroke="#270e02"
                strokeWidth="3"
              />
              <path
                d="M 338 288
                   C 366 278, 398 292, 402 320
                   C 404 340, 382 348, 354 338
                   C 328 328, 312 320, 300 330
                   L 300 308 Z"
                fill="url(#gl3dFaceLitRight)"
                stroke="#270e02"
                strokeWidth="3"
              />

              {/* Whisker Follicle Rows on Muzzle Pads */}
              <g fill="#3b1302">
                <circle cx="226" cy="306" r="2.5" />
                <circle cx="242" cy="304" r="2.5" />
                <circle cx="258" cy="306" r="2.5" />
                <circle cx="218" cy="318" r="2.5" />
                <circle cx="236" cy="316" r="2.5" />
                <circle cx="252" cy="318" r="2.5" />

                <circle cx="374" cy="306" r="2.5" />
                <circle cx="358" cy="304" r="2.5" />
                <circle cx="342" cy="306" r="2.5" />
                <circle cx="382" cy="318" r="2.5" />
                <circle cx="364" cy="316" r="2.5" />
                <circle cx="348" cy="318" r="2.5" />
              </g>

              {/* Anatomical Feline Nose Leather (Triangular Shield with Flared Nostrils) */}
              <path
                d="M 262 282
                   C 278 274, 322 274, 338 282
                   L 326 308
                   L 300 322
                   L 274 308 Z"
                fill="url(#gl3dRecessDark)"
                stroke="#fbbf24"
                strokeWidth="2"
              />
              {/* Flared Nostrils */}
              <path
                d="M 270 290 C 276 286, 288 292, 290 302 C 280 304, 272 298, 270 290 Z"
                fill="#050100"
              />
              <path
                d="M 330 290 C 324 286, 312 292, 310 302 C 320 304, 328 298, 330 290 Z"
                fill="#050100"
              />
              {/* Philtrum Groove */}
              <line x1="300" y1="286" x2="300" y2="328" stroke="#050100" strokeWidth="3" />

              {/* Sweeping Metallic Gold Whiskers */}
              <g fill="none" stroke="#fef08a" strokeWidth="1.8" strokeLinecap="round" opacity="0.8">
                <path d="M 218 308 C 174 302, 134 312, 98 330" />
                <path d="M 214 318 C 168 318, 128 334, 92 356" />
                <path d="M 222 328 C 182 334, 146 352, 116 376" />

                <path d="M 382 308 C 426 302, 466 312, 502 330" />
                <path d="M 386 318 C 432 318, 472 334, 508 356" />
                <path d="M 378 328 C 418 334, 454 352, 484 376" />
              </g>
            </g>

            {/* 8. MOVING METALLIC SPECULAR SHEEN ACROSS FACIAL PLANES */}
            <g clipPath="url(#gl3dFaceArmorClip)">
              <rect
                x="220"
                y="70"
                width="110"
                height="360"
                fill="url(#gl3dMetallicSheen)"
                className="glion3d-shimmer"
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
            sent <span className="text-amber-400 font-extrabold">Golden Lion</span> 🦁
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
