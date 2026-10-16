'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Volume2, VolumeX, Activity, Sparkles, X, RotateCcw } from 'lucide-react';

export interface UniverseGiftPayload {
  giftId: 'lonkind.universe';
  sender: string;
  senderAvatar?: string;
  combo?: number;
  timestamp: number;
  seed: number;
  qualityTier: 'low' | 'medium' | 'high';
}

interface UniverseGiftProps {
  senderName: string;
  senderAvatar?: string;
  combo?: number;
  videoUrl?: string;
  seed?: number;
  timestamp?: number;
  qualityTier?: 'low' | 'medium' | 'high';
  showStudioControls?: boolean;
  onComplete: () => void;
}

type QualityTier = 'low' | 'medium' | 'high';

interface StarParticle {
  x: number;
  y: number;
  z: number;
  r: number;
  hue: number;
  tw: number;
}

interface DustParticle {
  a: number;
  r: number;
  z: number;
  s: number;
  h: number;
}

interface GalaxyItem {
  x: number;
  y: number;
  z: number;
  r: number;
  rot: number;
  tint: number;
}

const PHASES: [string, number, number][] = [
  ['DARKNESS', 0, 1.8],
  ['SINGULARITY', 1.8, 4.6],
  ['BIRTH', 4.6, 8],
  ['GALAXIES', 8, 11],
  ['VOYAGE', 11, 16.3],
  ['BLACK HOLE', 16.3, 20.4],
  ['GRAVITY', 20.4, 23.3],
  ['SILENCE', 23.3, 23.75],
  ['EXPLOSION', 23.75, 26.7],
  ['INFINITY', 26.7, 31],
  ['SIGNATURE', 31, 33.4],
  ['COLLAPSE', 33.4, 37.5],
];

const PHASE_CAPTIONS: Record<string, { caption: string; description: string }> = {
  IDLE: {
    caption: 'THE MOMENT BEFORE EVERYTHING',
    description: 'A universe waits in a single point of light.',
  },
  DARKNESS: {
    caption: 'SCENE 01 / TOTAL DARKNESS',
    description: 'Deep space falls silent as the first faint stars awaken.',
  },
  SINGULARITY: {
    caption: 'SCENE 02 / THE FIRST LIGHT',
    description: 'A pulsing singularity bends space and draws matter inward.',
  },
  BIRTH: {
    caption: 'SCENE 03 / BIRTH OF THE UNIVERSE',
    description: 'Primordial light erupts outward into cosmic clouds and starlight.',
  },
  GALAXIES: {
    caption: 'SCENE 04 / GALAXIES FORM',
    description: 'Spiral galaxies, nebulae, and star clusters ignite across the void.',
  },
  VOYAGE: {
    caption: 'SCENE 05 / INTERSTELLAR VOYAGE',
    description: 'Accelerating past a ringed gas giant and a radiant golden star.',
  },
  'BLACK HOLE': {
    caption: 'SCENE 06 / SUPERMASSIVE HORIZON',
    description: 'Gravitational lensing bends starlight around the accretion disk.',
  },
  GRAVITY: {
    caption: 'SCENE 07 / GRAVITATIONAL PULL',
    description: 'Relativistic matter spirals inward toward the event horizon.',
  },
  SILENCE: {
    caption: 'SCENE 07.5 / ABSOLUTE ZERO',
    description: '...',
  },
  EXPLOSION: {
    caption: 'SCENE 08 / THE COSMIC EXPLOSION',
    description: 'A cataclysmic shockwave expands the universe at hyper-velocity.',
  },
  INFINITY: {
    caption: 'SCENE 09 / INFINITE COSMOS',
    description: 'Floating across an endless horizon of galaxies and starlight.',
  },
  SIGNATURE: {
    caption: 'SCENE 10 / LONKIND IDENTITY',
    description: 'Procedural light · Synchronized moments · One Universe.',
  },
  COLLAPSE: {
    caption: 'SCENE 11 / SINGULARITY RETURN',
    description: 'All creation folds gently back into a single point of light.',
  },
};

const DURATION = 37.5;
const DENSITIES: Record<QualityTier, number> = { low: 260, medium: 650, high: 1200 };
const TAU = Math.PI * 2;

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v: number) => {
  const c = clamp(v);
  return c * c * (3 - 2 * c);
};

