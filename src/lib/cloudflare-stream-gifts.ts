'use client';

import Hls from 'hls.js';

/**
 * CLOUDFLARE STREAM GIFT VIDEO CONFIGURATION
 * ==========================================
 * Central registry for Cloudflare Stream gift animations.
 * Whenever you upload or update a gift video in Cloudflare Stream, simply paste
 * the new `videoId` below (or pass a full HLS `.m3u8` / DASH `.mpd` URL).
 */
export const CLOUDFLARE_CUSTOMER_SUBDOMAIN =
  'customer-hr5svow9g6ltwghx.cloudflarestream.com';

export interface CloudflareGiftStreamConfig {
  giftId: string;
  giftName: string;
  videoId: string;
  customerSubdomain: string;
  hlsManifestUrl: string;
  dashManifestUrl: string;
  thumbnailUrl: string;
  animatedGifUrl: string;
  /** Time in milliseconds when the peak roar / screen-shake effect triggers */
  roarPeakShakeMs: number;
  /** Smooth fade-out duration in milliseconds when the video ends */
  fadeOutMs: number;
  /** Local fallback MP4 if user is offline */
  fallbackLocalMp4: string;
}

/**
 * Helper to generate both HLS (.m3u8) and DASH (.mpd) URLs from a Cloudflare Video ID.
 */
export function buildCloudflareStreamUrls(
  videoId: string,
  subdomain: string = CLOUDFLARE_CUSTOMER_SUBDOMAIN
) {
  const cleanId = videoId.trim();
  return {
    videoId: cleanId,
    hlsManifestUrl: `https://${subdomain}/${cleanId}/manifest/video.m3u8`,
    dashManifestUrl: `https://${subdomain}/${cleanId}/manifest/video.mpd`,
    iframeEmbedUrl: `https://${subdomain}/${cleanId}/iframe`,
    thumbnailUrl: `https://${subdomain}/${cleanId}/thumbnails/thumbnail.jpg?time=5s&width=400`,
    animatedGifUrl: `https://${subdomain}/${cleanId}/thumbnails/thumbnail.gif?time=2s&duration=4s&width=320`,
  };
}

/**
 * Active Cloudflare Stream Gift Videos
 * - Lion Gift Video ID: c648c4bd8e6a6273c7f1f7986f705c40
 *   (0s-3.5s: Photorealistic 3D Lion leaps onto rocky cliff; 4.2s-6.2s: Close-up ferocious roar with dust shockwave)
 */
export const CLOUDFLARE_LION_GIFT_STREAM: CloudflareGiftStreamConfig = {
  giftId: 'lion',
  giftName: 'Majestic Lion',
  videoId: process.env.NEXT_PUBLIC_CF_LION_VIDEO_ID || 'c648c4bd8e6a6273c7f1f7986f705c40',
  customerSubdomain: CLOUDFLARE_CUSTOMER_SUBDOMAIN,
  hlsManifestUrl:
    'https://customer-hr5svow9g6ltwghx.cloudflarestream.com/c648c4bd8e6a6273c7f1f7986f705c40/manifest/video.m3u8',
  dashManifestUrl:
    'https://customer-hr5svow9g6ltwghx.cloudflarestream.com/c648c4bd8e6a6273c7f1f7986f705c40/manifest/video.mpd',
  thumbnailUrl:
    'https://customer-hr5svow9g6ltwghx.cloudflarestream.com/c648c4bd8e6a6273c7f1f7986f705c40/thumbnails/thumbnail.jpg?time=5s&width=400',
  animatedGifUrl:
    'https://customer-hr5svow9g6ltwghx.cloudflarestream.com/c648c4bd8e6a6273c7f1f7986f705c40/thumbnails/thumbnail.gif?time=2s&duration=4s&width=320',
  roarPeakShakeMs: 4200,
  fadeOutMs: 1200,
  fallbackLocalMp4: '',
};

export const CLOUDFLARE_STREAM_GIFTS: Record<string, CloudflareGiftStreamConfig> = {
  lion: CLOUDFLARE_LION_GIFT_STREAM,
  majestic_lion: CLOUDFLARE_LION_GIFT_STREAM,
};

/**
 * Resolve any input (Cloudflare Video ID, .m3u8 URL, or .mpd URL) into both HLS and DASH manifest URLs.
 */
