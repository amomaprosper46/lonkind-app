// ZegoCloud utility - generates kit tokens and exports app constants.
// Never import this file on the server side (it uses browser APIs).

export const ZEGO_APP_ID = parseInt(process.env.NEXT_PUBLIC_ZEGO_APP_ID || '0', 10);
export const ZEGO_APP_SIGN = process.env.NEXT_PUBLIC_ZEGO_APP_SIGN || '';

/**
 * Generate a deterministic, sorted room ID for a 1-on-1 call
 * so that both participants always end up in the same room.
 */
export function getCallRoomId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_call_').replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Generate a live stream room ID for a given host.
 * Viewers use the same room ID to join as audience.
 */
export function getLiveRoomId(hostUid: string): string {
  return `live_${hostUid}`.replace(/[^a-zA-Z0-9_]/g, '');
}
