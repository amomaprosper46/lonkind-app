'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Volume2, VolumeX, X } from 'lucide-react';
import {
  CLOUDFLARE_LION_GIFT_STREAM,
  attachCloudflareStreamPlayer,
  resolveCloudflareStreamInput,
} from '@/lib/cloudflare-stream-gifts';

export interface KingLionGiftProps {
  senderName: string;
  senderAvatar?: string;
  combo?: number;
  cloudflareVideoIdOrUrl?: string;
  onComplete: () => void;
}

/**
 * Fullscreen Lion Gift Stream Player (Cloudflare Stream ID: c648c4bd8e6a6273c7f1f7986f705c40)
 * - Streams adaptive HD video + roar audio via HLS (.m3u8) / DASH (.mpd).
 * - Uses pointer-events: none on the video layer so viewers can still interact with stream controls underneath.
 * - Triggers `screen-vibrate-effect` at 2.5s when the roar peaks.
 * - Smoothly fades opacity to 0 over 1.2s on `video.onended` and destroys the player instance cleanly.
 */
export default function KingLionGift({
  senderName,
  senderAvatar,
  combo = 1,
  cloudflareVideoIdOrUrl,
  onComplete,
}: KingLionGiftProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isVibrating, setIsVibrating] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [webglActive, setWebglActive] = useState(false);

  const resolvedUrls = resolveCloudflareStreamInput(cloudflareVideoIdOrUrl);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !soundEnabled;
    }
  }, [soundEnabled]);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!container || !video) return;

    let isCleanedUp = false;
    let fadeTimer: number | null = null;
    let safetyTimer: number | null = null;
    let rafId = 0;

    // 1. Native video element setup for HLS/DASH playback
    video.autoplay = true;
    video.muted = !soundEnabledRef.current;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    // 2. Real-time WebGL Chroma-Key (Green Screen + Black Screen removal) & Feathered Mask
    if (canvas) {
      const gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
      });

      if (gl) {
        const vsSource = `
          attribute vec2 aPosition;
          varying vec2 vUv;
          void main() {
            vUv = aPosition * 0.5 + 0.5;
            vUv.y = 1.0 - vUv.y;
            gl_Position = vec4(aPosition, 0.0, 1.0);
          }
        `;

        // Removes green screen, removes pitch-black backgrounds, and feathers outer edges
        // so the streamer's live camera stays visible around and above the Lion
        const fsSource = `
          precision mediump float;
          varying vec2 vUv;
          uniform sampler2D uTexture;

          void main() {
            vec4 texColor = texture2D(uTexture, vUv);
            float r = texColor.r;
            float g = texColor.g;
            float b = texColor.b;

            // 1. Green-screen chroma key (if user uploads a green-screen TikTok Lion clip)
            float greenDominance = g - max(r, b);
            float greenAlpha = 1.0 - smoothstep(0.12, 0.28, greenDominance);

            // 2. Black-screen luma key (if user uploads a black-background VFX clip)
            float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
            float maxCh = max(r, max(g, b));
            float blackAlpha = smoothstep(0.05, 0.22, max(luma, maxCh * 0.9));

            // 3. Soft oval vignette mask so rectangular edges & top sky fade into the live camera
            vec2 centered = (vUv - vec2(0.5, 0.54)) * vec2(1.12, 1.22);
            float dist = length(centered);
            float edgeFeather = 1.0 - smoothstep(0.32, 0.52, dist);

            // Fade out the very top sky band (vUv.y < 0.22) so the host's face is never blocked
            float topSkyFade = smoothstep(0.06, 0.28, vUv.y);

            float finalAlpha = greenAlpha * blackAlpha * edgeFeather * topSkyFade;
            gl_FragColor = vec4(texColor.rgb * 1.08, finalAlpha);
          }
        `;

        const compileShader = (type: number, src: string) => {
          const sh = gl.createShader(type);
          if (!sh) return null;
          gl.shaderSource(sh, src);
          gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            gl.deleteShader(sh);
            return null;
          }
          return sh;
        };

        const vs = compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
        const prog = gl.createProgram();

        if (vs && fs && prog) {
          gl.attachShader(prog, vs);
          gl.attachShader(prog, fs);
          gl.linkProgram(prog);

          if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            gl.useProgram(prog);
            setWebglActive(true);

            const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

            const aPos = gl.getAttribLocation(prog, 'aPosition');
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            const renderFrame = () => {
              if (isCleanedUp) return;
              if (video.readyState >= 2 && video.videoWidth > 0) {
                if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  gl.viewport(0, 0, canvas.width, canvas.height);
                }
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                try {
                  gl.bindTexture(gl.TEXTURE_2D, tex);
                  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                  gl.drawArrays(gl.TRIANGLES, 0, 6);
                } catch (_) {
                  // If CORS blocks texture read, fall back to CSS masked <video>
                  setWebglActive(false);
                  return;
                }
              }
              rafId = requestAnimationFrame(renderFrame);
            };
            rafId = requestAnimationFrame(renderFrame);
          }
        }
      }
    }

    let hasEnded = false;
    let playbackLimitTimer: number | null = null;

    // 3. Link Stream manifest (HLS .m3u8 / DASH .mpd) to player
    const player = attachCloudflareStreamPlayer({
      video,
      hlsManifestUrl: resolvedUrls.hlsManifestUrl,
      dashManifestUrl: resolvedUrls.dashManifestUrl,
      fallbackMp4Url: CLOUDFLARE_LION_GIFT_STREAM.fallbackLocalMp4,
      onLoaded: () => {
        if (isCleanedUp) return;
        video.muted = !soundEnabledRef.current;
      },
      onError: (err) => {
        console.error('Error loading Lion gift stream:', err);
        if (!isCleanedUp) {
          onCompleteRef.current();
        }
      },
    });

    // 4. Smoothly fade out and unmount as soon as the Lion finishes roaring
    const handleEnded = () => {
      if (isCleanedUp || hasEnded) return;
      hasEnded = true;
      setIsVibrating(false);
      setIsFadingOut(true);

      fadeTimer = window.setTimeout(() => {
        if (isCleanedUp) return;
        player.destroy();
        onCompleteRef.current();
      }, 800);
    };

    // Sync screen vibration to the close-up roar (4.2s - 6.1s) and fade out right as roar completes (6.4s)
    const handleTimeUpdate = () => {
      if (isCleanedUp || hasEnded) return;
      const t = video.currentTime;
      const dur = video.duration;
      const shouldVibrate = t >= 4.2 && t <= 6.1;
      setIsVibrating((prev) => (prev !== shouldVibrate ? shouldVibrate : prev));

      if (t >= 6.4 || (dur > 0 && Number.isFinite(dur) && t >= dur - 0.35)) {
        handleEnded();
      }
    };

    const handlePlaying = () => {
      if (isCleanedUp || playbackLimitTimer) return;
      playbackLimitTimer = window.setTimeout(() => {
        handleEnded();
      }, 6800);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);

    // Safety timeout so overlay never gets stuck if network drops before playback starts
    safetyTimer = window.setTimeout(() => {
      if (!isCleanedUp) {
        handleEnded();
      }
    }, 9500);

    return () => {
      isCleanedUp = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (playbackLimitTimer) clearTimeout(playbackLimitTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (safetyTimer) clearTimeout(safetyTimer);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      player.destroy();
    };
  }, [resolvedUrls.hlsManifestUrl, resolvedUrls.dashManifestUrl]);

  // Soft CSS radial mask fallback so even without WebGL, the video never blocks the top camera or edges
  const featheredMaskStyle: React.CSSProperties = {
    WebkitMaskImage:
      'radial-gradient(ellipse 68% 62% at 50% 56%, rgba(0,0,0,1) 42%, rgba(0,0,0,0.65) 68%, rgba(0,0,0,0) 96%)',
    maskImage:
      'radial-gradient(ellipse 68% 62% at 50% 56%, rgba(0,0,0,1) 42%, rgba(0,0,0,0.65) 68%, rgba(0,0,0,0) 96%)',
  };

  return (
    <div
      id="gift-overlay-layer"
      ref={containerRef}
      className={`fixed inset-0 z-50 pointer-events-none overflow-hidden select-none flex flex-col justify-end items-center ${
        isVibrating ? 'screen-vibrate-effect' : ''
      }`}
    >
      <style jsx>{`
        @keyframes lionScreenShake {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          20% {
            transform: translate3d(-8px, 6px, 0) scale(1.015);
          }
          40% {
            transform: translate3d(8px, -6px, 0) scale(1.02);
          }
          60% {
            transform: translate3d(-6px, -4px, 0) scale(1.012);
          }
          80% {
            transform: translate3d(6px, 5px, 0) scale(1.015);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        .screen-vibrate-effect {
          animation: lionScreenShake 0.14s infinite ease-in-out;
        }
      `}</style>

      {/* Center-Bottom Stage Container (Top 30% stays 100% clear so streamer's face is always visible) */}
      <div
        className="relative w-full max-w-2xl h-[68vh] mb-10 flex items-center justify-center pointer-events-none"
        style={{
          zIndex: 9999,
          transition: 'opacity 1.2s ease, transform 0.6s ease',
          opacity: isFadingOut ? 0 : 1,
        }}
      >
        {/* WebGL Chroma-Key & Feathered Canvas (Active when CORS permits pixel access) */}
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-contain pointer-events-none ${
            webglActive ? 'block' : 'hidden'
          }`}
        />

        {/* Source Video Element (Hidden when WebGL Canvas is active; Feathered CSS Mask fallback otherwise) */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          className={`w-full h-full object-contain pointer-events-none ${
            webglActive ? 'opacity-0 absolute w-1 h-1' : 'block'
          }`}
          style={webglActive ? undefined : featheredMaskStyle}
        />
      </div>

      {/* Minimal Corner Audio / Skip Controls */}
      <div
        className="absolute top-16 right-4 flex items-center gap-2 pointer-events-auto"
        style={{ zIndex: 10000 }}
      >
        <button
          type="button"
          onClick={() => setSoundEnabled((v) => !v)}
          className="h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-amber-300 flex items-center justify-center backdrop-blur-md transition-all"
          title={soundEnabled ? 'Mute Roar' : 'Unmute Roar'}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="h-9 w-9 rounded-full bg-black/60 hover:bg-rose-950/90 border border-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all"
          title="Close Gift Overlay"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Sleek TikTok-Style Sender Pill at Bottom */}
      <div
        className={`absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-700 ${
          isFadingOut ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ zIndex: 10000 }}
      >
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-black/75 border border-amber-400/60 backdrop-blur-xl shadow-[0_0_35px_rgba(245,158,11,0.5)]">
          <Avatar className="h-10 w-10 border-2 border-amber-400">
            <AvatarImage src={senderAvatar} alt={senderName} />
            <AvatarFallback className="bg-amber-600 text-black font-black text-sm">
              {senderName ? senderName.charAt(0).toUpperCase() : 'L'}
            </AvatarFallback>
          </Avatar>
          <div className="pr-2">
            <p className="text-xs sm:text-sm font-black text-white">
              {senderName} <span className="text-amber-300">sent Majestic Lion 🦁</span>
            </p>
          </div>
          {combo > 1 && (
            <span className="text-lg font-black italic text-amber-300 pr-1">x{combo}</span>
          )}
        </div>
      </div>
    </div>
  );
}