export function resolveCloudflareStreamInput(input?: string): {
  hlsManifestUrl: string;
  dashManifestUrl: string;
  videoId?: string;
} {
  if (!input || !input.trim()) {
    return {
      hlsManifestUrl: CLOUDFLARE_LION_GIFT_STREAM.hlsManifestUrl,
      dashManifestUrl: CLOUDFLARE_LION_GIFT_STREAM.dashManifestUrl,
      videoId: CLOUDFLARE_LION_GIFT_STREAM.videoId,
    };
  }

  const trimmed = input.trim();

  // If a 32-char hex Cloudflare Video ID was passed directly
  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    const urls = buildCloudflareStreamUrls(trimmed);
    return {
      hlsManifestUrl: urls.hlsManifestUrl,
      dashManifestUrl: urls.dashManifestUrl,
      videoId: trimmed,
    };
  }

  // If a DASH .mpd URL was passed, also derive the sibling .m3u8 URL
  if (trimmed.includes('.mpd')) {
    return {
      dashManifestUrl: trimmed,
      hlsManifestUrl: trimmed.replace(/\/manifest\/video\.mpd(\?.*)?$/, '/manifest/video.m3u8$1'),
    };
  }

  // If an HLS .m3u8 URL was passed, also derive the sibling .mpd URL
  if (trimmed.includes('.m3u8')) {
    return {
      hlsManifestUrl: trimmed,
      dashManifestUrl: trimmed.replace(/\/manifest\/video\.m3u8(\?.*)?$/, '/manifest/video.mpd$1'),
    };
  }

  return {
    hlsManifestUrl: trimmed,
    dashManifestUrl: trimmed,
  };
}

export interface AttachCloudflarePlayerOptions {
  video: HTMLVideoElement;
  hlsManifestUrl?: string;
  dashManifestUrl?: string;
  preferDashShaka?: boolean;
  fallbackMp4Url?: string;
  onLoaded?: (engine: 'shaka-dash' | 'hls.js' | 'native-hls' | 'mp4-fallback') => void;
  onError?: (err: unknown) => void;
}

/**
 * Attaches a streaming player (Shaka Player DASH or Hls.js / Native Safari HLS)
 * to a <video> element and returns a cleanup `destroy()` function.
 */
export function attachCloudflareStreamPlayer(
  options: AttachCloudflarePlayerOptions
): { destroy: () => void } {
  const {
    video,
    hlsManifestUrl = CLOUDFLARE_LION_GIFT_STREAM.hlsManifestUrl,
    dashManifestUrl = CLOUDFLARE_LION_GIFT_STREAM.dashManifestUrl,
    preferDashShaka = false,
    fallbackMp4Url = CLOUDFLARE_LION_GIFT_STREAM.fallbackLocalMp4,
    onLoaded,
    onError,
  } = options;

  let hlsInstance: Hls | null = null;
  let shakaInstance: any = null;
  let destroyed = false;

  const startPlayback = () => {
    if (destroyed) return;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // If browser autoplay policy blocks unmuted playback initially, start muted and unmute on interaction
        if (!destroyed) {
          video.muted = true;
          video.play().catch(() => {});
        }
      });
    }
  };

  const startHlsPlayback = () => {
    if (destroyed) return;

    // 1. Hls.js (Chrome, Edge, Firefox, Android, Desktop)
    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1, // Auto ABR starting at highest available bandwidth
        capLevelToPlayerSize: false,
      });

      hlsInstance.loadSource(hlsManifestUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        if (destroyed) return;
        onLoaded?.('hls.js');
        startPlayback();
      });

      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hlsInstance?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsInstance?.recoverMediaError();
              break;
            default:
              hlsInstance?.destroy();
              hlsInstance = null;
              if (!destroyed && fallbackMp4Url) {
                video.src = fallbackMp4Url;
                onLoaded?.('mp4-fallback');
                startPlayback();
              } else {
                onError?.(data);
              }
              break;
          }
        }
      });
      return;
    }

    // 2. Native HLS support (Safari / iOS / macOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsManifestUrl;
      video.addEventListener(
        'loadedmetadata',
        () => {
          if (destroyed) return;
          onLoaded?.('native-hls');
          startPlayback();
        },
        { once: true }
      );
      return;
    }

    // 3. Final fallback to local MP4
    if (fallbackMp4Url) {
      video.src = fallbackMp4Url;
      onLoaded?.('mp4-fallback');
      startPlayback();
    }
  };

  // Optional Shaka Player DASH (.mpd) path if `window.shaka` is loaded and preferred
  const globalShaka =
    typeof window !== 'undefined' ? (window as unknown as { shaka?: any }).shaka : undefined;

  if (preferDashShaka && globalShaka?.Player && dashManifestUrl) {
    try {
      globalShaka.polyfill?.installAll?.();
      if (globalShaka.Player.isBrowserSupported()) {
        shakaInstance = new globalShaka.Player(video);
        shakaInstance
          .load(dashManifestUrl)
          .then(() => {
            if (destroyed) return;
            onLoaded?.('shaka-dash');
            startPlayback();
          })
          .catch((err: unknown) => {
            console.warn('Shaka DASH load failed, falling back to HLS manifest:', err);
            try {
              shakaInstance?.destroy?.();
            } catch (_) {}
            shakaInstance = null;
            startHlsPlayback();
          });
      } else {
        startHlsPlayback();
      }
    } catch (err) {
      startHlsPlayback();
    }
  } else {
    startHlsPlayback();
  }

  return {
    destroy: () => {
      destroyed = true;
      if (hlsInstance) {
        try {
          hlsInstance.destroy();
        } catch (_) {}
        hlsInstance = null;
      }
      if (shakaInstance) {
        try {
          shakaInstance.destroy();
        } catch (_) {}
        shakaInstance = null;
      }
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (_) {}
    },
  };
}
