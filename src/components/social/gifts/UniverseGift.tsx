'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sparkles } from 'lucide-react';

interface UniverseGiftProps {
  senderName: string;
  senderAvatar?: string;
  combo?: number;
  videoUrl?: string;
  onComplete: () => void;
}

interface Star3D {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  color: string;
  size: number;
  speed: number;
}

interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  growth: number;
}

interface AccretionParticle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  color: string;
}

interface ShockwaveRing {
  radius: number;
  maxRadius: number;
  opacity: number;
  width: number;
  color: string;
}

interface CometParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  color: string;
}

export default function UniverseGift({
  senderName,
  senderAvatar,
  combo = 1,
  videoUrl,
  onComplete,
}: UniverseGiftProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scenes: 1 to 11
  // 1: Total Darkness -> 2: First Light -> 3: Big Bang -> 4: Galaxies Form -> 5: Flight Through Space
  // 6: Black Hole -> 7: Infall -> 8: Cosmic Explosion -> 9: Panorama -> 10: Lonkind Badge -> 11: Collapse
  const [scene, setScene] = useState<number>(1);
  const [screenShake, setScreenShake] = useState<boolean>(false);
  const [screenFlash, setScreenFlash] = useState<boolean>(false);
  const [showTypography, setShowTypography] = useState<boolean>(false);
  const [showLonkindSignature, setShowLonkindSignature] = useState<boolean>(false);

  // 1. HIGH-END PROCEDURAL WEB AUDIO ENGINE (ZERO EXTERNAL ASSET DEPENDENCY)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Master Gain for graceful fadeout / sudden cut
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.setValueAtTime(1.0, ctx.currentTime);

      // Sound 1: Deep Cosmic Sub-Bass Rumble (t = 0.0s, Scene 1)
      const rumbleOsc = ctx.createOscillator();
      const rumbleGain = ctx.createGain();
      rumbleOsc.type = 'sine';
      rumbleOsc.frequency.setValueAtTime(36, ctx.currentTime);
      rumbleOsc.frequency.exponentialRampToValueAtTime(54, ctx.currentTime + 1.2);
      rumbleGain.gain.setValueAtTime(0.01, ctx.currentTime);
      rumbleGain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 1.0);
      rumbleOsc.connect(rumbleGain);
      rumbleGain.connect(masterGain);
      rumbleOsc.start();
      rumbleOsc.stop(ctx.currentTime + 1.5);

      // Sound 2: Rising Heartbeat Energy Pulses (t = 1.2s - 2.4s, Scene 2)
      [1.2, 1.6, 2.0].forEach((startTime, idx) => {
        setTimeout(() => {
          try {
            const pulseOsc = ctx.createOscillator();
            const pulseGain = ctx.createGain();
            pulseOsc.type = 'sawtooth';
            pulseOsc.frequency.setValueAtTime(60 + idx * 45, ctx.currentTime);
            pulseOsc.frequency.exponentialRampToValueAtTime(220 + idx * 60, ctx.currentTime + 0.35);
            pulseGain.gain.setValueAtTime(0.01, ctx.currentTime);
            pulseGain.gain.linearRampToValueAtTime(0.3 + idx * 0.15, ctx.currentTime + 0.15);
            pulseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
            pulseOsc.connect(pulseGain);
            pulseGain.connect(masterGain);
            pulseOsc.start();
            pulseOsc.stop(ctx.currentTime + 0.4);
          } catch (_) {}
        }, (startTime - 0.2) * 1000);
      });

      // Sound 3: Big Bang Detonation & Expanding Stellar Winds (t = 2.4s, Scene 3)
      setTimeout(() => {
        try {
          const bangOsc = ctx.createOscillator();
          const bangGain = ctx.createGain();
          bangOsc.type = 'sine';
          bangOsc.frequency.setValueAtTime(180, ctx.currentTime);
          bangOsc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 1.2);
          bangGain.gain.setValueAtTime(0.9, ctx.currentTime);
          bangGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.4);
          bangOsc.connect(bangGain);
          bangGain.connect(masterGain);
          bangOsc.start();
          bangOsc.stop(ctx.currentTime + 1.5);

          // Stellar Chimes Shower
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const chimeOsc = ctx.createOscillator();
            const chimeGain = ctx.createGain();
            chimeOsc.type = 'triangle';
            chimeOsc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
            chimeGain.gain.setValueAtTime(0.01, ctx.currentTime + idx * 0.12);
            chimeGain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.12 + 0.05);
            chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 1.2);
            chimeOsc.connect(chimeGain);
            chimeGain.connect(masterGain);
            chimeOsc.start(ctx.currentTime + idx * 0.12);
            chimeOsc.stop(ctx.currentTime + idx * 0.12 + 1.3);
          });
        } catch (_) {}
      }, 2400);

      // Sound 4: Hyperspace Slipstream Whoosh (t = 6.0s, Scene 5)
      setTimeout(() => {
        try {
          const whooshOsc = ctx.createOscillator();
          const whooshGain = ctx.createGain();
          whooshOsc.type = 'sine';
          whooshOsc.frequency.setValueAtTime(80, ctx.currentTime);
          whooshOsc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 1.4);
          whooshGain.gain.setValueAtTime(0.05, ctx.currentTime);
          whooshGain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 0.8);
          whooshGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.6);
          whooshOsc.connect(whooshGain);
          whooshGain.connect(masterGain);
          whooshOsc.start();
          whooshOsc.stop(ctx.currentTime + 1.7);
        } catch (_) {}
      }, 6000);

      // Sound 5: Black Hole Infall Vortex & Gravitational Resonance (t = 8.0s - 9.8s, Scene 6 & 7)
      setTimeout(() => {
        try {
          const bhOsc = ctx.createOscillator();
          const bhGain = ctx.createGain();
          bhOsc.type = 'sawtooth';
          bhOsc.frequency.setValueAtTime(45, ctx.currentTime);
          bhOsc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 2.4);
          bhGain.gain.setValueAtTime(0.01, ctx.currentTime);
          bhGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 2.0);
          bhGain.gain.exponentialRampToValueAtTime(0.85, ctx.currentTime + 2.4);
          bhOsc.connect(bhGain);
          bhGain.connect(masterGain);
          bhOsc.start();
          bhOsc.stop(ctx.currentTime + 2.5);
        } catch (_) {}
      }, 8000);

      // Sound 6: SUDDEN COMPLETE DEAD SILENCE AT t = 10.7s (Tense Pre-Explosion Void)
      setTimeout(() => {
        try {
          masterGain.gain.setValueAtTime(0.0, ctx.currentTime);
          setTimeout(() => {
            masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
          }, 300);
        } catch (_) {}
      }, 10700);

      // Sound 7: MASSIVE COSMIC EXPLOSION / REBIRTH (t = 11.0s, Scene 8)
      setTimeout(() => {
        try {
          // Thunderous Sub-Bass Drop
          const boomOsc = ctx.createOscillator();
          const boomGain = ctx.createGain();
          boomOsc.type = 'sawtooth';
          boomOsc.frequency.setValueAtTime(220, ctx.currentTime);
          boomOsc.frequency.exponentialRampToValueAtTime(22, ctx.currentTime + 1.6);
          boomGain.gain.setValueAtTime(1.0, ctx.currentTime);
          boomGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.8);
          boomOsc.connect(boomGain);
          boomGain.connect(masterGain);
          boomOsc.start();
          boomOsc.stop(ctx.currentTime + 1.9);

          // Deep Resonant Shockwave Ring
          const shockOsc = ctx.createOscillator();
          const shockGain = ctx.createGain();
          shockOsc.type = 'sine';
          shockOsc.frequency.setValueAtTime(85, ctx.currentTime);
          shockOsc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 2.2);
          shockGain.gain.setValueAtTime(0.7, ctx.currentTime);
          shockGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.4);
          shockOsc.connect(shockGain);
          shockGain.connect(masterGain);
          shockOsc.start();
          shockOsc.stop(ctx.currentTime + 2.5);
        } catch (_) {}
      }, 11000);

      // Sound 8: Harmonious Celestial Symphony & Cosmic Shimmer (t = 12.8s, Scene 9 & 10)
      setTimeout(() => {
        try {
          const celestialHarmonics = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.5];
          celestialHarmonics.forEach((freq, i) => {
            const hOsc = ctx.createOscillator();
            const hGain = ctx.createGain();
            hOsc.type = 'sine';
            hOsc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
            hGain.gain.setValueAtTime(0.01, ctx.currentTime + i * 0.08);
            hGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.08 + 0.1);
            hGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 2.4);
            hOsc.connect(hGain);
            hGain.connect(masterGain);
            hOsc.start(ctx.currentTime + i * 0.08);
            hOsc.stop(ctx.currentTime + i * 0.08 + 2.5);
          });
        } catch (_) {}
      }, 12800);
    } catch (e) {
      console.warn('Universe procedural sound engine initialization:', e);
    }
  }, []);

  // 2. TIMELINE DIRECTOR (11-SCENE CHOREOGRAPHY WITH PRECISE TIMESTAMPS)
  useEffect(() => {
    // Scene 1 -> 2: First Light (1.2s)
    const t1 = setTimeout(() => setScene(2), 1200);

    // Scene 2 -> 3: The Big Bang Eruption (2.4s)
    const t2 = setTimeout(() => {
      setScene(3);
      setScreenFlash(true);
      setScreenShake(true);
      setTimeout(() => setScreenFlash(false), 240);
      setTimeout(() => setScreenShake(false), 900);
    }, 2400);

    // Scene 3 -> 4: Galaxies Form (4.2s)
    const t3 = setTimeout(() => setScene(4), 4200);

    // Scene 4 -> 5: Flight Through Space (6.0s)
    const t4 = setTimeout(() => setScene(5), 6000);

    // Scene 5 -> 6: Black Hole Reveals (8.0s)
    const t5 = setTimeout(() => setScene(6), 8000);

    // Scene 6 -> 7: Gravitational Pull & Void Cut (9.8s)
    const t6 = setTimeout(() => setScene(7), 9800);

    // Scene 7 -> 8: Cosmic Explosion (BOOM!) (11.0s)
    const t7 = setTimeout(() => {
      setScene(8);
      setScreenFlash(true);
      setScreenShake(true);
      setTimeout(() => setScreenFlash(false), 300);
      setTimeout(() => setScreenShake(false), 1200);
    }, 11000);

    // Scene 8 -> 9: Universe Panorama & Title (12.6s)
    const t8 = setTimeout(() => {
      setScene(9);
      setShowTypography(true);
    }, 12600);

    // Scene 9 -> 10: Lonkind Signature (14.2s)
    const t9 = setTimeout(() => {
      setScene(10);
      setShowLonkindSignature(true);
    }, 14200);

    // Scene 10 -> 11: Final Cosmic Collapse (15.8s)
    const t10 = setTimeout(() => {
      setScene(11);
      setShowTypography(false);
      setShowLonkindSignature(false);
    }, 15800);

    // Complete and return screen (17.4s)
    const t11 = setTimeout(() => {
      onComplete();
    }, 17400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(t7);
      clearTimeout(t8);
      clearTimeout(t9);
      clearTimeout(t10);
      clearTimeout(t11);
    };
  }, [onComplete]);

  // 3. FULL-SCREEN 60 FPS HTML5 CANVAS 3D COSMIC ENGINE
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

    // Adaptive particle scale for budget mobile phones vs high-end screens
    const isMobile = width < 640;
    const starCount = isMobile ? 260 : 520;
    const accretionParticleCount = isMobile ? 120 : 220;

    // A. 3D Warp Starfield
    const stars: Star3D[] = [];
    const starPalette = ['#ffffff', '#bae6fd', '#fde047', '#fed7aa', '#ddd6fe', '#67e8f9'];
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width * 3.5,
        y: (Math.random() - 0.5) * height * 3.5,
        z: Math.random() * 2000,
        prevZ: 2000,
        color: starPalette[Math.floor(Math.random() * starPalette.length)],
        size: Math.random() * 2.2 + 0.8,
        speed: Math.random() * 8 + 4,
      });
    }

    // B. Nebula Clouds
    const nebulae: NebulaCloud[] = [
      { x: width * 0.25, y: height * 0.35, radius: 140, color: 'rgba(99, 102, 241, 0.28)', opacity: 0, growth: 0.4 },
      { x: width * 0.75, y: height * 0.45, radius: 180, color: 'rgba(168, 85, 247, 0.25)', opacity: 0, growth: 0.3 },
      { x: width * 0.45, y: height * 0.65, radius: 160, color: 'rgba(236, 72, 153, 0.22)', opacity: 0, growth: 0.35 },
      { x: width * 0.5, y: height * 0.2, radius: 150, color: 'rgba(6, 182, 212, 0.24)', opacity: 0, growth: 0.25 },
      { x: width * 0.8, y: height * 0.8, radius: 170, color: 'rgba(245, 158, 11, 0.2)', opacity: 0, growth: 0.3 },
    ];

    // C. Accretion Disk Particles for Black Hole (Scene 6 & 7)
    const accretionDisk: AccretionParticle[] = [];
    const accretionPalette = ['#f59e0b', '#ef4444', '#fbbf24', '#ffffff', '#f97316', '#7c3aed'];
    for (let i = 0; i < accretionParticleCount; i++) {
      accretionDisk.push({
        angle: Math.random() * Math.PI * 2,
        radius: Math.random() * 110 + 45,
        speed: (Math.random() * 0.05 + 0.035) * (Math.random() > 0.5 ? 1 : 1),
        size: Math.random() * 2.5 + 1.2,
        color: accretionPalette[Math.floor(Math.random() * accretionPalette.length)],
      });
    }

    // D. Comets with Ion Tails
    const comets: CometParticle[] = [
      { x: width * 0.1, y: height * 0.2, vx: 5.5, vy: 3.2, length: 75, color: '#38bdf8' },
      { x: width * 0.85, y: height * 0.15, vx: -6.0, vy: 4.5, length: 90, color: '#fbbf24' },
      { x: width * 0.05, y: height * 0.65, vx: 7.2, vy: -2.8, length: 80, color: '#ec4899' },
    ];

    // E. Dynamic Shockwaves
    const shockwaves: ShockwaveRing[] = [];
    const triggerShockwave = (color: string, maxR: number, strokeW = 4) => {
      shockwaves.push({
        radius: 10,
        maxRadius: maxR,
        opacity: 1.0,
        width: strokeW,
        color,
      });
    };

    let startTime = performance.now();
    let hasTriggeredExplosionShock = false;
    let hasTriggeredBigBangShock = false;

    // Render Loop
    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const cx = width / 2;
      const cy = height / 2;

      // Clear Canvas with dynamic trail persistence
      ctx.fillStyle = scene === 7 && elapsed > 10.7 ? '#000000' : 'rgba(5, 5, 12, 0.35)';
      ctx.fillRect(0, 0, width, height);

      // SCENE 1: Total Darkness (0.0s - 1.2s)
      if (scene === 1) {
        ctx.fillStyle = '#020206';
        ctx.fillRect(0, 0, width, height);

        // A few sparse subtle stars slowly emerge
        const starRevealCount = Math.floor(stars.length * Math.min(1, elapsed / 1.2) * 0.15);
        for (let i = 0; i < starRevealCount; i++) {
          const s = stars[i];
          const alpha = (Math.sin(elapsed * 4 + i) * 0.3 + 0.6) * (elapsed / 1.2);
          ctx.beginPath();
          ctx.arc(cx + (s.x % (width * 0.4)), cy + (s.y % (height * 0.4)), s.size * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
          ctx.fill();
        }
      }

      // SCENE 2: The First Light / Singularity (1.2s - 2.4s)
      else if (scene === 2) {
        const pulse = Math.sin((elapsed - 1.2) * 14) * 0.5 + 0.5;
        const radius = 6 + pulse * 18;

        // Space gravitational warping glow
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 8);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        glow.addColorStop(0.25, 'rgba(250, 204, 21, 0.7)');
        glow.addColorStop(0.5, 'rgba(99, 102, 241, 0.35)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(cx, cy, radius * 8, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Infalling light filament trails
        for (let i = 0; i < 28; i++) {
          const angle = i * ((Math.PI * 2) / 28) + elapsed * 3;
          const dist = 120 * (1 - ((elapsed - 1.2) % 0.4) / 0.4);
          const px = cx + Math.cos(angle) * dist;
          const py = cy + Math.sin(angle) * dist;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(254, 240, 138, 0.8)';
          ctx.fill();
        }

        // Intense core dot
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 25;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // SCENE 3 TO 5: Big Bang, Galaxies Form & Hyperspace Flight (2.4s - 8.0s)
      else if (scene >= 3 && scene <= 5) {
        if (scene === 3 && !hasTriggeredBigBangShock) {
          hasTriggeredBigBangShock = true;
          triggerShockwave('#f59e0b', Math.max(width, height) * 0.9, 6);
          triggerShockwave('#60a5fa', Math.max(width, height) * 1.2, 3);
        }

        // 1. Render Expansive Nebulae Clouds
        nebulae.forEach((neb) => {
          neb.radius += neb.growth;
          const grad = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.radius);
          grad.addColorStop(0, neb.color);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.beginPath();
          ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        });

        // 2. 3D Stars Traveling Toward Camera
        const speedMultiplier = scene === 5 ? 38 : scene === 4 ? 20 : 12;
        stars.forEach((s) => {
          s.prevZ = s.z;
          s.z -= s.speed * (speedMultiplier / 10);

          if (s.z <= 1) {
            s.z = 2000;
            s.prevZ = 2000;
            s.x = (Math.random() - 0.5) * width * 3.5;
            s.y = (Math.random() - 0.5) * height * 3.5;
          }

          const k = 450 / s.z;
          const px = s.x * k + cx;
          const py = s.y * k + cy;

          const prevK = 450 / s.prevZ;
          const prevPx = s.x * prevK + cx;
          const prevPy = s.y * prevK + cy;

          if (px >= 0 && px <= width && py >= 0 && py <= height) {
            const rad = Math.max(0.6, (1 - s.z / 2000) * s.size * 2.2);

            // Warp Star Streaks in Scene 5
            if (scene === 5) {
              ctx.beginPath();
              ctx.moveTo(prevPx, prevPy);
              ctx.lineTo(px, py);
              ctx.strokeStyle = s.color;
              ctx.lineWidth = rad * 1.5;
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.arc(px, py, rad, 0, Math.PI * 2);
              ctx.fillStyle = s.color;
              ctx.fill();
            }
          }
        });

        // 3. Render Distant Spiral Galaxies (Scene 4)
        if (scene === 4 || scene === 5) {
          const renderSpiralGalaxy = (gx: number, gy: number, gRadius: number, gAngle: number, gColor: string) => {
            ctx.save();
            ctx.translate(gx, gy);
            ctx.rotate(gAngle);

            for (let arm = 0; arm < 2; arm++) {
              ctx.beginPath();
              for (let a = 0; a < Math.PI * 3; a += 0.15) {
                const r = (a / (Math.PI * 3)) * gRadius;
                const theta = a + arm * Math.PI;
                const x = Math.cos(theta) * r;
                const y = Math.sin(theta) * r * 0.45; // Elliptical 3D tilt
                if (a === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.strokeStyle = gColor;
              ctx.lineWidth = 2.5;
              ctx.shadowColor = gColor;
              ctx.shadowBlur = 12;
              ctx.stroke();
              ctx.shadowBlur = 0;
            }

            // Core galactic bulge
            const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, gRadius * 0.35);
            coreGrad.addColorStop(0, '#ffffff');
            coreGrad.addColorStop(0.4, '#fef08a');
            coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.arc(0, 0, gRadius * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = coreGrad;
            ctx.fill();
            ctx.restore();
          };

          renderSpiralGalaxy(width * 0.28, height * 0.38, 90, elapsed * 0.4, 'rgba(168, 85, 247, 0.7)');
          renderSpiralGalaxy(width * 0.74, height * 0.62, 75, -elapsed * 0.35, 'rgba(56, 189, 248, 0.75)');
        }

        // 4. Close Planetary Encounters (Scene 5 Flyby)
        if (scene === 5) {
          // Giant Ringed Gas Planet passing on left
          const planetX = width * 0.2 - (elapsed - 6.0) * 45;
          const planetY = height * 0.55 + (elapsed - 6.0) * 20;
          const planetRadius = 65;

          // Planet Body
          const pGrad = ctx.createRadialGradient(planetX - 15, planetY - 15, 10, planetX, planetY, planetRadius);
          pGrad.addColorStop(0, '#fde68a');
          pGrad.addColorStop(0.5, '#d97706');
          pGrad.addColorStop(1, '#451a03');
          ctx.beginPath();
          ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
          ctx.fillStyle = pGrad;
          ctx.fill();

          // Planet Rings with 3D tilt
          ctx.save();
          ctx.translate(planetX, planetY);
          ctx.rotate(-0.35);
          ctx.beginPath();
          ctx.ellipse(0, 0, planetRadius * 2.2, planetRadius * 0.45, 0, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
          ctx.lineWidth = 14;
          ctx.stroke();
          ctx.restore();

          // Comets streaking across
          comets.forEach((c) => {
            c.x += c.vx;
            c.y += c.vy;
            const grad = ctx.createLinearGradient(c.x, c.y, c.x - c.vx * 12, c.y - c.vy * 12);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.5, c.color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(c.x - c.vx * 12, c.y - c.vy * 12);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 3;
            ctx.stroke();
          });
        }
      }

      // SCENE 6 & 7: The Supermassive Black Hole & Gravitational Infall (8.0s - 11.0s)
      else if (scene === 6 || scene === 7) {
        if (scene === 7 && elapsed > 10.7) {
          // Absolute Darkness in the final 300ms of Scene 7
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
        } else {
          const bhRadius = scene === 7 ? 65 + (elapsed - 9.8) * 60 : 55;

          // 1. Gravitational Lensing Distortion Ring
          const lensGrad = ctx.createRadialGradient(cx, cy, bhRadius, cx, cy, bhRadius * 2.8);
          lensGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          lensGrad.addColorStop(0.2, 'rgba(245, 158, 11, 0.8)');
          lensGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)');
          lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.beginPath();
          ctx.arc(cx, cy, bhRadius * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = lensGrad;
          ctx.fill();

          // 2. Swirling Relativistic Accretion Disk Particles with Doppler Beaming
          accretionDisk.forEach((p) => {
            p.angle += p.speed * (scene === 7 ? 2.5 : 1.0);
            if (scene === 7) {
              p.radius = Math.max(bhRadius + 5, p.radius - 0.7);
            }

            const tilt = 0.38; // 3D disk inclination
            const px = cx + Math.cos(p.angle) * p.radius;
            const py = cy + Math.sin(p.angle) * (p.radius * tilt);

            // Relativistic beaming: Left side moving toward viewer is brighter
            const isApproaching = Math.sin(p.angle) > 0;
            const alpha = isApproaching ? 0.95 : 0.45;

            ctx.beginPath();
            ctx.arc(px, py, p.size * (isApproaching ? 1.4 : 0.9), 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
          });

          // 3. Supermassive Black Hole Event Horizon (Pure Absolute Black Sphere)
          ctx.beginPath();
          ctx.arc(cx, cy, bhRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#000000';
          ctx.fill();

          // 4. Einstein Photon Ring (Ultra-sharp thin golden/white boundary)
          ctx.beginPath();
          ctx.arc(cx, cy, bhRadius + 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
      }

      // SCENE 8: The Cosmic Supernova / Rebirth Explosion (11.0s - 12.6s)
      else if (scene === 8) {
        if (!hasTriggeredExplosionShock) {
          hasTriggeredExplosionShock = true;
          triggerShockwave('#ffffff', Math.max(width, height) * 1.4, 8);
          triggerShockwave('#f59e0b', Math.max(width, height) * 1.1, 5);
          triggerShockwave('#ec4899', Math.max(width, height) * 0.8, 4);
        }

        // Rapidly expanding starfield from central explosion point
        stars.forEach((s) => {
          const dx = s.x;
          const dy = s.y;
          const angle = Math.atan2(dy, dx);
          const blastDist = (elapsed - 11.0) * 1400;

          const px = cx + Math.cos(angle) * blastDist + dx * 0.1;
          const py = cy + Math.sin(angle) * blastDist + dy * 0.1;

          if (px >= 0 && px <= width && py >= 0 && py <= height) {
            ctx.beginPath();
            ctx.arc(px, py, s.size * 2.8, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        });

        // Blinding Central Supernova Core
        const blastRadius = (elapsed - 11.0) * 320;
        const blastGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, blastRadius);
        blastGrad.addColorStop(0, '#ffffff');
        blastGrad.addColorStop(0.3, '#fef08a');
        blastGrad.addColorStop(0.6, '#f97316');
        blastGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.arc(cx, cy, blastRadius, 0, Math.PI * 2);
        ctx.fillStyle = blastGrad;
        ctx.fill();
      }

      // SCENE 9 & 10: Infinite Universe Panorama & Lonkind Royal Badge (12.6s - 15.8s)
      else if (scene === 9 || scene === 10) {
        // Deep Stellar Field & Cosmic Atmosphere
        stars.forEach((s, idx) => {
          const px = (s.x % (width * 0.95)) + cx * 0.05;
          const py = (s.y % (height * 0.95)) + cy * 0.05;
          const twinkle = Math.sin(elapsed * 3 + idx) * 0.35 + 0.65;

          ctx.beginPath();
          ctx.arc(px, py, s.size * 0.95, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = twinkle;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });

        // 3 Majestic Floating Spiral Galaxies in Background
        const panoramaGalaxies = [
          { x: width * 0.22, y: height * 0.28, r: 85, angle: elapsed * 0.15, col: 'rgba(129, 140, 248, 0.6)' },
          { x: width * 0.78, y: height * 0.32, r: 100, angle: -elapsed * 0.18, col: 'rgba(244, 114, 182, 0.55)' },
          { x: width * 0.5, y: height * 0.76, r: 120, angle: elapsed * 0.12, col: 'rgba(251, 191, 36, 0.5)' },
        ];

        panoramaGalaxies.forEach((pg) => {
          ctx.save();
          ctx.translate(pg.x, pg.y);
          ctx.rotate(pg.angle);
          for (let arm = 0; arm < 2; arm++) {
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 2.8; a += 0.2) {
              const r = (a / (Math.PI * 2.8)) * pg.r;
              const theta = a + arm * Math.PI;
              const x = Math.cos(theta) * r;
              const y = Math.sin(theta) * r * 0.5;
              if (a === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = pg.col;
            ctx.lineWidth = 2.2;
            ctx.stroke();
          }
          ctx.restore();
        });
      }

      // SCENE 11: Final Cosmic Collapse to a Single Star (15.8s - 17.4s)
      else if (scene === 11) {
        const collapseProgress = Math.min(1, (elapsed - 15.8) / 1.3);
        const inv = 1 - collapseProgress;

        // All stars gravitationally pull toward center
        stars.forEach((s) => {
          const px = cx + (s.x * 0.4) * inv;
          const py = cy + (s.y * 0.4) * inv;
          ctx.beginPath();
          ctx.arc(px, py, s.size * inv, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = inv;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });

        // The Last Single Radiant Star
        const finalStarAlpha = Math.max(0, 1 - (elapsed - 16.5) / 0.8);
        if (finalStarAlpha > 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${finalStarAlpha.toFixed(2)})`;
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 18;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // 4. Render Expanding Shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.radius += 24;
        sw.opacity -= 0.022;

        if (sw.opacity <= 0 || sw.radius >= sw.maxRadius) {
          shockwaves.splice(i, 1);
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, sw.radius, 0, Math.PI * 2);
          ctx.strokeStyle = sw.color;
          ctx.globalAlpha = Math.max(0, sw.opacity);
          ctx.lineWidth = sw.width;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
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
      className={`fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${
        screenShake ? 'animate-shake' : ''
      }`}
    >
      {/* Cinematic Deep Space Vignette */}
      <div className="absolute inset-0 bg-radial-vignette opacity-90 pointer-events-none z-10" />

      {/* Screen Flash Overlay on Big Bang & Cosmic Explosion */}
      {screenFlash && (
        <div className="absolute inset-0 bg-white/80 pointer-events-none z-40 animate-in fade-in duration-75" />
      )}

      {/* Multi-Scene Real HD .MP4 Cosmic Video Cinema Engine (Nebula -> Wormhole -> Black Hole -> Supernova) */}
      <div className="absolute inset-0 z-15 pointer-events-none overflow-hidden">
        {/* Scene 3, 4, 9, 10: Real HD 3D Nebula Galaxy Traversal Video */}
        <video
          src={videoUrl || '/gifts/universe-nebula.mp4'}
          autoPlay
          loop
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            scene === 3 || scene === 4 || scene === 9 || scene === 10 ? 'opacity-90' : 'opacity-0'
          }`}
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Scene 5: Real HD 3D Wormhole Warp Flight Video */}
        <video
          src="/gifts/universe-wormhole.mp4"
          autoPlay
          loop
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            scene === 5 ? 'opacity-95 scale-110' : 'opacity-0'
          }`}
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Scene 6 & 7: Real HD 3D Rotating Black Hole Video */}
        <video
          src="/gifts/universe-blackhole.mp4"
          autoPlay
          loop
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
            scene === 6
              ? 'opacity-100 scale-105'
              : scene === 7
              ? 'opacity-100 scale-150'
              : 'opacity-0 scale-90'
          }`}
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Scene 8: Real HD 3D Supernova Cosmic Explosion Video */}
        <video
          src="/gifts/universe-supernova.mp4"
          autoPlay
          loop
          muted
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            scene === 8 ? 'opacity-100 scale-125' : 'opacity-0'
          }`}
          style={{ mixBlendMode: 'screen' }}
        />
      </div>

      {/* High-Performance 60 FPS HTML5 Cosmic Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-20 pointer-events-none" />

      {/* Scene 9 & 10: Cosmic Typography & Lonkind Royal Badge */}
      <div className="relative z-30 flex flex-col items-center justify-center px-4 max-w-lg mx-auto text-center">
        {showTypography && (
          <div className="flex flex-col items-center animate-in zoom-in-75 fade-in duration-700">
            {/* Celestial Sparkles */}
            <div className="flex items-center gap-2 text-cyan-300 mb-1.5 animate-pulse">
              <Sparkles className="h-4 w-4" />
              <span className="text-[11px] font-mono tracking-[0.3em] uppercase text-cyan-200">
                COSMIC SINGULARITY
              </span>
              <Sparkles className="h-4 w-4" />
            </div>

            {/* Glowing Futuristic UNIVERSE Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[0.25em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-indigo-300 via-purple-300 to-pink-300 drop-shadow-[0_0_35px_rgba(168,85,247,0.9)] animate-pulse">
              UNIVERSE
            </h1>

            {/* Starlight Subtitle */}
            <p className="mt-1 text-xs sm:text-sm font-semibold tracking-widest text-indigo-200 uppercase opacity-90">
              The Birth &amp; Expansion of All Creation
            </p>
          </div>
        )}

        {/* Scene 10: Lonkind Signature Brand & Gifter Recognition */}
        {showLonkindSignature && (
          <div className="mt-4 flex items-center gap-2.5 bg-slate-950/85 backdrop-blur-md border border-cyan-400/40 px-5 py-2 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-in slide-in-from-bottom-4 duration-500">
            <Avatar className="h-7 w-7 border-2 border-cyan-400">
              <AvatarImage src={senderAvatar} alt={senderName} />
              <AvatarFallback className="bg-indigo-600 text-white text-[10px] font-bold">
                {senderName.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col text-left">
              <span className="text-xs font-black text-cyan-200">
                @{senderName}
              </span>
              <span className="text-[9px] font-mono tracking-wider text-purple-300 uppercase font-semibold">
                LONKIND SUPREME COSMIC GIFT
              </span>
            </div>

            {combo > 1 && (
              <span className="ml-1 bg-gradient-to-r from-cyan-400 to-purple-600 text-white font-black text-[11px] px-2.5 py-0.5 rounded-full shadow-lg">
                x{combo}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
