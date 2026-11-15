import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

async function getVerifiedUid(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * GET /api/friend-requests – list pending incoming requests.
 * POST /api/friend-requests – send a friend request to a target user.
 *   Body JSON: { targetUid: string }
 */
export async function GET(request: Request) {
  const uid = await getVerifiedUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshot = await adminDb
    .collection('users')
    .doc(uid)
    .collection('friendRequests')
    .where('status', '==', 'pending')
    .limit(50)
    .get();

  const friendRequests = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
  return NextResponse.json({ friendRequests });
}

export async function POST(request: Request) {
  const uid = await getVerifiedUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { targetUid } = await request.json();
  if (!targetUid || typeof targetUid !== 'string' || targetUid === uid) {
    return NextResponse.json({ error: 'Valid targetUid required' }, { status: 400 });
  }

  const senderSnap = await adminDb.collection('users').doc(uid).get();
  const senderData = senderSnap.data() || {};

  await adminDb
    .collection('users')
    .doc(targetUid)
    .collection('friendRequests')
    .doc(uid)
    .set({
      from: {
        uid,
        name: senderData.name || 'Lonkind User',
        handle: senderData.handle || 'user',
        avatarUrl: senderData.avatarUrl || '',
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
    });

  return NextResponse.json({ success: true });
}
