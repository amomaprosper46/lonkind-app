import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

/**
 * POST /api/live/clean-room
 * Server-side automatic cleanup of old chat, gift announcements, and co-host requests
 * when a live stream starts or ends. Uses Firebase Admin SDK batch delete so it never
 * fails due to client-side permissions or tab closures.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = await req.json();
    const { roomId } = body;

    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    // Verify caller is the host of this stream room (roomId is `live_<hostUid>`)
    const expectedRoomId = `live_${uid}`;
    if (roomId !== expectedRoomId && decoded.email !== 'admin@lonkind.com') {
      const roomSnap = await adminDb.collection('live_streams').doc(roomId).get();
      if (roomSnap.exists && roomSnap.data()?.hostUid !== uid) {
        return NextResponse.json({ error: 'Forbidden: Only the stream host can clean this room' }, { status: 403 });
      }
    }

    const roomRef = adminDb.collection('live_streams').doc(roomId);
    const [chatSnap, cohostSnap] = await Promise.all([
      roomRef.collection('chat').limit(400).get(),
      roomRef.collection('cohost_requests').limit(100).get(),
    ]);

    const batch = adminDb.batch();
    let deletedCount = 0;

    chatSnap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      deletedCount++;
    });

    cohostSnap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      deletedCount++;
    });

    if (deletedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error: any) {
    console.error('Error cleaning live stream room on server:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clean live room' },
      { status: 500 }
    );
  }
}