function seeded(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) | 0;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function UniverseGift({
  senderName,
  senderAvatar,
  combo = 1,
  videoUrl,
  seed: initialSeed,
  timestamp: initialTimestamp,
  qualityTier: initialQualityTier,
  showStudioControls = false,
  onComplete,
}: UniverseGiftProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Telemetry & UI States matching the Lonkind Gift Engine specification
  const [statusValue, setStatusValue] = useState<string>('EVENT RECEIVED');
  const [offsetValue, setOffsetValue] = useState<string>('+38 ms');
  const [phaseValue, setPhaseValue] = useState<string>('DARKNESS');
  const [fpsValue, setFpsValue] = useState<string>('60');
  const [quality, setQuality] = useState<QualityTier>(() => {
    if (initialQualityTier) return initialQualityTier;
    if (typeof window !== 'undefined') {
      const cores = navigator.hardwareConcurrency || 4;
      return cores <= 4 || window.innerWidth < 380 ? 'low' : 'high';
    }
    return 'medium';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [notice, setNotice] = useState<string>('Playing synchronized UNIVERSE event');
  const [showTelemetry, setShowTelemetry] = useState<boolean>(showStudioControls);

  // Mutable engine refs for 60fps lock-free loop
  const soundEnabledRef = useRef<boolean>(true);
  const qualityRef = useRef<QualityTier>(quality);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const voicesRef = useRef<(OscillatorNode | AudioBufferSourceNode)[]>([]);
  const eventRef = useRef<UniverseGiftPayload | null>(null);
  const clockOffsetRef = useRef<number>(38);
  const phaseRef = useRef<string>('');
  const rafRef = useRef<number>(0);

  const stopVoices = useCallback(() => {
    for (const v of voicesRef.current) {
      try {
        v.stop();
      } catch (_) {}
    }
    voicesRef.current = [];
  }, []);

  const ensureAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const audio = new AC();
      const master = audio.createGain();
      master.gain.value = soundEnabledRef.current ? 0.42 : 0;
      master.connect(audio.destination);
      audioCtxRef.current = audio;
      masterGainRef.current = master;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  const tone = useCallback(
    (freq: number, length: number, type: OscillatorType = 'sine', gain = 0.12, slide = 1, delay = 0) => {
      const audio = audioCtxRef.current;
      const master = masterGainRef.current;
      if (!audio || !master || !soundEnabledRef.current) return;
      try {
        const at = audio.currentTime + delay;
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, at);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), at + length);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, at + length);
        o.connect(g);
        g.connect(master);
        o.start(at);
        o.stop(at + length + 0.04);
        voicesRef.current.push(o);
        o.onended = () => {
          voicesRef.current = voicesRef.current.filter((x) => x !== o);
          try {
            o.disconnect();
            g.disconnect();
          } catch (_) {}
        };
      } catch (_) {}
    },
    []
  );

  const noise = useCallback((length: number, gain = 0.1, filterFreq = 700, delay = 0) => {
    const audio = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!audio || !master || !soundEnabledRef.current) return;
    try {
      const sr = audio.sampleRate;
      const buffer = audio.createBuffer(1, Math.floor(sr * length), sr);
      const data = buffer.getChannelData(0);
      let x = eventRef.current ? eventRef.current.seed : 91;
      for (let i = 0; i < data.length; i++) {
        x = (Math.imul(x, 1664525) + 1013904223) | 0;
        data[i] = ((x >>> 0) / 2147483648 - 1) * (0.5 + 0.5 * (1 - i / data.length));
      }
      const src = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const g = audio.createGain();
      const at = audio.currentTime + delay;
      src.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(gain, at + Math.min(0.35, length * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, at + length);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(at);
      src.stop(at + length + 0.01);
      voicesRef.current.push(src);
      src.onended = () => {
        voicesRef.current = voicesRef.current.filter((v) => v !== src);
        try {
          src.disconnect();
          filter.disconnect();
          g.disconnect();
        } catch (_) {}
      };
    } catch (_) {}
  }, []);

  const audioPhase = useCallback(
    (name: string) => {
      if (name === 'SILENCE') {
        stopVoices();
        return;
      }
      if (!soundEnabledRef.current) return;
      ensureAudio();
      switch (name) {
        case 'DARKNESS':
          tone(43, 2.2, 'sine', 0.12, 0.78);
          noise(1.7, 0.045, 105);
          break;
        case 'SINGULARITY':
          tone(56, 2.6, 'sine', 0.15, 1.7);
          tone(180, 1.9, 'sine', 0.035, 2.3);
          break;
        case 'BIRTH':
          noise(2.9, 0.21, 1250);
          tone(55, 2.5, 'sawtooth', 0.11, 0.54);
          tone(440, 1.9, 'sine', 0.055, 2.1);
          break;
        case 'GALAXIES':
          tone(330, 2.8, 'sine', 0.035, 1.5);
          tone(660, 2.3, 'sine', 0.02, 1.3);
          break;
        case 'VOYAGE':
          noise(4.8, 0.09, 500);
          tone(82, 4, 'sine', 0.08, 1.3);
          break;
        case 'BLACK HOLE':
          tone(67, 4, 'sawtooth', 0.09, 0.61);
          noise(3.5, 0.065, 180);
          break;
        case 'GRAVITY':
          tone(58, 2.85, 'sawtooth', 0.16, 0.5);
          tone(110, 2.75, 'sine', 0.08, 0.65);
          break;
        case 'EXPLOSION':
          tone(79, 2.2, 'sine', 0.31, 0.35);
          noise(2.4, 0.3, 1800);
          tone(830, 1.4, 'sine', 0.045, 1.7);
          break;
        case 'INFINITY':
          noise(3.6, 0.03, 1400);
          tone(392, 3.5, 'sine', 0.045, 0.85);
          tone(784, 2.7, 'sine', 0.018, 1.12);
          break;
        case 'SIGNATURE':
          tone(523, 2.1, 'sine', 0.035, 0.76);
          break;
        case 'COLLAPSE':
          tone(92, 3.6, 'sine', 0.17, 0.28);
          tone(41, 2.6, 'sine', 0.1, 0.58, 1);
          break;
      }
    },
    [ensureAudio, noise, stopVoices, tone]
  );

  // Main 12-Phase UNIVERSE Procedural Canvas + Synchronized Stream Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let dpr = 1;
    let w = 0;
    let h = 0;
    let stars: StarParticle[] = [];
    let dust: DustParticle[] = [];
    let galaxies: GalaxyItem[] = [];
    let rng: () => number = seeded(42);
    let frameCount = 0;
    let fpsStamp = performance.now();

    function fill(color: string) {
      if (!ctx) return;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
    }

    function glow(x: number, y: number, r: number, color: string, alpha = 1) {
      if (!ctx || r < 0.3) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color.replace('ALPHA', String(alpha)));
      g.addColorStop(0.3, color.replace('ALPHA', String(alpha * 0.32)));
      g.addColorStop(1, color.replace('ALPHA', '0'));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    function dot(x: number, y: number, r: number, color: string, a = 1) {
      if (!ctx) return;
      ctx.globalAlpha = a;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.15, r), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function line(x1: number, y1: number, x2: number, y2: number, color: string, width = 1, alpha = 1) {
      if (!ctx) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function idle() {
      fill('#02050b');
      const x = w / 2;
      const y = h * 0.43;
      glow(x, y, Math.min(w * 0.38, 160), 'rgba(87,113,171,ALPHA)', 0.08);
      dot(x, y, 1.4, '#c7d8ed', 0.75);
      const seededIdle = seeded(42);
      for (let i = 0; i < 45; i++) {
        dot(
          seededIdle() * w,
          seededIdle() * h * 0.88,
          0.25 + seededIdle() * 0.55,
          '#c9dcff',
          0.12 + seededIdle() * 0.28
        );
      }
    }

    function resize() {
      if (!stage || !canvas || !ctx) return;
      const rect = stage.getBoundingClientRect();
      w = rect.width || window.innerWidth;
      h = rect.height || window.innerHeight;
      const q = qualityRef.current;
      dpr = Math.min(
        window.devicePixelRatio || 1,
        q === 'high' ? 1.7 : q === 'medium' ? 1.4 : 1.15
      );
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!eventRef.current) idle();
    }

    function prepare(seedVal: number) {
      rng = seeded(seedVal);
      stars = [];
      dust = [];
      galaxies = [];
      const q = qualityRef.current;
      const n = DENSITIES[q];
      for (let i = 0; i < n; i++) {
        stars.push({
          x: rng() * 2 - 1,
          y: rng() * 2 - 1,
          z: 0.08 + rng() * 0.92,
          r: 0.35 + rng() * 1.3,
          hue: rng(),
          tw: rng() * TAU,
        });
      }
      for (let i = 0; i < Math.floor(n * 0.55); i++) {
        dust.push({
          a: rng() * TAU,
          r: Math.sqrt(rng()),
          z: rng(),
          s: rng(),
          h: rng(),
        });
      }
      const galaxyCount = q === 'high' ? 85 : q === 'medium' ? 52 : 28;
      for (let i = 0; i < galaxyCount; i++) {
        galaxies.push({
          x: (rng() - 0.5) * 2.9,
          y: (rng() - 0.5) * 3.6,
          z: 0.25 + rng() * 1.5,
          r: 1 + rng() * 2.8,
          rot: rng() * TAU,
          tint: rng(),
        });
      }
    }

    function disk(cx: number, cy: number, rx: number, ry: number, power = 1, angle = -0.22) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * (0.8 + k * 0.12), ry * (0.75 + k * 0.2), 0, 0, TAU);
        ctx.strokeStyle =
          k % 2
            ? 'rgba(236,184,123,' + 0.18 * power + ')'
            : 'rgba(141,179,255,' + 0.17 * power + ')';
        ctx.lineWidth = (6 - k) * 2.3;
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#b5baff';
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    function galaxy(x: number, y: number, size: number, rot: number, tint: number, opacity = 1) {
      if (!ctx) return;
      if (x < -size * 2 || x > w + size * 2 || y < -size * 2 || y > h + size * 2) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1, 0.52);
      glow(
        0,
        0,
        size * 1.5,
        tint > 0.55 ? 'rgba(91,147,246,ALPHA)' : 'rgba(192,123,220,ALPHA)',
        opacity * 0.2
      );
      ctx.globalCompositeOperation = 'lighter';
      for (let arm = 0; arm < 2; arm++) {
        for (let j = 0; j < 16; j++) {
          const q = j / 16;
          const a = q * 5.8 + arm * Math.PI;
          const rad = size * (0.12 + q * 0.85);
          dot(
            Math.cos(a) * rad,
            Math.sin(a) * rad,
            0.3 + (0.8 - q) * 1.2,
            j % 4 === 0 ? '#fbe0ae' : tint > 0.55 ? '#9bc5ff' : '#c0a7e5',
            opacity * (1 - q * 0.58)
          );
        }
      }
      dot(0, 0, Math.max(1, size * 0.07), '#ffedcb', opacity);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    function starfield(t: number, strength = 1, warp = 0) {
      if (!ctx) return;
      ctx.globalCompositeOperation = 'lighter';
      const cx = w * 0.5;
      const cy = h * 0.47;
      const scale = Math.min(w, h) * 0.9;
      for (const p of stars) {
        let depth = (p.z + t * warp * 0.085) % 1;
        if (depth < 0.025) depth = 0.025;
        const spread = (1.25 - depth) * 1.5;
        const x = cx + p.x * scale * spread;
        const y = cy + p.y * scale * spread;
        if (x < 0 || x > w || y < 0 || y > h) continue;
        const alpha = strength * (0.3 + 0.7 * (1 - depth)) * (0.82 + 0.18 * Math.sin(t * 2 + p.tw));
        const color = p.hue < 0.16 ? '#ffe5bc' : p.hue < 0.63 ? '#b5d0ff' : '#ddd0ff';
        dot(x, y, p.r * (1.3 - depth * 0.65), color, alpha);
        if (warp && depth < 0.5) {
          line(
            x,
            y,
            x + (x - cx) * warp * 0.028,
            y + (y - cy) * warp * 0.028,
            color,
            0.5,
            alpha * 0.4
          );
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function clouds(t: number, intensity = 1) {
      if (!ctx) return;
      const cx = w * 0.5;
      const cy = h * 0.47;
      ctx.globalCompositeOperation = 'lighter';
      glow(cx - w * 0.27 * Math.sin(t * 0.25), cy - h * 0.22, w * 0.75, 'rgba(43,73,179,ALPHA)', 0.11 * intensity);
      glow(cx + w * 0.29, cy + h * 0.06, w * 0.6, 'rgba(113,52,169,ALPHA)', 0.09 * intensity);
      glow(cx - w * 0.12, cy + h * 0.27, w * 0.52, 'rgba(186,114,79,ALPHA)', 0.055 * intensity);
      for (const p of dust) {
        const a = p.a + t * (0.018 + p.z * 0.03);
        const r = p.r * w * 0.75 * (0.65 + p.z);
        dot(
          cx + Math.cos(a) * r,
          cy + Math.sin(a) * r * 0.95,
          0.25 + p.s * 0.7,
          p.h > 0.77 ? '#ffe0a1' : p.h > 0.35 ? '#9cb8ff' : '#c1a1e8',
          (0.09 + p.s * 0.22) * intensity
        );
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function galaxiesView(t: number, progress = 0, spread = 1) {
      for (const g of galaxies) {
        const depth = ((g.z - progress * 0.42 + 2) % 2) + 0.15;
        const zoom = 1 / depth;
        galaxy(
          w / 2 + g.x * w * 0.32 * zoom * spread,
          h * 0.48 + g.y * h * 0.22 * zoom * spread,
          g.r * 5.2 * zoom,
          g.rot + t * 0.016,
          g.tint,
          clamp((2 - depth) * 0.75)
        );
      }
    }

    function ringPlanet(t: number) {
      if (!ctx) return;
      const approach = smooth((t - 11.5) / 3.7);
      const leave = smooth((t - 14.2) / 2);
      const p = approach * (1 - leave);
      if (p < 0.01) return;
      const x = w * (0.76 - 0.55 * approach);
      const y = h * (0.67 - 0.18 * approach);
      const r = w * (0.055 + 0.24 * approach);
      ctx.save();
      ctx.globalAlpha = p;
      glow(x, y, r * 2, 'rgba(105,156,231,ALPHA)', 0.25);
      disk(x, y, r * 1.7, r * 0.37, 0.7, -0.35);
      const sphere = ctx.createRadialGradient(x - r * 0.38, y - r * 0.45, r * 0.04, x, y, r);
      sphere.addColorStop(0, '#e2c79b');
      sphere.addColorStop(0.35, '#667a9e');
      sphere.addColorStop(0.75, '#26364f');
      sphere.addColorStop(1, '#070d1b');
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#f6dbaf';
      ctx.lineWidth = Math.max(1, r * 0.025);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.72, r * 0.36, -0.35, 0.1, Math.PI - 0.1);
      ctx.stroke();
      ctx.restore();
    }

    function glowingStar(t: number) {
      const v = smooth((t - 13) / 2) * (1 - smooth((t - 16) / 0.7));
      if (!v) return;
      const x = w * 0.79 - (t - 13) * w * 0.17;
      const y = h * 0.28 + (t - 13) * h * 0.05;
      const r = w * (0.025 + 0.035 * v);
      glow(x, y, r * 5, 'rgba(255,192,104,ALPHA)', v * 0.55);
      glow(x, y, r * 2, 'rgba(255,248,210,ALPHA)', v * 0.85);
      dot(x, y, r * 0.5, '#fff9e4', v);
      line(x - r * 3, y, x + r * 3, y, '#ffdfac', 1, v * 0.35);
    }

    function blackHole(t: number, pull = false) {
      if (!ctx || dust.length === 0) return;
      const cx = w * 0.52;
      const cy = h * 0.46;
      const entry = smooth((t - 16.2) / 1.6);
      const growth = pull ? 1 + smooth((t - 20.4) / 3) * 0.7 : 1;
      const r = w * 0.135 * entry * growth;
      if (r < 2) return;
      glow(cx, cy, r * 3.3, 'rgba(103,97,213,ALPHA)', 0.23);
      // Offset light arcs suggest lensing around the dark gravitational silhouette
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.31);
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, r * (1.1 + k * 0.22), r * (1.1 + k * 0.22), 0, -2.3, 2.4);
        ctx.strokeStyle = ['#a2b9ff', '#e9c494', '#8597db'][k];
        ctx.globalAlpha = 0.48 - k * 0.1;
        ctx.lineWidth = 2.2 - k * 0.3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#a9c1ff';
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      disk(cx, cy, r * 2.15, r * 0.5, 0.95, -0.3);
      const halo = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r * 1.21);
      halo.addColorStop(0, '#010208');
      halo.addColorStop(0.75, '#0b0c19');
      halo.addColorStop(1, '#e9ba82');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.21, 0, TAU);
      ctx.fill();
      dot(cx, cy, r * 0.99, '#000105');
      ctx.globalCompositeOperation = 'lighter';
      const q = qualityRef.current;
      const loops = q === 'high' ? 200 : q === 'medium' ? 125 : 70;
      for (let i = 0; i < loops; i++) {
        const p = dust[i % dust.length];
        const angle =
          p.a + t * (0.35 + p.z * 0.25) + (pull ? Math.pow(clamp((t - 20.4) / 3), 2) * 3 : 0);
        const rad = r * (1.6 + p.r * 3) * (pull ? 1 - 0.38 * smooth((t - 20.4) / 3) : 1);
        const x = cx + Math.cos(angle) * rad;
        const y = cy + Math.sin(angle) * rad * 0.58;
        dot(x, y, 0.4 + p.s * 0.8, p.h > 0.5 ? '#eac29c' : '#9ebaff', 0.2 + p.s * 0.4);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function shockwave(t: number, start: number, scale = 1) {
      if (!ctx) return;
      const p = clamp((t - start) / 2.2);
      if (!p || p >= 1) return;
      const radius = w * (0.03 + p * 1.22) * scale;
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.46, radius, radius * 0.85, 0, 0, TAU);
      ctx.strokeStyle = 'rgba(208,225,255,' + (1 - p) * 0.75 + ')';
      ctx.lineWidth = (1 - p) * 5 + 0.5;
      ctx.stroke();
      glow(w / 2, h * 0.46, radius * 0.35, 'rgba(236,207,161,ALPHA)', (1 - p) * 0.16);
    }

    function title(text: string, t: number, from: number, to: number) {
      if (!ctx) return;
      const fade = smooth((t - from) / 1.15) * (1 - smooth((t - to + 0.7) / 0.8));
      if (fade <= 0) return;
      const size = text === 'UNIVERSE' ? Math.min(w * 0.112, 49) : Math.min(w * 0.086, 37);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '500 ' + size + 'px Raleway, sans-serif';
      (ctx as unknown as { letterSpacing?: string }).letterSpacing = '0.15em';
      ctx.shadowColor = '#c4d6ff';
      ctx.shadowBlur = 26 * fade;
      ctx.globalAlpha = fade * 0.37;
      ctx.fillStyle = '#8199ca';
      ctx.fillText(text, w / 2, h * 0.47);
      ctx.shadowBlur = 11;
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#f5eddc';
      ctx.fillText(text, w / 2, h * 0.47);
      ctx.restore();
    }

    function draw(t: number) {
      if (!ctx) return;
      fill('#010309');
      const cx = w / 2;
      const cy = h * 0.46;
      const active = PHASES.find((p) => t >= p[1] && t < p[2]);
      const name = active ? active[0] : 'IDLE';
      if (name !== phaseRef.current) {
        phaseRef.current = name;
        setPhaseValue(name);
        audioPhase(name);
      }

      if (t < 1.8) {
        starfield(t, smooth((t - 0.15) / 1.5) * 0.12);
      } else if (t < 4.6) {
        const p = smooth((t - 1.8) / 2.8);
        starfield(t, 0.18 + p * 0.25);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < Math.min(dust.length, 350); i++) {
          const d = dust[i];
          const r = w * (0.8 - d.z * 0.25) * (1 - p * 0.94);
          dot(
            cx + Math.cos(d.a + t * 0.3) * r,
            cy + Math.sin(d.a + t * 0.3) * r,
            0.35 + d.s,
            d.h > 0.5 ? '#d9bda2' : '#a6baff',
            p * 0.6
          );
        }
        glow(cx, cy, w * (0.06 + p * 0.19), 'rgba(162,185,255,ALPHA)', 0.35 + p * 0.35);
        dot(cx, cy, 1.5 + p * 5 + Math.sin(t * 10) * 1.2, '#fff9ed');
        ctx.globalCompositeOperation = 'source-over';
      } else if (t < 8) {
        const p = smooth((t - 4.6) / 2.2);
        clouds(t, p);
        starfield(t, 0.4 + p * 0.5, 0.7);
        glow(cx, cy, w * (0.15 + p * 0.28), 'rgba(244,222,183,ALPHA)', (1 - p) * 0.95);
        shockwave(t, 4.6);
      } else if (t < 11) {
        clouds(t, 0.9);
        starfield(t, 0.8, 0.45);
        galaxiesView(t, (t - 8) * 0.35);
      } else if (t < 16.3) {
        clouds(t, 0.7);
        starfield(t, 1, 2.8);
        galaxiesView(t, t - 8);
        ringPlanet(t);
        glowingStar(t);
      } else if (t < 23.3) {
        const pull = t >= 20.4;
        clouds(t, 0.55);
        starfield(t, pull ? 0.65 : 0.8, pull ? 1.5 : 0.6);
        blackHole(t, pull);
        if (pull) {
          const p = smooth((t - 20.4) / 2.9);
          glow(cx, cy, w * 0.9, 'rgba(41,46,101,ALPHA)', p * 0.25);
          fill('rgba(0,0,0,' + p * 0.38 + ')');
        }
      } else if (t < 23.75) {
        fill('#000000');
      } else if (t < 26.7) {
        const p = smooth((t - 23.75) / 2.7);
        const shake = (1 - p) * Math.min(w * 0.018, 7);
        ctx.save();
        ctx.translate(Math.sin(t * 83) * shake, Math.cos(t * 67) * shake);
        clouds(t, 1.5 - p * 0.2);
        starfield(t, 1, 4);
        galaxiesView(t, (t - 23.75) * 3, 1 + p * 1.6);
        glow(cx, cy, w * (0.38 + p * 0.35), 'rgba(255,238,203,ALPHA)', (1 - p) * 0.85);
        shockwave(t, 23.75, 1.25);
        ctx.restore();
      } else if (t < 33.4) {
        clouds(t, 0.5);
        starfield(t, 0.9, 0.35);
        galaxiesView(t, 0, 0.85);
        if (t < 31) title('UNIVERSE', t, 26.9, 31);
        else title('LONKIND', t, 31, 33.4);
      } else {
        const p = smooth((t - 33.4) / 4.1);
        ctx.save();
        ctx.globalAlpha = 1 - p;
        const shrink = 1 - p * 0.97;
        ctx.translate(cx, cy);
        ctx.scale(shrink, shrink);
        ctx.translate(-cx, -cy);
        clouds(t, 0.3);
        starfield(t, 0.7);
        galaxiesView(t, 0, 0.8);
        ctx.restore();
        glow(cx, cy, w * 0.16 * (1 - p), 'rgba(196,214,255,ALPHA)', (1 - p) * 0.6);
        if (p < 0.93) dot(cx, cy, (1 - p) * 2 + 1, '#ffffff', 1 - p);
      }
    }

    function finish() {
      eventRef.current = null;
      phaseRef.current = '';
      setStatusValue('READY');
      setPhaseValue('IDLE');
      setFpsValue('—');
      setNotice('Sequence complete. Ready to replay.');
      stopVoices();
      idle();
      onComplete();
    }

    function frame(now: number) {
      if (!eventRef.current) return;
      const elapsed = (Date.now() + clockOffsetRef.current - eventRef.current.timestamp) / 1000;
      if (elapsed >= DURATION) {
        finish();
        return;
      }
      draw(Math.max(0, elapsed));
      frameCount++;
      if (now - fpsStamp > 600) {
        setFpsValue(String(Math.round((frameCount * 1000) / (now - fpsStamp || 600))));
        frameCount = 0;
        fpsStamp = now;
      }
      rafRef.current = requestAnimationFrame(frame);
    }

    // Stream & Engine Architecture matching window.LonkindGiftEngine
    const listeners = new Set<(payload: UniverseGiftPayload) => void>();
    const stream = {
      listeners,
      subscribe(fn: (payload: UniverseGiftPayload) => void) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      publish(payload: UniverseGiftPayload) {
        for (const fn of listeners) fn(payload);
      },
    };

    const engine = {
      engineState: 'IDLE',
      receive(payload: UniverseGiftPayload) {
        if (payload.giftId !== 'lonkind.universe') return;
        cancelAnimationFrame(rafRef.current);
        eventRef.current = payload;
        engine.engineState = 'PLAYING';
        qualityRef.current = payload.qualityTier;
        setQuality(payload.qualityTier);
        prepare(payload.seed);
        setStatusValue('EVENT RECEIVED');
        setOffsetValue((clockOffsetRef.current >= 0 ? '+' : '') + clockOffsetRef.current + ' ms');
        setNotice('Playing synchronized UNIVERSE event');
        resize();
        frameCount = 0;
        fpsStamp = performance.now();
        rafRef.current = requestAnimationFrame(frame);
      },
    };

    const unsubscribe = stream.subscribe((payload) => engine.receive(payload));

    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).LonkindGiftEngine = {
        stream,
        engine,
        emit: (payload: UniverseGiftPayload) => stream.publish(payload),
      };
    }

    // Launch initial synchronized event immediately on mount
    ensureAudio();
    const startPayload: UniverseGiftPayload = {
      giftId: 'lonkind.universe',
      sender: senderName || 'Livestream viewer',
      senderAvatar,
      combo,
      timestamp: initialTimestamp || Date.now() + clockOffsetRef.current,
      seed: initialSeed || ((Date.now() ^ Math.imul(1, 2654435761)) >>> 0),
      qualityTier: qualityRef.current,
    };
    stream.publish(startPayload);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
          audioCtxRef.current.suspend().catch(() => {});
        }
      } else {
        if (eventRef.current) {
          if (soundEnabledRef.current && audioCtxRef.current) {
            audioCtxRef.current.resume().catch(() => {});
          }
          rafRef.current = requestAnimationFrame(frame);
        } else {
          idle();
        }
      }
    };

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      cancelAnimationFrame(rafRef.current);
      stopVoices();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [audioPhase, combo, ensureAudio, initialSeed, initialTimestamp, onComplete, senderAvatar, senderName, stopVoices]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEnabledRef.current = next;
    ensureAudio();
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(next ? 0.42 : 0, audioCtxRef.current.currentTime, 0.03);
    }
    if (!next) {
      stopVoices();
    } else if (eventRef.current) {
      audioPhase(phaseRef.current);
    }
    setNotice(next ? 'Sound enabled.' : 'Sound muted.');
  };

  const handleSelectQuality = (q: QualityTier) => {
    qualityRef.current = q;
    setQuality(q);
    setNotice(`${q[0].toUpperCase() + q.slice(1)} quality selected.`);
  };

  const handleReplayEvent = () => {
    ensureAudio();
    const eng = (window as unknown as { LonkindGiftEngine?: { emit: (p: UniverseGiftPayload) => void } })
      .LonkindGiftEngine;
    if (eng) {
      phaseRef.current = '';
      eng.emit({
        giftId: 'lonkind.universe',
        sender: senderName || 'Livestream viewer',
        senderAvatar,
        combo,
        timestamp: Date.now() + clockOffsetRef.current,
        seed: (Date.now() ^ Math.imul(Math.floor(Math.random() * 1000) + 2, 2654435761)) >>> 0,
        qualityTier: qualityRef.current,
      });
    }
  };

  const currentMeta = PHASE_CAPTIONS[phaseValue] || PHASE_CAPTIONS.IDLE;

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden bg-[#01030a] select-none"
      style={{
        fontFamily: "'Raleway', sans-serif",
        boxShadow: 'inset 0 0 65px rgba(2, 3, 11, 0.85)',
      }}
    >
      {/* Real HD .MP4 Cosmic Video Layers Synchronized with the 12 Procedural Phases */}
      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        {/* Nebula & Galaxies Layer */}
        <video
          src={videoUrl || '/gifts/universe-nebula.mp4'}
          autoPlay
          loop
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            phaseValue === 'BIRTH' ||
            phaseValue === 'GALAXIES' ||
            phaseValue === 'INFINITY' ||
            phaseValue === 'SIGNATURE'
              ? 'opacity-45'
              : 'opacity-0'
          }`}
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Interstellar Voyage Wormhole Layer */}
        <video
          src="/gifts/universe-wormhole.mp4"
          autoPlay
          loop
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            phaseValue === 'VOYAGE' ? 'opacity-50 scale-105' : 'opacity-0'
          }`}
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Black Hole & Gravitational Pull Layer */}
        <video
          src="/gifts/universe-blackhole.mp4"
          autoPlay
          loop
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
            phaseValue === 'BLACK HOLE'
              ? 'opacity-55 scale-100'
              : phaseValue === 'GRAVITY'
              ? 'opacity-65 scale-125'
              : 'opacity-0 scale-90'
          }`}
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Cosmic Explosion Supernova Layer */}
        <video
          src="/gifts/universe-supernova.mp4"
          autoPlay
          loop
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            phaseValue === 'EXPLOSION' ? 'opacity-75 scale-110' : 'opacity-0'
          }`}
          style={{ mixBlendMode: 'screen' }}
        />
      </div>

      {/* Procedural 12-Phase UNIVERSE Canvas (#cosmos) */}
      <canvas
        ref={canvasRef}
        id="cosmos"
        aria-label="Procedural UNIVERSE gift animation"
        className="absolute inset-0 w-full h-full block z-[2] pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Top Stage Bar (Matches User's UNIVERSE — Lonkind Gift Engine Stage Top) */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-5 pt-5 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2.5">
          <span
            className="text-[10px] tracking-[0.2em] uppercase px-2.5 py-1.5 border border-white/25 bg-[#07101b]/80 text-[#e2ddcf] backdrop-blur-md"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            ● LIVE EVENT · {phaseValue}
          </span>

          {/* Sender Royal Pill */}
          <div className="flex items-center gap-2 bg-[#07101b]/85 border border-[#e8d5a6]/40 px-3 py-1 rounded-full backdrop-blur-md">
            <Avatar className="h-5 w-5 border border-[#e8d5a6]">
              <AvatarImage src={senderAvatar} alt={senderName} />
              <AvatarFallback className="bg-slate-800 text-[#e8d5a6] text-[9px] font-bold">
                {senderName ? senderName.charAt(0) : 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-semibold text-[#f2eee4]">@{senderName}</span>
            {combo > 1 && (
              <span className="text-[10px] font-bold bg-[#e8d5a6] text-[#101521] px-1.5 py-0.2 rounded-full">
                x{combo}
              </span>
            )}
          </div>
        </div>

        {/* Right Controls: Sound Toggle, Telemetry HUD Toggle & Skip */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleSound}
            aria-pressed={soundEnabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-white/25 bg-[#07101b]/80 hover:bg-white/15 text-[#edf2ff] text-xs transition-colors backdrop-blur-md"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-[#e8d5a6]" /> : <VolumeX className="h-3.5 w-3.5 text-slate-400" />}
            <span className="hidden sm:inline text-[10px] tracking-wider uppercase">
              {soundEnabled ? 'Sound on' : 'Sound off'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowTelemetry((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border text-xs transition-colors backdrop-blur-md ${
              showTelemetry
                ? 'border-[#e8d5a6] bg-[#e8d5a6] text-[#101521] font-semibold'
                : 'border-white/25 bg-[#07101b]/80 text-[#e8d5a6] hover:bg-white/15'
            }`}
            style={{ fontFamily: "'Space Mono', monospace" }}
            title="Toggle Engine Telemetry"
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[10px] tracking-wider uppercase">Telemetry</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopVoices();
              onComplete();
            }}
            className="p-1.5 rounded-sm border border-white/20 bg-[#07101b]/80 hover:bg-rose-500/20 text-slate-300 hover:text-white transition-colors backdrop-blur-md"
            title="Close Universe Gift"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Engine Telemetry & Quality Tier Panel (From User's Spec) */}
      {showTelemetry && (
        <aside className="relative z-10 w-full max-w-sm ml-auto mr-5 mt-3 p-4 border border-white/15 bg-[#0c1322]/90 backdrop-blur-xl rounded-sm pointer-events-auto shadow-2xl animate-in fade-in slide-in-from-right-5 duration-200">
          <div className="flex justify-between gap-3 items-center mb-3">
            <h3
              className="text-[10px] tracking-[0.26em] uppercase text-[#d9c79f] m-0"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              ENGINE TELEMETRY
            </h3>
            <span
              className="text-[10px] text-[#8998ae]"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              LONKIND / LIVE
            </span>
          </div>

          <dl
            className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[11px] leading-5"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            <dt className="text-[#8896aa]">EVENT STATUS</dt>
            <dd className="text-right text-[#e4ebf7] m-0">{statusValue}</dd>

            <dt className="text-[#8896aa]">SYNC OFFSET</dt>
            <dd className="text-right text-[#e4ebf7] m-0">{offsetValue}</dd>

            <dt className="text-[#8896aa]">CURRENT PHASE</dt>
            <dd className="text-right text-[#e8d5a6] font-bold m-0">{phaseValue}</dd>

            <dt className="text-[#8896aa]">FRAME RATE</dt>
            <dd className="text-right text-[#e4ebf7] m-0">{fpsValue} FPS</dd>

            <dt className="text-[#8896aa]">QUALITY TIER</dt>
            <dd className="text-right text-[#e4ebf7] m-0">{quality.toUpperCase()}</dd>
          </dl>

          <div className="border-t border-white/10 mt-3 pt-3">
            <p
              className="text-[10px] tracking-[0.24em] uppercase mb-2 text-[#aeb8cb]"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              RENDER QUALITY / TIER
            </p>
            <div role="group" aria-label="Rendering quality" className="grid grid-cols-3 gap-2">
              {(['high', 'medium', 'low'] as QualityTier[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={quality === tier}
                  onClick={() => handleSelectQuality(tier)}
                  className={`min-h-8 text-xs rounded-sm transition-colors ${
                    quality === tier
                      ? 'bg-[#e8d5a6] text-[#101521] font-semibold'
                      : 'bg-white/5 text-[#aeb8cb] hover:bg-white/15'
                  }`}
                >
                  {tier[0].toUpperCase() + tier.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10">
            <span className="text-[11px] text-[#d9c79f] truncate">{notice}</span>
            <button
              type="button"
              onClick={handleReplayEvent}
              className="flex items-center gap-1 px-2.5 py-1 rounded-sm bg-[#e8d5a6] text-[#101521] text-[11px] font-semibold hover:bg-[#fff1cb] shrink-0"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Replay</span>
            </button>
          </div>
        </aside>
      )}

      {/* Stage Footer Caption & Lonkind Signature */}
      <div
        className="relative z-10 w-full pt-16 pb-6 px-6 pointer-events-none"
        style={{ background: 'linear-gradient(transparent, rgba(2, 5, 12, 0.88))' }}
      >
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p
              className="text-[10px] tracking-[0.26em] uppercase text-[#dbcda9] mb-1.5 flex items-center gap-1.5"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              <Sparkles className="h-3 w-3 text-[#e8d5a6]" />
              <span>{currentMeta.caption}</span>
            </p>
            <p className="text-sm text-[#c3cbd8] leading-relaxed m-0">{currentMeta.description}</p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <span
              className="text-[10px] tracking-[0.26em] uppercase text-[#e8d5a6] block"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              LONKIND / REAL-TIME GIFTS
            </span>
            <span
              className="text-[9px] tracking-[0.2em] uppercase text-[#75829a]"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              PROCEDURAL LIGHT · SYNCHRONIZED MOMENTS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
