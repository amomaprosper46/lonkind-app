import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { DocumentReference } from 'firebase-admin/firestore';

interface PendingWrite {
  ref: DocumentReference;
  data: Record<string, any>;
}

/**
 * POST /api/profile/sync-avatar
 * Retroactively updates a user's avatarUrl, name, and handle across all historical
 * posts, group posts, comments, direct message conversations, friends lists,
 * friend requests, and notifications.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await req.json().catch(() => ({}));
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    const avatarUrl: string = body.avatarUrl ?? userData.avatarUrl ?? '';
    const name: string = body.name ?? userData.name ?? '';
    const handle: string = body.handle ?? userData.handle ?? '';

    if (!avatarUrl && !name && !handle) {
      return NextResponse.json({ success: true, updatedCount: 0 });
    }

    const pendingWrites = new Map<string, PendingWrite>();
    const queueUpdate = (ref: DocumentReference, data: Record<string, any>) => {
      pendingWrites.set(ref.path, { ref, data });
    };

    const authorPatch: Record<string, any> = {};
    if (avatarUrl) authorPatch['author.avatarUrl'] = avatarUrl;
    if (name) authorPatch['author.name'] = name;
    if (handle) authorPatch['author.handle'] = handle;

    // 1. All top-level posts by this user (including posts from months/years ago)
    try {
      const postsSnap = await adminDb.collection('posts').where('author.uid', '==', uid).get();
      postsSnap.docs.forEach((d) => queueUpdate(d.ref, authorPatch));
    } catch (err) {
      console.warn('[sync-avatar] top-level posts query warning:', err);
    }

    // 2. All group posts across groups/{groupId}/posts
    try {
      const groupPostsSnap = await adminDb
        .collectionGroup('posts')
        .where('author.uid', '==', uid)
        .get();
      groupPostsSnap.docs.forEach((d) => queueUpdate(d.ref, authorPatch));
    } catch (err) {
      console.warn('[sync-avatar] collectionGroup(posts) warning:', err);
    }

    // 3. All comments across posts/{postId}/comments
    try {
      const commentsSnap = await adminDb
        .collectionGroup('comments')
        .where('author.uid', '==', uid)
        .get();
      commentsSnap.docs.forEach((d) => queueUpdate(d.ref, authorPatch));
    } catch (err) {
      console.warn('[sync-avatar] collectionGroup(comments) warning:', err);
    }

    // 4. All direct message conversations where participantUids contains uid
    try {
      const convosSnap = await adminDb
        .collection('conversations')
        .where('participantUids', 'array-contains', uid)
        .get();

      convosSnap.docs.forEach((d) => {
        const data = d.data();
        if (Array.isArray(data.participants)) {
          let changed = false;
          const updatedParticipants = data.participants.map((p: any) => {
            if (p && p.uid === uid) {
              changed = true;
              return {
                ...p,
                ...(avatarUrl ? { avatarUrl } : {}),
                ...(name ? { name } : {}),
                ...(handle ? { handle } : {}),
              };
            }
            return p;
          });
          if (changed) {
            queueUpdate(d.ref, { participants: updatedParticipants });
          }
        }
      });
    } catch (err) {
      console.warn('[sync-avatar] conversations query warning:', err);
    }

    // 5. Direct path updates for reciprocal friends lists: users/{friendUid}/friends/{uid}
    const friendPatch: Record<string, any> = {};
    if (avatarUrl) friendPatch.avatarUrl = avatarUrl;
    if (name) friendPatch.name = name;
    if (handle) friendPatch.handle = handle;

    try {
      const myFriendsSnap = await adminDb.collection('users').doc(uid).collection('friends').get();
      await Promise.all(
        myFriendsSnap.docs.map(async (fDoc) => {
          const friendUid = fDoc.id;
          const reciprocalRef = adminDb
            .collection('users')
            .doc(friendUid)
            .collection('friends')
            .doc(uid);
          const reciprocalSnap = await reciprocalRef.get();
          if (reciprocalSnap.exists) {
            queueUpdate(reciprocalRef, friendPatch);
          }
        })
      );
    } catch (err) {
      console.warn('[sync-avatar] reciprocal friends update warning:', err);
    }

    // Also try collectionGroup('friends') in case of one-way friend records
    try {
      const cgFriendsSnap = await adminDb
        .collectionGroup('friends')
        .where('uid', '==', uid)
        .get();
      cgFriendsSnap.docs.forEach((d) => queueUpdate(d.ref, friendPatch));
    } catch (err) {
      console.warn('[sync-avatar] collectionGroup(friends) warning:', err);
    }

    // 6. Pending friend requests sent by this user
    try {
      const reqPatch: Record<string, any> = {};
      if (avatarUrl) reqPatch['from.avatarUrl'] = avatarUrl;
      if (name) reqPatch['from.name'] = name;
      if (handle) reqPatch['from.handle'] = handle;

      const cgReqsSnap = await adminDb
        .collectionGroup('friendRequests')
        .where('from.uid', '==', uid)
        .get();
      cgReqsSnap.docs.forEach((d) => queueUpdate(d.ref, reqPatch));
    } catch (err) {
      console.warn('[sync-avatar] collectionGroup(friendRequests) warning:', err);
    }

    // 7. Notifications triggered by this user
    try {
      const notifPatch: Record<string, any> = {};
      if (avatarUrl) notifPatch['fromUser.avatarUrl'] = avatarUrl;
      if (name) notifPatch['fromUser.name'] = name;
      if (handle) notifPatch['fromUser.handle'] = handle;

      const cgNotifsSnap = await adminDb
        .collectionGroup('notifications')
        .where('fromUser.uid', '==', uid)
        .get();
      cgNotifsSnap.docs.forEach((d) => queueUpdate(d.ref, notifPatch));
    } catch (err) {
      console.warn('[sync-avatar] collectionGroup(notifications) warning:', err);
    }

    // Commit all queued writes in batches of 400 (well under Firestore's 500-op limit)
    const allWrites = Array.from(pendingWrites.values());
    const CHUNK_SIZE = 400;
    for (let i = 0; i < allWrites.length; i += CHUNK_SIZE) {
      const chunk = allWrites.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();
      chunk.forEach((item) => batch.update(item.ref, item.data));
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      updatedCount: allWrites.length,
    });
  } catch (error: any) {
    console.error('[sync-avatar] Error syncing profile picture everywhere:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to sync profile changes' },
      { status: 500 }
    );
  }
}
