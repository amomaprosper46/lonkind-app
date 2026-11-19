import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/streams/guest-leave
 * Called via `navigator.sendBeacon` or `fetch` when a co-host guest leaves the stage,
 * disconnects, or closes their browser tab. Atomically removes them from
 * `streams/{streamId}.activeGuests` and clears their guest request document.
 */
export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    const parsed = JSON.parse(rawText || '{}');
    const streamId = typeof parsed.streamId === 'string' ? parsed.streamId.trim() : '';
    const userId = typeof parsed.userId === 'string' ? parsed.userId.trim() : '';

    if (!streamId || !userId) {
      return NextResponse.json({ error: 'Missing streamId or userId' }, { status: 400 });
    }

    const streamRef = adminDb.collection('streams').doc(streamId);
    const reqRef = streamRef.collection('guest_requests').doc(userId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(streamRef);
      if (snap.exists) {
        const currentGuests = Array.isArray(snap.data()?.activeGuests) ? snap.data()!.activeGuests : [];
        const filtered = currentGuests.filter((g: any) => g?.userId !== userId);
        tx.set(
          streamRef,
          {
            activeGuests: filtered,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      tx.delete(reqRef);
    });

    return NextResponse.json({ success: true, removedUserId: userId });
  } catch (err) {
    console.error('[POST /api/streams/guest-leave] Error:', err);
    return NextResponse.json({ error: 'Failed to clean up disconnected guest.' }, { status: 500 });
  }
}
