// ZegoCloud utility - generates kit tokens and exports app constants.
// Compatible with both browser and SSR contexts.

export const ZEGO_APP_ID = parseInt(process.env.NEXT_PUBLIC_ZEGO_APP_ID || '1409193896', 10);
export const ZEGO_APP_SIGN = process.env.NEXT_PUBLIC_ZEGO_APP_SIGN || 'cf24340c1654237b23b55d9e7294609fbe1b575d98c98f3fe5184b37d30becc6';

/**
 * Validates if a string matches the 32-character Zego ServerSecret specification.
 */
export function isValidZegoSecret(secret?: string | null): boolean {
  if (!secret) return false;
  const clean = secret.trim();
  return clean.length === 32 && /^[a-zA-Z0-9]+$/.test(clean);
}

/**
 * Retrieves the 32-character ZEGOCLOUD ServerSecret.
 * Checks localStorage first (allowing instant UI configuration without rebuild),
 * followed by environment variables.
 */
export function getZegoServerSecret(): string {
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('lonkind_zego_server_secret');
      if (local && isValidZegoSecret(local)) {
        return local.trim();
      }
    } catch (_) {}
  }
  const envSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || process.env.ZEGO_SERVER_SECRET;
  if (envSecret && isValidZegoSecret(envSecret)) {
    return envSecret.trim();
  }
  return '';
}

/**
 * Saves the 32-character ZEGOCLOUD ServerSecret to localStorage for persistent sessions.
 */
export function setZegoServerSecret(secret: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('lonkind_zego_server_secret', secret.trim());
    } catch (_) {}
  }
}

/**
 * Clears the stored ZEGOCLOUD ServerSecret.
 */
export function clearZegoServerSecret(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('lonkind_zego_server_secret');
    } catch (_) {}
  }
}

/**
 * Generate a deterministic, sorted room ID for a 1-on-1 call
 * so that both participants always end up in the same room.
 */
export function getCallRoomId(uidA: string, uidB: string): string {
  const cleanA = (uidA || 'a').replace(/[^a-zA-Z0-9_]/g, '');
  const cleanB = (uidB || 'b').replace(/[^a-zA-Z0-9_]/g, '');
  return [cleanA, cleanB].sort().join('_call_');
}

/**
 * Generate a live stream room ID for a given host.
 * Viewers use the same room ID to join as audience.
 */
export function getLiveRoomId(hostUid: string): string {
  const cleanHost = (hostUid || 'host')
    .toString()
    .replace(/^live_/, '')
    .replace(/[^a-zA-Z0-9_]/g, '');
  return `live_${cleanHost || 'host'}`;
}
