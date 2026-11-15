'use client';

import React, { useEffect, useRef } from 'react';
import { CLOUDFLARE_LION_GIFT_STREAM } from '@/lib/cloudflare-stream-gifts';

interface SvgaLottieVectorCardProps {
  giftId: string;
  className?: string;
  size?: 'card' | 'stage';
}

export default function SvgaLottieVectorCard({
  giftId,
  className = '',
  size = 'card',
}: SvgaLottieVectorCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (giftId === 'lion') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const renderVectorRig = (now: number) => {
      const t = (now - start) / 1000;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth || (size === 'stage' ? 500 : 120);
      const h = canvas.clientHeight || (size === 'stage' ? 500 : 120);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.36;

      if (giftId === 'dragon') {
        ctx.save();
        ctx.translate(cx, cy);
        const aura = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.25);
        aura.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
        aura.addColorStop(0.6, 'rgba(220, 38, 38, 0.25)');
        aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (giftId === 'car') {
        // Cyberpunk Neon Supercar SVGA Vector Rig
        ctx.save();
        ctx.translate(cx, cy + Math.sin(t * 8) * 1.5);
        // Neon Underglow
        const glow = ctx.createLinearGradient(-r, r * 0.35, r, r * 0.35);
        glow.addColorStop(0, 'rgba(6, 182, 212, 0)');
        glow.addColorStop(0.5, 'rgba(236, 72, 153, 0.85)');
        glow.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(-r * 1.1, r * 0.22, r * 2.2, r * 0.18);

        // Aerodynamic Hypercar Silhouette
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.95, r * 0.22);
        ctx.lineTo(-r * 0.75, -r * 0.08);
        ctx.lineTo(-r * 0.2, -r * 0.32);
        ctx.lineTo(r * 0.45, -r * 0.28);
        ctx.lineTo(r * 0.95, r * 0.05);
        ctx.lineTo(r * 0.95, r * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Spinning Neon Rims
        [-r * 0.55, r * 0.55].forEach((wx) => {
          ctx.save();
          ctx.translate(wx, r * 0.22);
          ctx.rotate(t * 14);
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
          ctx.moveTo(-r * 0.2, 0);
          ctx.lineTo(r * 0.2, 0);
          ctx.moveTo(0, -r * 0.2);
          ctx.lineTo(0, r * 0.2);
          ctx.stroke();
          ctx.restore();
        });
        ctx.restore();
      } else if (giftId === 'yacht') {
        // Luxury Mega-Yacht SVGA Vector Rig
        ctx.save();
        ctx.translate(cx, cy + Math.sin(t * 2.5) * 3);
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, r * 0.25);
        ctx.lineTo(r * 0.65, r * 0.25);
        ctx.lineTo(r * 0.95, -r * 0.05);
        ctx.lineTo(-r * 0.75, -r * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Upper Decks
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-r * 0.45, -r * 0.28, r * 0.85, r * 0.22);
        ctx.restore();
      } else {
        // Orbital Rocket / Universe / Crown / Diamond / Cosmic SVGA Rings
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 1.4);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = 1.8;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.95, r * 0.38, (k * Math.PI) / 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderVectorRig);
    };

    rafId = requestAnimationFrame(renderVectorRig);
    return () => cancelAnimationFrame(rafId);
  }, [giftId, size]);

  if (giftId === 'lion') {
    return (
      <div className={`relative overflow-hidden select-none ${className}`}>
        <img
          src={CLOUDFLARE_LION_GIFT_STREAM.animatedGifUrl}
          alt={CLOUDFLARE_LION_GIFT_STREAM.giftName}
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== CLOUDFLARE_LION_GIFT_STREAM.thumbnailUrl) {
              target.src = CLOUDFLARE_LION_GIFT_STREAM.thumbnailUrl;
            }
          }}
          className="relative z-10 w-full h-full object-cover block pointer-events-none"
        />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden select-none ${className}`}>
      <canvas ref={canvasRef} className="relative z-10 w-full h-full block pointer-events-none" />
    </div>
  );
}
