import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * GET /api/suggestions
 * Returns a paginated list of user suggestions (excluding the current user).
 * Query params:
 *   - limit: number of results per page (default 20, max 50)
 *   - cursor: document ID to start after (for pagination)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 50);
  const cursor = url.searchParams.get('cursor');

  let q: admin.firestore.Query = adminDb
    .collection('users')
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(limitParam + 1);

  if (cursor) {
    const cursorSnap = await adminDb.collection('users').doc(cursor).get();
    if (cursorSnap.exists) {
      q = adminDb
        .collection('users')
        .orderBy(admin.firestore.FieldPath.documentId())
        .startAfter(cursorSnap)
        .limit(limitParam + 1);
    }
  }

  const snapshot = await q.get();
  const suggestions = snapshot.docs
    .filter((docSnap) => docSnap.id !== uid)
    .slice(0, limitParam)
    .map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));

  const nextCursor = suggestions.length ? suggestions[suggestions.length - 1].uid : null;
  return NextResponse.json({ suggestions, nextCursor });
}
