import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, doc, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/friend-requests – list pending incoming requests.
 * POST /api/friend-requests – send a friend request to a target user.
 *   Body JSON: { targetUid: string }
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const uid = session.user.id as string;
  const requestsRef = collection(db, 'users', uid, 'friendRequests');
  const q = query(requestsRef, where('status', '==', 'pending'), limit(50));
  const snapshot = await getDocs(q);
  const friendRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ friendRequests });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const uid = session.user.id as string;
  const { targetUid } = await request.json();
  if (!targetUid) {
    return NextResponse.json({ error: 'targetUid required' }, { status: 400 });
  }
  const batch = writeBatch(db);
  const requestRef = doc(db, 'users', targetUid, 'friendRequests', uid);
  batch.set(requestRef, {
    from: { uid, name: session.user.name, handle: session.user.handle, avatarUrl: session.user.avatarUrl },
    timestamp: serverTimestamp(),
    status: 'pending',
  });
  await batch.commit();
  return NextResponse.json({ success: true });
}
