// ZegoCloud utility - generates kit tokens and exports app constants.
// Never import this file on the server side (it uses browser APIs).

export const ZEGO_APP_ID = parseInt(process.env.NEXT_PUBLIC_ZEGO_APP_ID || '1409193896', 10);
export const ZEGO_APP_SIGN = process.env.NEXT_PUBLIC_ZEGO_APP_SIGN || 'cf24340c1654237b23b55d9e7294609fbe1b575d98c98f3fe5184b37d30becc6';

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
  const cleanHost = (hostUid || 'host').replace(/[^a-zA-Z0-9_]/g, '');
  return `live_${cleanHost}`;
}
