/**
 * Lonkind Anti-Ad Fraud & Viewability Guard ("Anti-Ads Viewer")
 * =============================================================
 * Enforces IAB Genuine Viewability (50%+ visible for 1.5 continuous seconds),
 * background-tab protection (`document.hidden`), and automated bot detection.
 */

export const IAB_MIN_VISIBLE_RATIO = 0.5;
export const IAB_MIN_CONTINUOUS_MS = 1500;
export const AD_DEDUP_WINDOW_MS = 60 * 60 * 1000; // Rolling 1-hour deduplication window

const BOT_UA_PATTERNS = [
  /headlesschrome/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /phantomjs/i,
  /webdriver/i,
  /\b(bot|crawler|spider|scraper|curl|wget|python-requests|axios\/|node-fetch|postmanruntime)\b/i,
];

export function isAutomatedBotUserAgent(userAgent?: string | null): boolean {
  if (!userAgent || typeof userAgent !== 'string' || userAgent.trim().length < 10) {
    return true;
  }
  return BOT_UA_PATTERNS.some((re) => re.test(userAgent));
}

export interface AdViewabilityGuardOptions {
  element: HTMLElement;
  onQualifiedImpression: () => void;
  onVisibilityChange?: (isVisible: boolean) => void;
  minRatio?: number;
  minDurationMs?: number;
}

/**
 * Attaches an IAB-compliant viewability guard to an ad card DOM element.
 * Fires `onQualifiedImpression()` at most once, ONLY after >= 50% of the card
 * remains continuously visible in an active foreground tab for >= 1.5 seconds.
 */
export function attachAdViewabilityGuard({
  element,
  onQualifiedImpression,
  onVisibilityChange,
  minRatio = IAB_MIN_VISIBLE_RATIO,
  minDurationMs = IAB_MIN_CONTINUOUS_MS,
}: AdViewabilityGuardOptions): () => void {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    return () => {};
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let qualified = false;
  let currentlyIntersecting = false;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const evaluate = () => {
    const tabActive = !document.hidden;
    const isActivelyVisible = currentlyIntersecting && tabActive;
    onVisibilityChange?.(isActivelyVisible);

    if (qualified) return;

    if (isActivelyVisible) {
      if (timer === null) {
        timer = setTimeout(() => {
          timer = null;
          if (currentlyIntersecting && !document.hidden && !qualified) {
            qualified = true;
            onQualifiedImpression();
          }
        }, minDurationMs);
      }
    } else {
      clearTimer();
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      currentlyIntersecting = entry.isIntersecting && entry.intersectionRatio >= minRatio;
      evaluate();
    },
    { threshold: [0, minRatio] }
  );

  const handleDocVisibility = () => {
    evaluate();
  };

  observer.observe(element);
  document.addEventListener('visibilitychange', handleDocVisibility);

  return () => {
    clearTimer();
    observer.disconnect();
    document.removeEventListener('visibilitychange', handleDocVisibility);
  };
}
