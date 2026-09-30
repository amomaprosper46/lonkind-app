import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, startAfter, orderBy } from 'firebase/firestore';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/suggestions
 * Returns a paginated list of user suggestions (excluding the current user).
 * Query params:
 *   - limit: number of results per page (default 20, max 50)
 *   - cursor: document ID to start after (for pagination)
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const uid = session.user.id as string;

  const url = new URL(request.url);
  const limitParam = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50);
  const cursor = url.searchParams.get('cursor');

  const usersRef = collection(db, 'users');
  let q = query(
    usersRef,
    where('__name__', '!=', uid),
    orderBy('__name__'),
    limit(limitParam)
  );
  if (cursor) {
    const cursorSnap = await getDocs(query(usersRef, where('__name__', '==', cursor)));
    if (!cursorSnap.empty) {
      q = query(
        usersRef,
        where('__name__', '!=', uid),
        orderBy('__name__'),
        startAfter(cursorSnap.docs[0]),
        limit(limitParam)
      );
    }
  }
  const snapshot = await getDocs(q);
  const suggestions = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  const nextCursor = suggestions.length ? suggestions[suggestions.length - 1].uid : null;
  return NextResponse.json({ suggestions, nextCursor });
}
