'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Lottie as LottieReact } from 'lottie-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Volume2, VolumeX, X, Gauge, Sparkles, Flame, Anchor, Crown } from 'lucide-react';
import {
  attachCloudflareStreamPlayer,
  resolveCloudflareStreamInput,
} from '@/lib/cloudflare-stream-gifts';

const LottieAny = LottieReact as any;

function Lottie({ animationData, loop = true, autoplay = true, className = '' }: any) {
  return (
    <div className={className}>
      <LottieAny
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export type TakeoverGiftType =
  | 'neon_supercar'
  | 'car'
  | 'luxury_yacht'
  | 'yacht'
  | 'majestic_lion'
  | 'lion'
  | 'dragon'
  | 'rocket'
  | 'crown'
  | 'diamond'
  | 'custom_webm_lottie';

export interface GiftTakeoverEvent {
  id?: string;
  giftId: TakeoverGiftType | string;
  giftName: string;
  senderName: string;
  senderAvatar?: string;
  combo: number;
  price: number;
  webmUrl?: string;
  videoUrl?: string;
  lottieUrl?: string;
  lottieData?: Record<string, unknown>;
}

interface GiftTakeoverEngineProps {
  event: GiftTakeoverEvent;
  onComplete: () => void;
}

/**
 * Real-time GPU WebGL Fragment Shader Video Player.
 * Supports native .webm (VP9 alpha channel), Cloudflare Stream (.m3u8 HLS / .mpd DASH),
 * AND strips dark/black backgrounds from .mp4/.webm streams at the pixel-shader level
 * so ZERO rectangular box or dark background ever appears over the live stream.
 */
export function TransparentWebGLVideo({
  src,
  webmSrc,
  className = '',
  threshold = 0.08,
  softness = 0.18,
  boost = 1.28,
}: {
  src?: string;
  webmSrc?: string;
  className?: string;
  threshold?: number;
  softness?: number;
  boost?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const activeSrc = webmSrc || src;
    if (!activeSrc) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;

    const isCloudflareOrStream =
      activeSrc.includes('.m3u8') ||
      activeSrc.includes('.mpd') ||
      activeSrc.includes('cloudflarestream.com') ||
      /^[a-f0-9]{32}$/i.test(activeSrc.trim());

    let streamCleanup: { destroy: () => void } | null = null;

    if (isCloudflareOrStream) {
      const resolved = resolveCloudflareStreamInput(activeSrc);
      streamCleanup = attachCloudflareStreamPlayer({
        video,
        hlsManifestUrl: resolved.hlsManifestUrl,
        dashManifestUrl: resolved.dashManifestUrl,
      });
    } else {
      if (webmSrc) {
        const sourceWebm = document.createElement('source');
        sourceWebm.src = webmSrc;
        sourceWebm.type = 'video/webm';
        video.appendChild(sourceWebm);
      }
      if (src) {
        const sourceMp4 = document.createElement('source');
        sourceMp4.src = src;
        sourceMp4.type = src.endsWith('.webm') ? 'video/webm' : 'video/mp4';
        video.appendChild(sourceMp4);
      }
      video.play().catch(() => {});
    }

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });

    if (!gl) return;

    const vsSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = aPosition * 0.5 + 0.5;
        vUv.y = 1.0 - vUv.y;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float uThreshold;
      uniform float uSoftness;
      uniform float uBoost;

      void main() {
        vec4 texColor = texture2D(uTexture, vUv);
        float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
        float maxChannel = max(texColor.r, max(texColor.g, texColor.b));
        float signal = max(luma, maxChannel * 0.92);

        // Smooth radial vignette mask so frame edges are 100% transparent
        vec2 centered = (vUv - vec2(0.5)) * vec2(1.0, 1.05);
        float dist = length(centered);
        float radialMask = smoothstep(0.49, 0.22, dist);

        // Key out dark background pixels smoothly while preserving native .webm alpha
        float keyedAlpha = smoothstep(uThreshold, uThreshold + uSoftness, signal);
        float finalAlpha = texColor.a * keyedAlpha * radialMask;

        vec3 hdrRgb = min(vec3(1.0), texColor.rgb * uBoost);
        gl_FragColor = vec4(hdrRgb, finalAlpha);
      }
    `;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const uThresholdLoc = gl.getUniformLocation(program, 'uThreshold');
    const uSoftnessLoc = gl.getUniformLocation(program, 'uSoftness');
    const uBoostLoc = gl.getUniformLocation(program, 'uBoost');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let rafId = 0;
    const renderLoop = () => {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = Math.max(1, canvas.clientWidth);
        canvas.height = Math.max(1, canvas.clientHeight);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (video.readyState >= 2) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.uniform1f(uThresholdLoc, threshold);
        gl.uniform1f(uSoftnessLoc, softness);
        gl.uniform1f(uBoostLoc, boost);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(rafId);
      streamCleanup?.destroy();
      video.pause();
      video.src = '';
    };
  }, [src, webmSrc, threshold, softness, boost]);

  return <canvas ref={canvasRef} className={`pointer-events-none ${className}`} />;
}

export default function GiftTakeoverEngine({ event, onComplete }: GiftTakeoverEngineProps) {
  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [speedMph, setSpeedMph] = useState(0);
  const [rpm, setRpm] = useState(1200);
  const [customLottieJson, setCustomLottieJson] = useState<Record<string, unknown> | null>(
    event.lottieData || null
  );
  const audioCtxRef = useRef<AudioContext | null>(null);

  const normalizedType: TakeoverGiftType =
    event.giftId === 'car' || event.giftId === 'neon_supercar'
      ? 'neon_supercar'
      : event.giftId === 'yacht' || event.giftId === 'luxury_yacht'
      ? 'luxury_yacht'
      : event.giftId === 'lion' || event.giftId === 'majestic_lion'
      ? 'majestic_lion'
      : (event.giftId as TakeoverGiftType);

  const totalDurationMs =
    normalizedType === 'neon_supercar'
      ? 6500
      : normalizedType === 'luxury_yacht'
      ? 6500
      : normalizedType === 'majestic_lion'
      ? 6500
      : event.giftId === 'diamond' || event.giftId === 'crown'
      ? 5000
      : 3200;

  // Fetch external Lottie JSON if lottieUrl was passed in real-time event
  useEffect(() => {
    if (event.lottieUrl) {
      fetch(event.lottieUrl)
        .then((r) => r.json())
        .then((data) => setCustomLottieJson(data))
        .catch(() => {});
    }
  }, [event.lottieUrl]);

  // Auto-complete timer
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, totalDurationMs);
    return () => clearTimeout(timer);
  }, [onComplete, totalDurationMs]);

  // Real Recorded Acoustic Audio + Sub-Bass Cinema Synthesizer (Supercar V12 / Yacht Horn & Fireworks / Dragon Roar / Rocket Launch / Lion Roar)
  useEffect(() => {
    if (typeof window === 'undefined' || !soundEnabled) return;
    const activeClips: HTMLAudioElement[] = [];
    const timeouts: number[] = [];

    const scheduleRealClip = (src: string, delayMs: number, volume = 0.9) => {
      const tid = window.setTimeout(() => {
        try {
          const clip = new Audio(src);
          clip.volume = Math.min(1, Math.max(0, volume));
          clip.play().catch(() => {});
          activeClips.push(clip);
        } catch (_) {}
      }, delayMs);
      timeouts.push(tid);
    };

    if (normalizedType === 'neon_supercar') {
      scheduleRealClip('/gifts/audio/supercar-start.mp3', 0, 0.92);
      scheduleRealClip('/gifts/audio/supercar-pass.mp3', 2400, 0.95);
      scheduleRealClip('/gifts/audio/supercar-pass.mp3', 5100, 0.85);
    } else if (normalizedType === 'luxury_yacht') {
      scheduleRealClip('/gifts/audio/yacht-horn.mp3', 100, 0.9);
      scheduleRealClip('/gifts/audio/yacht-fireworks.mp3', 1400, 0.92);
    } else if (normalizedType === 'dragon') {
      scheduleRealClip('/gifts/audio/dragon-growl.mp3', 80, 0.92);
      scheduleRealClip('/gifts/audio/dragon-roar.mp3', 1100, 1.0);
    } else if (normalizedType === 'rocket') {
      scheduleRealClip('/gifts/audio/rocket-ignition.mp3', 0, 0.92);
      scheduleRealClip('/gifts/audio/rocket-launch.mp3', 1500, 0.96);
    } else if (normalizedType === 'majestic_lion') {
      scheduleRealClip('/gifts/audio/lion-growl.mp3', 120, 0.9);
      scheduleRealClip('/gifts/audio/lion-roar.mp3', 1600, 1.0);
      scheduleRealClip('/gifts/audio/lion-long-roar.mp3', 3800, 0.96);
    } else {
      scheduleRealClip('/gifts/audio/yacht-fireworks.mp3', 150, 0.85);
    }

    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) {
        return () => {
          timeouts.forEach((t) => clearTimeout(t));
          activeClips.forEach((c) => {
            c.pause();
            c.src = '';
          });
        };
      }
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.26;
      master.connect(ctx.destination);

      if (normalizedType === 'neon_supercar') {
        // V12 Twin-Turbo Sub-Bass Harmonic Layer + Gear Shifts
        const engineOsc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const engineGain = ctx.createGain();

        engineOsc.type = 'sawtooth';
        subOsc.type = 'triangle';

        const now = ctx.currentTime;
        engineOsc.frequency.setValueAtTime(65, now);
        engineOsc.frequency.exponentialRampToValueAtTime(240, now + 1.1);
        engineOsc.frequency.setValueAtTime(150, now + 1.15);
        engineOsc.frequency.exponentialRampToValueAtTime(340, now + 2.6);
        engineOsc.frequency.setValueAtTime(210, now + 2.65);
        engineOsc.frequency.exponentialRampToValueAtTime(480, now + 4.8);
        engineOsc.frequency.exponentialRampToValueAtTime(90, now + 7.8);

        subOsc.frequency.setValueAtTime(32, now);
        subOsc.frequency.exponentialRampToValueAtTime(160, now + 4.8);
        subOsc.frequency.exponentialRampToValueAtTime(45, now + 7.8);

        engineGain.gain.setValueAtTime(0.01, now);
        engineGain.gain.linearRampToValueAtTime(0.35, now + 0.4);
        engineGain.gain.setValueAtTime(0.32, now + 5.2);
        engineGain.gain.exponentialRampToValueAtTime(0.001, now + 8.0);

        engineOsc.connect(engineGain);
        subOsc.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start(now);
        subOsc.start(now);
        engineOsc.stop(now + 8.1);
        subOsc.stop(now + 8.1);
      } else if (normalizedType === 'luxury_yacht') {
        const now = ctx.currentTime;
        [65.41, 82.41, 98.0].forEach((freq) => {
          const horn = ctx.createOscillator();
          const hGain = ctx.createGain();
          horn.type = 'sawtooth';
          horn.frequency.setValueAtTime(freq, now + 0.2);
          hGain.gain.setValueAtTime(0.001, now + 0.2);
          hGain.gain.linearRampToValueAtTime(0.14, now + 0.6);
          hGain.gain.setValueAtTime(0.14, now + 2.4);
          hGain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);
          horn.connect(hGain);
          hGain.connect(master);
          horn.start(now + 0.2);
          horn.stop(now + 3.5);
        });
      } else {
        // Sub-Bass Chest Rumble to reinforce the real recorded roar/launch
        const now = ctx.currentTime;
        const roar = ctx.createOscillator();
        const rGain = ctx.createGain();
        roar.type = 'sawtooth';
        roar.frequency.setValueAtTime(95, now + 0.5);
        roar.frequency.exponentialRampToValueAtTime(32, now + 3.2);
        rGain.gain.setValueAtTime(0.001, now + 0.5);
        rGain.gain.linearRampToValueAtTime(0.38, now + 0.9);
        rGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
        roar.connect(rGain);
        rGain.connect(master);
        roar.start(now + 0.5);
        roar.stop(now + 3.6);
      }

      return () => {
        timeouts.forEach((t) => clearTimeout(t));
        activeClips.forEach((c) => {
          c.pause();
          c.src = '';
        });
        ctx.close().catch(() => {});
      };
    } catch (_) {
      return () => {
        timeouts.forEach((t) => clearTimeout(t));
        activeClips.forEach((c) => {
          c.pause();
          c.src = '';
        });
      };
    }
  }, [normalizedType, soundEnabled]);

  // 60 FPS Fullscreen Procedural 3D Stage Overlay (Neon Cyber Supercar Highway / Bioluminescent Yacht Ocean / Lion Solar Storm)
  useEffect(() => {
    const canvas = stageCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();

    // Fireworks particles for Luxury Yacht
    const fireworks: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      alpha: number;
      size: number;
    }> = [];

    const spawnFirework = (w: number, h: number) => {
      const fx = w * (0.2 + Math.random() * 0.6);
      const fy = h * (0.14 + Math.random() * 0.25);
      const palette = ['#fbbf24', '#38bdf8', '#f472b6', '#a855f7', '#ffffff', '#34d399'];
      const col = palette[Math.floor(Math.random() * palette.length)];
      for (let i = 0; i < 48; i++) {
        const angle = (Math.PI * 2 * i) / 48;
        const spd = 1.5 + Math.random() * 4.5;
        fireworks.push({
          x: fx,
          y: fy,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          color: col,
          alpha: 1,
          size: 1.8 + Math.random() * 2,
        });
      }
    };

    let lastFireworkTime = 0;

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const w = (canvas.width = window.innerWidth);
      const h = (canvas.height = window.innerHeight);
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // =======================================================================
      // 1. GLOWING NEON SUPERCAR FULLSCREEN TAKEOVER
      // =======================================================================
      if (normalizedType === 'neon_supercar') {
        // Update Speedometer & RPM HUD
        const targetSpeed = Math.min(248, Math.round(elapsed * 68));
        const targetRpm = Math.min(9400, Math.round(2200 + ((elapsed * 2600) % 7200)));
        setSpeedMph(targetSpeed);
        setRpm(targetRpm);

        const horizonY = h * 0.48;

        // Perspective Neon Cyber-Grid Highway on lower half of screen (transparent sky)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Horizon Neon Glow Bar
        const horizonGrad = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 80);
        horizonGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
        horizonGrad.addColorStop(0.4, 'rgba(236, 72, 153, 0.45)');
        horizonGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = horizonGrad;
        ctx.fillRect(0, horizonY - 30, w, 110);

        // Perspective Road Lanes radiating from vanishing point
        for (let i = -8; i <= 8; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * 18, horizonY);
          ctx.lineTo(cx + i * 220, h);
          ctx.strokeStyle =
            i === 0
              ? 'rgba(244, 114, 182, 0.7)'
              : Math.abs(i) === 2
              ? 'rgba(56, 189, 248, 0.85)'
              : 'rgba(99, 102, 241, 0.28)';
          ctx.lineWidth = Math.abs(i) <= 2 ? 2.5 : 1;
          ctx.stroke();
        }

        // High-Speed Horizontal Laser Grid Strips rushing toward viewer
        for (let z = 0; z < 16; z++) {
          const progress = ((z / 16) + elapsed * 1.8) % 1;
          const py = horizonY + Math.pow(progress, 2.4) * (h - horizonY);
          const alpha = progress * 0.65;
          ctx.beginPath();
          ctx.moveTo(0, py);
          ctx.lineTo(w, py);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
          ctx.lineWidth = 1 + progress * 2.5;
          ctx.stroke();
        }

        // Neon Speed Tunnel Light Streaks in Upper Sky
        for (let s = 0; s < 24; s++) {
          const angle = (s / 24) * Math.PI * 2;
          const dist = ((elapsed * 900 + s * 85) % (Math.max(w, h) * 0.75)) + 60;
          const sx = cx + Math.cos(angle) * dist;
          const sy = horizonY + Math.sin(angle) * dist * 0.55;
          const ex = cx + Math.cos(angle) * (dist + 95);
          const ey = horizonY + Math.sin(angle) * (dist + 95) * 0.55;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = s % 2 === 0 ? 'rgba(34, 211, 238, 0.75)' : 'rgba(232, 121, 249, 0.75)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // High-Precision Procedural 3D Neon Cyberpunk Supercar Silhouette + Volumetric Headlights
        const approach = Math.min(1, elapsed / 1.5);
        const driftAngle = elapsed > 1.5 && elapsed < 4.5 ? Math.sin((elapsed - 1.5) * 3.2) * 0.08 : 0;
        const carScale = 0.25 + approach * 0.85;
        const carX = cx + Math.sin(elapsed * 2.2) * (w * 0.06);
        const carY = horizonY + approach * (h * 0.22);

        ctx.save();
        ctx.translate(carX, carY);
        ctx.rotate(driftAngle);
        ctx.scale(carScale, carScale);

        // Neon Underglow Shadow Pool (Cyan + Magenta)
        const underGlow = ctx.createRadialGradient(0, 45, 10, 0, 45, 260);
        underGlow.addColorStop(0, 'rgba(34, 211, 238, 0.85)');
        underGlow.addColorStop(0.45, 'rgba(217, 70, 239, 0.55)');
        underGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = underGlow;
        ctx.beginPath();
        ctx.ellipse(0, 45, 250, 58, 0, 0, Math.PI * 2);
        ctx.fill();

        // Twin Nitro Plasma Exhaust Streams
        [-68, 68].forEach((exOffset) => {
          const flameLen = 65 + Math.sin(elapsed * 45) * 28;
          const flameGrad = ctx.createLinearGradient(exOffset, 30, exOffset, 30 + flameLen);
          flameGrad.addColorStop(0, '#ffffff');
          flameGrad.addColorStop(0.3, '#38bdf8');
          flameGrad.addColorStop(0.7, '#d946ef');
          flameGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.ellipse(exOffset, 35 + flameLen * 0.3, 16, flameLen * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        });

        // Aerodynamic Widebody Hypercar Chassis (Glowing Neon Wireframe + Metallic Hull)
        ctx.beginPath();
        ctx.moveTo(-185, 28);
        ctx.lineTo(-165, -18);
        ctx.lineTo(-95, -56);
        ctx.lineTo(95, -56);
        ctx.lineTo(165, -18);
        ctx.lineTo(185, 28);
        ctx.closePath();
        const bodyGrad = ctx.createLinearGradient(0, -60, 0, 35);
        bodyGrad.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
        bodyGrad.addColorStop(0.5, 'rgba(30, 41, 59, 0.95)');
        bodyGrad.addColorStop(1, 'rgba(6, 182, 212, 0.85)');
        ctx.fillStyle = bodyGrad;
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 25;
        ctx.fill();
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();

        // Cockpit Canopy Glass
        ctx.beginPath();
        ctx.moveTo(-82, -52);
        ctx.lineTo(-52, -88);
        ctx.lineTo(52, -88);
        ctx.lineTo(82, -52);
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.fill();
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 2;
        ctx.stroke();

        // GT Carbon-Neon Rear Wing
        ctx.beginPath();
        ctx.moveTo(-155, -24);
        ctx.lineTo(-175, -52);
        ctx.lineTo(175, -52);
        ctx.lineTo(155, -24);
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Sweeping Laser Headlight Cones
        [-125, 125].forEach((hx) => {
          // Headlight LED Eyes
          ctx.beginPath();
          ctx.ellipse(hx, 2, 24, 7, hx < 0 ? 0.2 : -0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 30;
          ctx.fill();

          // Volumetric Light Cone projecting forward toward viewer
          const coneGrad = ctx.createLinearGradient(hx, 8, hx * 2.2, 280);
          coneGrad.addColorStop(0, 'rgba(224, 242, 254, 0.65)');
          coneGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
          coneGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(hx - 18, 6);
          ctx.lineTo(hx + 18, 6);
          ctx.lineTo(hx * 2.6 + 90, 290);
          ctx.lineTo(hx * 2.6 - 90, 290);
          ctx.closePath();
          ctx.fill();
        });

        ctx.restore();
        ctx.restore();
      }

      // =======================================================================
      // 2. ROYAL LUXURY MEGA YACHT FULLSCREEN TAKEOVER
      // =======================================================================
      else if (normalizedType === 'luxury_yacht') {
        const waterLineY = h * 0.62;

        // Launch aerial fireworks every 0.85s
        if (elapsed - lastFireworkTime > 0.85) {
          lastFireworkTime = elapsed;
          spawnFirework(w, h);
          spawnFirework(w, h);
        }

        // Render Fireworks in Upper Sky (100% transparent sky over streamer camera)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = fireworks.length - 1; i >= 0; i--) {
          const fw = fireworks[i];
          fw.x += fw.vx;
          fw.y += fw.vy;
          fw.vy += 0.045; // gravity
          fw.alpha -= 0.014;
          if (fw.alpha <= 0) {
            fireworks.splice(i, 1);
          } else {
            ctx.beginPath();
            ctx.arc(fw.x, fw.y, fw.size, 0, Math.PI * 2);
            ctx.fillStyle = fw.color;
            ctx.globalAlpha = fw.alpha;
            ctx.shadowColor = fw.color;
            ctx.shadowBlur = 12;
            ctx.fill();
          }
        }
        ctx.restore();

        // Sweeping Helipad Searchlight Beams from Yacht into Night Sky
        const yachtProgress = Math.min(1, elapsed / 7.5);
        const yachtX = w * 0.82 - yachtProgress * (w * 0.64);
        const yachtBob = Math.sin(elapsed * 2.6) * 7;
        const yachtY = waterLineY - 12 + yachtBob;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        [-0.35, 0.28].forEach((beamOffset, idx) => {
          const angle = -Math.PI / 2 + Math.sin(elapsed * 1.8 + idx * 2) * 0.42 + beamOffset;
          const beamLen = h * 0.65;
          const bx = yachtX + Math.cos(angle) * beamLen;
          const by = yachtY + Math.sin(angle) * beamLen;
          const bGrad = ctx.createLinearGradient(yachtX, yachtY - 40, bx, by);
          bGrad.addColorStop(0, 'rgba(253, 224, 71, 0.48)');
          bGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.18)');
          bGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.moveTo(yachtX - 8, yachtY - 40);
          ctx.lineTo(yachtX + 8, yachtY - 40);
          ctx.lineTo(bx + 70, by);
          ctx.lineTo(bx - 70, by);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();

        // Back Ocean Wave Layer
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) {
          const wy = waterLineY + Math.sin(x * 0.012 + elapsed * 2.2) * 14;
          ctx.lineTo(x, wy);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        const oceanGrad = ctx.createLinearGradient(0, waterLineY, 0, h);
        oceanGrad.addColorStop(0, 'rgba(14, 116, 144, 0.72)');
        oceanGrad.addColorStop(0.4, 'rgba(15, 23, 42, 0.88)');
        oceanGrad.addColorStop(1, 'rgba(2, 6, 23, 0.96)');
        ctx.fillStyle = oceanGrad;
        ctx.fill();
        ctx.restore();

        // Render Illuminated 3D Royal Mega-Yacht
        ctx.save();
        ctx.translate(yachtX, yachtY);
        const yachtScale = Math.min(1.15, Math.max(0.72, w / 900));
        ctx.scale(yachtScale, yachtScale);

        // Underwater Bioluminescent Turquoise & Gold Hull Reflection
        const hullGlow = ctx.createRadialGradient(0, 28, 10, 0, 28, 280);
        hullGlow.addColorStop(0, 'rgba(34, 211, 238, 0.75)');
        hullGlow.addColorStop(0.45, 'rgba(250, 204, 21, 0.45)');
        hullGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = hullGlow;
        ctx.beginPath();
        ctx.ellipse(0, 28, 270, 48, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mega-Yacht Lower Hull (Sleek Pearl White & Metallic Gold Trim)
        ctx.beginPath();
        ctx.moveTo(-240, -18); // Sharp Bow
        ctx.lineTo(210, -18); // Stern
        ctx.lineTo(185, 24); // Waterline Stern
        ctx.lineTo(-195, 24); // Waterline Bow
        ctx.closePath();
        const hullGrad = ctx.createLinearGradient(-240, -18, 210, 24);
        hullGrad.addColorStop(0, '#f8fafc');
        hullGrad.addColorStop(0.5, '#e2e8f0');
        hullGrad.addColorStop(1, '#94a3b8');
        ctx.fillStyle = hullGrad;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 22;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#fbbf24';
        ctx.stroke();

        // Golden Underwater Porthole LEDs along Hull
        for (let px = -150; px <= 150; px += 25) {
          ctx.beginPath();
          ctx.arc(px, 4, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = '#fef08a';
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 10;
          ctx.fill();
        }

        // Deck 1: Main Royal Promenade Deck
        ctx.beginPath();
        ctx.moveTo(-165, -18);
        ctx.lineTo(-130, -52);
        ctx.lineTo(185, -52);
        ctx.lineTo(198, -18);
        ctx.closePath();
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Deck 2: VIP Sky Lounge Deck
        ctx.beginPath();
        ctx.moveTo(-95, -52);
        ctx.lineTo(-65, -82);
        ctx.lineTo(145, -82);
        ctx.lineTo(165, -52);
        ctx.closePath();
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Deck 3: Captain's Bridge & Satellite Radar Tower
        ctx.beginPath();
        ctx.moveTo(-25, -82);
        ctx.lineTo(-5, -108);
        ctx.lineTo(85, -108);
        ctx.lineTo(105, -82);
        ctx.closePath();
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();

        // Radar Mast & Dome
        ctx.beginPath();
        ctx.arc(38, -124, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Glowing Golden Panoramic Windows across Decks
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 15;
        ctx.fillRect(-115, -42, 270, 8);
        ctx.fillRect(-50, -72, 175, 7);

        ctx.restore();

        // Foreground Bioluminescent Ocean Wave Crest overlapping Yacht waterline
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 16) {
          const wy = waterLineY + 14 + Math.sin(x * 0.016 - elapsed * 3.1) * 12;
          ctx.lineTo(x, wy);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        const frontWaveGrad = ctx.createLinearGradient(0, waterLineY, 0, h);
        frontWaveGrad.addColorStop(0, 'rgba(34, 211, 238, 0.42)');
        frontWaveGrad.addColorStop(0.3, 'rgba(3, 105, 161, 0.65)');
        frontWaveGrad.addColorStop(1, 'rgba(2, 6, 23, 0.92)');
        ctx.fillStyle = frontWaveGrad;
        ctx.fill();

        // Glowing Bioluminescent Wave Crest Line
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const wy = waterLineY + 14 + Math.sin(x * 0.016 - elapsed * 3.1) * 12;
          if (x === 0) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.restore();
      }

      // =======================================================================
      // 3. MAJESTIC LION / DRAGON / ROCKET / CROWN / DIAMOND SOLAR SHOCKWAVES
      // =======================================================================
      else {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let r = 0; r < 3; r++) {
          const ringProgress = ((elapsed * 0.65 + r * 0.33) % 1);
          const radius = ringProgress * Math.max(w, h) * 0.65;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(251, 191, 36, ${(1 - ringProgress) * 0.55})`;
          ctx.lineWidth = (1 - ringProgress) * 8 + 1;
          ctx.stroke();
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [normalizedType]);

  // Select active Lottie animation JSON if provided
  const activeLottieData = customLottieJson || event.lottieData || null;

  // Only load a video if a valid videoUrl (like a Cloudflare URL) is provided
  const activeVideoSrc = event.webmUrl || event.videoUrl || '';

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden select-none flex flex-col justify-between">
      {/* LAYER 1: Real-Time WebGL GPU Alpha-Keyed Transparent Video Layer (Only when activeVideoSrc is present) */}
      {activeVideoSrc && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <TransparentWebGLVideo
            src={activeVideoSrc}
            webmSrc={event.webmUrl}
            className="w-full h-full scale-105 opacity-95 transition-transform duration-700"
            threshold={0.09}
            softness={0.2}
            boost={1.32}
          />
        </div>
      )}

      {/* LAYER 2: 60 FPS Fullscreen Procedural 3D Stage Canvas */}
      <canvas ref={stageCanvasRef} className="absolute inset-0 z-20 w-full h-full pointer-events-none" />

      {/* LAYER 3: 60 FPS Vector/Mesh Lottie JSON Animation Overlay */}
      {activeLottieData && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <Lottie
            animationData={activeLottieData}
            loop={true}
            autoplay={true}
            className="w-full h-full max-w-2xl max-h-[70vh] object-contain opacity-90"
          />
        </div>
      )}

      {/* TOP BAR: Clean Gift Banner + Audio/Dismiss Controls */}
      <div className="relative z-40 w-full max-w-5xl mx-auto pt-16 px-4 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3 bg-slate-950/85 backdrop-blur-xl border border-amber-400/50 rounded-full pl-2 pr-5 py-1.5 shadow-[0_0_30px_rgba(245,158,11,0.4)] animate-in slide-in-from-left duration-300">
          <Avatar className="h-9 w-9 border-2 border-amber-400 shadow-lg">
            <AvatarImage src={event.senderAvatar} alt={event.senderName} />
            <AvatarFallback className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-xs">
              {event.senderName ? event.senderName.charAt(0) : 'V'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-black text-white">@{event.senderName}</span>
            <span className="text-[11px] font-bold text-amber-300">
              Sent <strong className="text-white">{event.giftName}</strong>
            </span>
          </div>
          {event.combo > 1 && (
            <div className="ml-2 bg-gradient-to-r from-rose-500 via-amber-500 to-yellow-400 text-black font-black text-sm px-3 py-0.5 rounded-full shadow-lg animate-bounce">
              x{event.combo}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-2 rounded-full bg-slate-950/80 border border-white/20 text-white hover:bg-white/15 backdrop-blur-md transition-all"
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-amber-300" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="p-2 rounded-full bg-slate-950/80 border border-white/20 text-slate-300 hover:text-white hover:bg-rose-500/20 backdrop-blur-md transition-all"
            title="Close Gift Overlay"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
