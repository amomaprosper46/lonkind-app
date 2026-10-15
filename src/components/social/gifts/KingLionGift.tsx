'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, Sparkles } from 'lucide-react';

interface KingLionGiftProps {
  senderName: string;
  senderAvatar?: string;
  combo?: number;
  onComplete: () => void;
}

export default function KingLionGift({
  senderName,
  senderAvatar,
  combo = 1,
  onComplete,
}: KingLionGiftProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scenes: 1 (Summoning) -> 2 (Appear) -> 3 (Roar) -> 4 (Charge) -> 5 (Impact) -> 6 (King Moment) -> 7 (Exit)
  const [scene, setScene] = useState<number>(1);
  const [isRoaring, setIsRoaring] = useState<boolean>(false);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [isImpact, setIsImpact] = useState<boolean>(false);
  const [showKingTypography, setShowKingTypography] = useState<boolean>(false);
  const [screenFlash, setScreenFlash] = useState<boolean>(false);
  const [screenShake, setScreenShake] = useState<boolean>(false);

  // 1. Procedural High-End Audio Engine (Zero Video/External MP3 Dependency)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Sound 1: Summoning Low Rumble & Shimmer (t = 0.0s)
      const rumbleOsc = ctx.createOscillator();
      const rumbleGain = ctx.createGain();
      rumbleOsc.type = 'sine';
      rumbleOsc.frequency.setValueAtTime(45, ctx.currentTime);
      rumbleOsc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.9);
      rumbleGain.gain.setValueAtTime(0.01, ctx.currentTime);
      rumbleGain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.8);
      rumbleGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      rumbleOsc.connect(rumbleGain);
      rumbleGain.connect(ctx.destination);
      rumbleOsc.start();
      rumbleOsc.stop(ctx.currentTime + 1.3);

      // Sound 2: Materialize Impact Thud (t = 0.9s)
      setTimeout(() => {
        try {
          const thudOsc = ctx.createOscillator();
          const thudGain = ctx.createGain();
          thudOsc.type = 'sine';
          thudOsc.frequency.setValueAtTime(120, ctx.currentTime);
          thudOsc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.4);
          thudGain.gain.setValueAtTime(0.5, ctx.currentTime);
          thudGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          thudOsc.connect(thudGain);
          thudGain.connect(ctx.destination);
          thudOsc.start();
          thudOsc.stop(ctx.currentTime + 0.5);
        } catch (_) {}
      }, 900);

      // Sound 3: THE ROAR (t = 1.8s) - Guttural Sawtooth + Sub-Bass + Breath Noise
      setTimeout(() => {
        try {
          // Guttural throat
          const roarOsc = ctx.createOscillator();
          const roarGain = ctx.createGain();
          roarOsc.type = 'sawtooth';
          roarOsc.frequency.setValueAtTime(190, ctx.currentTime);
          roarOsc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.4);
          roarOsc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 1.4);

          // Deep sub-bass boom
          const subOsc = ctx.createOscillator();
          const subGain = ctx.createGain();
          subOsc.type = 'sine';
          subOsc.frequency.setValueAtTime(85, ctx.currentTime);
          subOsc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 1.2);

          // Turbulent roar breath noise
          const bufSize = ctx.sampleRate * 1.5;
          const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
          const noiseData = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufSize; i++) noiseData[i] = Math.random() * 2 - 1;
          const noiseSource = ctx.createBufferSource();
          noiseSource.buffer = noiseBuffer;
          const noiseFilter = ctx.createBiquadFilter();
          noiseFilter.type = 'bandpass';
          noiseFilter.frequency.setValueAtTime(600, ctx.currentTime);
          noiseFilter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.3);
          noiseFilter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 1.4);
          noiseFilter.Q.value = 3;

          roarGain.gain.setValueAtTime(0.01, ctx.currentTime);
          roarGain.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.25);
          roarGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

          subGain.gain.setValueAtTime(0.6, ctx.currentTime);
          subGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.3);

          roarOsc.connect(roarGain);
          subOsc.connect(subGain);
          noiseSource.connect(noiseFilter);
          noiseFilter.connect(roarGain);

          roarGain.connect(ctx.destination);
          subGain.connect(ctx.destination);

          roarOsc.start();
          subOsc.start();
          noiseSource.start();

          roarOsc.stop(ctx.currentTime + 1.5);
          subOsc.stop(ctx.currentTime + 1.5);
          noiseSource.stop(ctx.currentTime + 1.5);
        } catch (_) {}
      }, 1800);

      // Sound 4: Charge Whoosh (t = 3.2s)
      setTimeout(() => {
        try {
          const whooshOsc = ctx.createOscillator();
          const whooshGain = ctx.createGain();
          whooshOsc.type = 'triangle';
          whooshOsc.frequency.setValueAtTime(90, ctx.currentTime);
          whooshOsc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.8);
          whooshGain.gain.setValueAtTime(0.1, ctx.currentTime);
          whooshGain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.6);
          whooshGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.9);
          whooshOsc.connect(whooshGain);
          whooshGain.connect(ctx.destination);
          whooshOsc.start();
          whooshOsc.stop(ctx.currentTime + 0.9);
        } catch (_) {}
      }, 3200);

      // Sound 5: Impact Slam (t = 4.2s)
      setTimeout(() => {
        try {
          const impactOsc = ctx.createOscillator();
          const impactGain = ctx.createGain();
          impactOsc.type = 'sawtooth';
          impactOsc.frequency.setValueAtTime(150, ctx.currentTime);
          impactOsc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.6);
          impactGain.gain.setValueAtTime(0.7, ctx.currentTime);
          impactGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
          impactOsc.connect(impactGain);
          impactGain.connect(ctx.destination);
          impactOsc.start();
          impactOsc.stop(ctx.currentTime + 0.7);
        } catch (_) {}
      }, 4200);

      // Sound 6: King Fanfare & Celestial Chimes (t = 4.9s)
      setTimeout(() => {
        try {
          const freqs = [329.63, 440.00, 554.37, 659.25, 880.00];
          freqs.forEach((freq, idx) => {
            const chimeOsc = ctx.createOscillator();
            const chimeGain = ctx.createGain();
            chimeOsc.type = 'sine';
            chimeOsc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
            chimeGain.gain.setValueAtTime(0.01, ctx.currentTime + idx * 0.08);
            chimeGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.08 + 0.04);
            chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 1.8);
            chimeOsc.connect(chimeGain);
            chimeGain.connect(ctx.destination);
            chimeOsc.start(ctx.currentTime + idx * 0.08);
            chimeOsc.stop(ctx.currentTime + idx * 0.08 + 1.9);
          });
        } catch (_) {}
      }, 4900);
    } catch (e) {
      console.warn('King Lion sound initialization error:', e);
    }
  }, []);

  // 2. Cinematic Timeline Director (Exact Synchronized Timers)
  useEffect(() => {
    // Scene 1 -> 2: Lion Appears (0.9s)
    const t1 = setTimeout(() => {
      setScene(2);
    }, 900);

    // Scene 2 -> 3: The Roar & Shockwave (1.8s)
    const t2 = setTimeout(() => {
      setScene(3);
      setIsRoaring(true);
      setScreenFlash(true);
      setScreenShake(true);
      setTimeout(() => setScreenFlash(false), 180);
      setTimeout(() => setScreenShake(false), 850);
    }, 1800);

    // End roar pose (3.0s)
    const t3 = setTimeout(() => {
      setIsRoaring(false);
    }, 3000);

    // Scene 3 -> 4: Charge Toward Camera (3.2s)
    const t4 = setTimeout(() => {
      setScene(4);
      setIsCharging(true);
    }, 3200);

    // Scene 4 -> 5: Impact (4.2s)
    const t5 = setTimeout(() => {
      setScene(5);
      setIsCharging(false);
      setIsImpact(true);
      setScreenFlash(true);
      setScreenShake(true);
      setTimeout(() => setScreenFlash(false), 220);
      setTimeout(() => setScreenShake(false), 500);
    }, 4200);

    // Scene 5 -> 6: King Moment & Hero Shot (4.9s)
    const t6 = setTimeout(() => {
      setScene(6);
      setIsImpact(false);
      setShowKingTypography(true);
    }, 4900);

    // Scene 6 -> 7: Final Exit & Dissolve (6.8s)
    const t7 = setTimeout(() => {
      setScene(7);
      setShowKingTypography(false);
    }, 6800);

    // Total Duration: Complete and return screen (8.0s)
    const t8 = setTimeout(() => {
      onComplete();
    }, 8000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(t7);
      clearTimeout(t8);
    };
  }, [onComplete]);

  // 3. High-Performance Particle Engine (Swirls, Shockwaves, Embers, Dissolve)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      color: string;
      life: number;
      maxLife: number;
      type: 'ember' | 'swirl' | 'shockwave' | 'dust' | 'stardust';
    }

    const particles: Particle[] = [];
    const shockwaves: Array<{ x: number; y: number; r: number; maxR: number; alpha: number; color: string }> = [];

    const colors = ['#f59e0b', '#fbbf24', '#fef08a', '#ff4500', '#ea580c', '#ffffff'];

    // Spawn Swirling Summoning Embers (Scene 1)
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: width / 2 + (Math.random() - 0.5) * width * 0.6,
        y: height + Math.random() * 200,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 8 - 4,
        radius: Math.random() * 3.5 + 1.5,
        alpha: Math.random() * 0.8 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: Math.random() * 80 + 60,
        type: 'swirl',
      });
    }

    let lastRoarSpawn = false;
    let lastImpactSpawn = false;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Trigger Shockwave & Radial Embers on Roar (Scene 3)
      if (scene === 3 && !lastRoarSpawn) {
        lastRoarSpawn = true;
        shockwaves.push({
          x: width / 2,
          y: height * 0.45,
          r: 20,
          maxR: Math.max(width, height) * 0.75,
          alpha: 1,
          color: '#fbbf24',
        });
        shockwaves.push({
          x: width / 2,
          y: height * 0.45,
          r: 10,
          maxR: Math.max(width, height) * 0.55,
          alpha: 0.8,
          color: '#ff4500',
        });

        // Roar high-velocity blast
        for (let i = 0; i < 140; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 14 + 5;
          particles.push({
            x: width / 2,
            y: height * 0.45,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 4 + 2,
            alpha: 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 0,
            maxLife: Math.random() * 50 + 30,
            type: 'ember',
          });
        }
      }

      // Trigger Shockwave & Dust on Impact (Scene 5)
      if (scene === 5 && !lastImpactSpawn) {
        lastImpactSpawn = true;
        shockwaves.push({
          x: width / 2,
          y: height / 2,
          r: 10,
          maxR: Math.max(width, height) * 0.9,
          alpha: 1,
          color: '#ffffff',
        });
        shockwaves.push({
          x: width / 2,
          y: height / 2,
          r: 30,
          maxR: Math.max(width, height) * 0.8,
          alpha: 0.9,
          color: '#fbbf24',
        });

        for (let i = 0; i < 180; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 18 + 6;
          particles.push({
            x: width / 2,
            y: height / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 5 + 2,
            alpha: 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 0,
            maxLife: Math.random() * 45 + 25,
            type: 'dust',
          });
        }
      }

      // Royal Golden Stardust Rain (Scene 6)
      if (scene === 6 && Math.random() < 0.45) {
        particles.push({
          x: Math.random() * width,
          y: -10,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 2 + 1,
          radius: Math.random() * 2.5 + 1,
          alpha: Math.random() * 0.7 + 0.3,
          color: '#fbbf24',
          life: 0,
          maxLife: 150,
          type: 'stardust',
        });
      }

      // Dissolve particles (Scene 7)
      if (scene === 7 && Math.random() < 0.7) {
        particles.push({
          x: width / 2 + (Math.random() - 0.5) * 220,
          y: height * 0.45 + (Math.random() - 0.5) * 220,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 6 - 2,
          radius: Math.random() * 3 + 1,
          alpha: 1,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 0,
          maxLife: 80,
          type: 'ember',
        });
      }

      // Render Expanding Shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.r += (sw.maxR - sw.r) * 0.12;
        sw.alpha *= 0.91;

        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 14 * sw.alpha;
        ctx.globalAlpha = sw.alpha;
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = 30;
        ctx.stroke();
        ctx.restore();

        if (sw.alpha < 0.02) {
          shockwaves.splice(i, 1);
        }
      }

      // Render & Update Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        if (p.type === 'swirl') {
          // Spiraling pull toward center
          const dx = width / 2 - p.x;
          p.vx += dx * 0.008;
          p.alpha = Math.min(1, p.life / 20) * (1 - p.life / p.maxLife);
        } else if (p.type === 'ember' || p.type === 'dust') {
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.alpha = 1 - p.life / p.maxLife;
        } else if (p.type === 'stardust') {
          p.alpha = 0.8 * Math.sin((p.life / p.maxLife) * Math.PI);
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();

        if (p.life >= p.maxLife || p.alpha <= 0.01) {
          particles.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [scene]);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 pointer-events-none select-none overflow-hidden flex items-center justify-center transition-transform duration-75 ${
        screenShake ? 'animate-screen-shake' : ''
      }`}
    >
      {/* Cinematic Dark Vignette Overlay (Scene 1 to 7) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.85)_95%)] transition-opacity duration-700 pointer-events-none z-10" />

      {/* Screen Bright Flash Overlay (Roar & Impact Apex) */}
      {screenFlash && (
        <div className="absolute inset-0 bg-gradient-to-r from-amber-200/50 via-white/70 to-amber-200/50 pointer-events-none z-50 animate-in fade-in duration-75" />
      )}

      {/* High-Performance Particle & Shockwave Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-20 pointer-events-none" />

      {/* Hero Lion Visual Stage */}
      <div className="relative z-30 flex flex-col items-center justify-center w-full max-w-lg mx-auto">
        {/* Sacred Celestial Sun Disc / Golden Halo (Scene 6 Hero Shot) */}
        {scene >= 6 && (
          <div className="absolute -top-16 w-80 h-80 rounded-full bg-gradient-to-tr from-amber-500/30 via-yellow-400/40 to-amber-600/30 blur-2xl animate-pulse pointer-events-none" />
        )}

        {/* Dynamic Multi-Scene Lion Container with 3D Perspective Transformations */}
        <div
          className={`relative transition-all duration-500 flex flex-col items-center ${
            scene === 1
              ? 'scale-50 opacity-40 blur-sm translate-y-12'
              : scene === 2
              ? 'scale-100 opacity-100 blur-0 translate-y-0 transition-transform duration-700 ease-out'
              : scene === 3
              ? 'scale-125 translate-y-[-10px] drop-shadow-[0_0_60px_rgba(245,158,11,1)]'
              : scene === 4
              ? 'scale-[2.6] translate-y-16 blur-[1px] transition-all duration-700 ease-in'
              : scene === 5
              ? 'scale-[1.8] translate-y-4 filter contrast-125'
              : scene === 6
              ? 'scale-110 translate-y-[-15px] opacity-100 transition-all duration-700 ease-out'
              : 'scale-90 opacity-0 translate-x-24 transition-all duration-1000 ease-in-out'
          }`}
        >
          {/* Majestic Male Lion Vector Composition */}
          <div className="relative w-72 h-72 sm:w-84 sm:h-84 flex items-center justify-center">
            {/* Ambient Golden Core Radiance */}
            <div
              className={`absolute inset-0 rounded-full bg-gradient-to-b from-amber-400/40 via-yellow-500/30 to-amber-700/40 blur-2xl transition-opacity duration-500 ${
                scene >= 3 ? 'opacity-100 animate-pulse' : 'opacity-50'
              }`}
            />

            {/* Custom High-Res Majestic Lion Artwork (SVG) */}
            <svg
              viewBox="0 0 512 512"
              className={`w-full h-full filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)] transition-transform duration-300 ${
                isRoaring ? 'scale-110' : ''
              }`}
            >
              <defs>
                <radialGradient id="sunHalo" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="maneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="35%" stopColor="#d97706" />
                  <stop offset="70%" stopColor="#b45309" />
                  <stop offset="100%" stopColor="#451a03" />
                </linearGradient>

                <linearGradient id="furGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="40%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>

                <linearGradient id="goldGleam" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="50%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>

                <filter id="eyeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Sun Disc Backdrop Halo */}
              {scene >= 2 && (
                <circle cx="256" cy="245" r="195" fill="url(#sunHalo)" className="animate-pulse" />
              )}

              {/* Majestic Flowing Outer Mane Layers */}
              <g id="outerMane">
                <path
                  d="M256 50 C180 50 110 90 85 160 C65 215 70 280 95 330 C125 390 180 435 256 455 C332 435 387 390 417 330 C442 280 447 215 427 160 C402 90 332 50 256 50 Z"
                  fill="url(#maneGrad)"
                />
                {/* Windblown Mane Tufts Left & Right */}
                <path
                  d="M100 170 Q40 210 70 260 Q50 310 110 350 Q160 440 256 470 Q352 440 402 350 Q462 310 442 260 Q472 210 412 170 C360 80 152 80 100 170 Z"
                  fill="#78350f"
                  opacity="0.85"
                />
                <path
                  d="M125 180 C80 230 90 300 130 350 C170 400 210 430 256 445 C302 430 342 400 382 350 C422 300 432 230 387 180 C340 100 172 100 125 180 Z"
                  fill="url(#maneGrad)"
                />
              </g>

              {/* Muscular Lion Face & Jaw Structure */}
              <g id="lionHead">
                {/* Cheeks & Forehead */}
                <path
                  d="M190 180 C175 230 180 290 205 330 C220 355 240 370 256 372 C272 370 292 355 307 330 C332 290 337 230 322 180 C305 140 207 140 190 180 Z"
                  fill="url(#furGrad)"
                />

                {/* Ears */}
                <path d="M165 145 C150 120 175 90 200 115 Z" fill="#92400e" />
                <path d="M172 138 C162 122 178 102 195 120 Z" fill="#fde68a" />
                <path d="M347 145 C362 120 337 90 312 115 Z" fill="#92400e" />
                <path d="M340 138 C350 122 334 102 317 120 Z" fill="#fde68a" />

                {/* Broad Muscular Muzzle */}
                <path
                  d="M215 285 C210 320 235 345 256 345 C277 345 302 320 297 285 C295 265 217 265 215 285 Z"
                  fill="#fef3c7"
                />

                {/* Dark Nose Pad */}
                <path
                  d="M242 270 L270 270 C274 270 276 274 274 278 L260 294 C258 296 254 296 252 294 L238 278 C236 274 238 270 242 270 Z"
                  fill="#1c1917"
                />

                {/* Piercing Glowing Amber Eyes */}
                <g id="eyes" filter="url(#eyeGlow)">
                  {/* Left Eye */}
                  <polygon points="208,215 232,222 215,228" fill="#f59e0b" />
                  <circle cx="218" cy="222" r="3.5" fill="#451a03" />
                  <circle cx="217" cy="221" r="1.5" fill="#ffffff" />

                  {/* Right Eye */}
                  <polygon points="304,215 280,222 297,228" fill="#f59e0b" />
                  <circle cx="294" cy="222" r="3.5" fill="#451a03" />
                  <circle cx="295" cy="221" r="1.5" fill="#ffffff" />
                </g>

                {/* Roaring Open Mouth (Active in Scene 3, closed/noble in others) */}
                {isRoaring ? (
                  <g id="roaringMouth">
                    {/* Deep Cavity */}
                    <path
                      d="M225 315 C220 375 292 375 287 315 C270 325 242 325 225 315 Z"
                      fill="#450a0a"
                    />
                    {/* Fiery Inner Glow */}
                    <ellipse cx="256" cy="342" rx="24" ry="14" fill="#ea580c" opacity="0.8" />
                    <ellipse cx="256" cy="342" rx="14" ry="8" fill="#fbbf24" />

                    {/* Sharp White Upper Fangs */}
                    <polygon points="230,314 235,328 238,314" fill="#ffffff" />
                    <polygon points="274,314 277,328 282,314" fill="#ffffff" />
                    <polygon points="244,316 248,322 251,316" fill="#fef08a" />
                    <polygon points="261,316 264,322 268,316" fill="#fef08a" />

                    {/* Lower Fangs */}
                    <polygon points="236,360 240,348 243,360" fill="#ffffff" />
                    <polygon points="269,360 272,348 276,360" fill="#ffffff" />
                  </g>
                ) : (
                  <path
                    d="M242 305 Q256 314 270 305"
                    stroke="#292524"
                    strokeWidth="3.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                )}

                {/* Whiskers */}
                <line x1="190" y1="290" x2="140" y2="280" stroke="#fef08a" strokeWidth="1.5" opacity="0.7" />
                <line x1="192" y1="296" x2="145" y2="295" stroke="#fef08a" strokeWidth="1.5" opacity="0.7" />
                <line x1="190" y1="302" x2="142" y2="310" stroke="#fef08a" strokeWidth="1.5" opacity="0.7" />
                <line x1="322" y1="290" x2="372" y2="280" stroke="#fef08a" strokeWidth="1.5" opacity="0.7" />
                <line x1="320" y1="296" x2="367" y2="295" stroke="#fef08a" strokeWidth="1.5" opacity="0.7" />
                <line x1="322" y1="302" x2="370" y2="310" stroke="#fef08a" strokeWidth="1.5" opacity="0.7" />
              </g>

              {/* Royal Crown Ornamentation (Scene 6 King Moment) */}
              {scene >= 6 && (
                <g id="royalCrown" className="animate-bounce">
                  <path
                    d="M206 90 L226 130 L256 80 L286 130 L306 90 L300 145 L212 145 Z"
                    fill="url(#goldGleam)"
                    stroke="#b45309"
                    strokeWidth="2"
                    filter="url(#eyeGlow)"
                  />
                  {/* Ruby & Emerald jewels on crown */}
                  <circle cx="256" cy="115" r="5" fill="#dc2626" />
                  <circle cx="230" cy="125" r="3.5" fill="#059669" />
                  <circle cx="282" cy="125" r="3.5" fill="#2563eb" />
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Scene 6: Majestic Royal King Typography */}
        {showKingTypography && (
          <div className="mt-4 flex flex-col items-center animate-in zoom-in-75 fade-in duration-500 z-40">
            {/* Crown Accent */}
            <div className="flex items-center gap-1.5 text-amber-400 mb-1 animate-pulse">
              <Sparkles className="h-4 w-4" />
              <Crown className="h-6 w-6 fill-amber-400" />
              <Sparkles className="h-4 w-4" />
            </div>

            {/* Embossed Gold Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-500 drop-shadow-[0_4px_16px_rgba(245,158,11,0.9)]">
              KING LION
            </h1>

            {/* Subtitle & Lonkind Royal Badge */}
            <div className="mt-2 flex items-center gap-2 bg-slate-950/90 backdrop-blur-md border border-amber-500/50 px-4 py-1.5 rounded-full shadow-2xl">
              <Avatar className="h-6 w-6 border border-amber-400">
                <AvatarImage src={senderAvatar} alt={senderName} />
                <AvatarFallback className="bg-amber-600 text-white text-[9px] font-bold">
                  {senderName.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <span className="text-xs font-black text-amber-300">
                @{senderName}
              </span>

              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                • LONKIND ROYAL GIFT
              </span>

              {combo > 1 && (
                <span className="bg-gradient-to-r from-amber-500 to-red-600 text-black font-black text-[10px] px-2 py-0.5 rounded-full">
                  x{combo}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
