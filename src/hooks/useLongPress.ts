import { useRef, useCallback } from 'react';

/**
 * Hook to detect a long press (default 3000ms).
 * Returns handlers to spread onto a component.
 */
export function useLongPress(
  callback: () => void,
  ms: number = 3000
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    timerRef.current = setTimeout(() => {
      callback();
    }, ms);
  }, [callback, ms]);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlers = {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchEnd: clear,
    onTouchCancel: clear,
  } as const;

  return handlers;
}
