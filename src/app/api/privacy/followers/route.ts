import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  FollowStatusEnum,
  FollowerActionSchema,
  type FollowStatus,
  type FollowerListItem,
  type PaginatedFollowersResponse,
} from '@/lib/follows-schema';

/**
 * Verify Firebase Bearer ID token and return the authenticated target user UID.
 * Strictly guarantees that only the account owner can manage their own requests/followers.
 */
async function authenticateTargetUser(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

function toEpochMs(ts: any): number {
  if (!ts) return Date.now();
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return Date.now();
}

/**
 * Helper to hydrate fresh user profiles + compute mutual followers count
 * between the target account owner and a list of follower/requester UIDs.
 */
async function hydrateWithMutuals(
  ownerAcceptedSet: Set<string>,
  rawItems: { uid: string; fallbackName?: string; fallbackHandle?: string; fallbackAvatar?: string; status: FollowStatus; requestedAtMs: number }[]
): Promise<FollowerListItem[]> {
  if (rawItems.length === 0) return [];

  const hydrated = await Promise.all(
    rawItems.map(async (entry) => {
      let name = entry.fallbackName || 'Lonkind User';
      let handle = entry.fallbackHandle || 'user';
      let avatarUrl = entry.fallbackAvatar || '';
      let isProfessional = false;
      let mutualCount = 0;

      try {
        const [userSnap, theirFriendsSnap] = await Promise.all([
          adminDb.collection('users').doc(entry.uid).get(),
          ownerAcceptedSet.size > 0
            ? adminDb.collection('users').doc(entry.uid).collection('friends').limit(100).get()
            : Promise.resolve(null),
        ]);

        if (userSnap.exists) {
          const u = userSnap.data() || {};
          name = u.name || name;
          handle = u.handle || handle;
          avatarUrl = u.avatarUrl || avatarUrl;
          isProfessional = Boolean(u.isProfessional) || handle.toLowerCase() === 'lonkind';
        }

        if (theirFriendsSnap) {
          theirFriendsSnap.docs.forEach((d) => {
            if (ownerAcceptedSet.has(d.id)) mutualCount += 1;
          });
        }
      } catch {
        // Use fallback metadata gracefully
      }

      return {
        uid: entry.uid,
        name,
        handle,
        avatarUrl,
        isProfessional,
        status: entry.status,
        mutualCount,
        requestedAtMs: entry.requestedAtMs,
      };
    })
  );

  return hydrated;
}

/**
 * GET /api/privacy/followers?status=PENDING|ACCEPTED|BLOCKED&q=...&page=1&limit=10
 * Returns searchable, paginated follower requests, approved followers, or blocked users
 * belonging strictly to the authenticated user.
 */
export async function GET(req: NextRequest) {
  const targetUid = await authenticateTargetUser(req);
  if (!targetUid) {
    return NextResponse.json({ error: 'Unauthorized: Valid authentication required.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const parsedStatus = FollowStatusEnum.safeParse((searchParams.get('status') || 'PENDING').toUpperCase());
    const status: FollowStatus = parsedStatus.success ? parsedStatus.data : 'PENDING';
    const queryText = (searchParams.get('q') || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10));

    // Fetch user privacy flag + subcollections + canonical `follows` & `follower_requests` records
    const [
      userSnap,
      reqSnap,
      followReqSnap,
      friendsSnap,
      followersSnap,
      blockedSnap,
      followsSnap,
      topFollowReqSnap,
    ] = await Promise.all([
      adminDb.collection('users').doc(targetUid).get(),
      adminDb.collection('users').doc(targetUid).collection('friendRequests').get(),
      adminDb.collection('users').doc(targetUid).collection('followRequests').get(),
      adminDb.collection('users').doc(targetUid).collection('friends').get(),
      adminDb.collection('users').doc(targetUid).collection('followers').get(),
      adminDb.collection('users').doc(targetUid).collection('blockedUsers').get(),
      adminDb.collection('follows').where('targetUserId', '==', targetUid).get(),
      adminDb.collection('follower_requests').where('targetUserId', '==', targetUid).get(),
    ]);

    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const isPrivateAccount = Boolean(
      userData.privateAccount ?? userData.settings?.privacy?.privateAccount ?? false
    );

    // Build deduplicated maps by status combining `follows` collection + user subcollections
    const pendingMap = new Map<string, any>();
    const acceptedMap = new Map<string, any>();
    const blockedMap = new Map<string, any>();

    const addPending = (uid: string, data: Record<string, any>) => {
      if (!uid || uid === targetUid || pendingMap.has(uid)) return;
      pendingMap.set(uid, {
        uid,
        fallbackName: data.from?.name || data.followerName || data.name,
        fallbackHandle: data.from?.handle || data.followerHandle || data.handle,
        fallbackAvatar: data.from?.avatarUrl || data.followerAvatar || data.avatarUrl,
        status: 'PENDING' as FollowStatus,
        requestedAtMs: toEpochMs(data.timestamp || data.createdAt || data.requestedAt),
      });
    };

    reqSnap.docs.forEach((d) => addPending(d.data()?.from?.uid || d.id, d.data() || {}));
    followReqSnap.docs.forEach((d) => addPending(d.data()?.followerId || d.data()?.from?.uid || d.id, d.data() || {}));
    topFollowReqSnap.docs.forEach((d) => {
      const data = d.data() || {};
      if (!data.status || data.status === 'PENDING') {
        addPending(data.followerId || d.id, data);
      }
    });

    friendsSnap.docs.forEach((d) => {
      const data = d.data() || {};
      acceptedMap.set(d.id, {
        uid: d.id,
        fallbackName: data.name,
        fallbackHandle: data.handle,
        fallbackAvatar: data.avatarUrl,
        status: 'ACCEPTED' as FollowStatus,
        requestedAtMs: toEpochMs(data.timestamp || data.createdAt),
      });
    });

    followersSnap.docs.forEach((d) => {
      if (acceptedMap.has(d.id)) return;
      const data = d.data() || {};
      acceptedMap.set(d.id, {
        uid: d.id,
        fallbackName: data.name || data.followerName,
        fallbackHandle: data.handle || data.followerHandle,
        fallbackAvatar: data.avatarUrl || data.followerAvatar,
        status: 'ACCEPTED' as FollowStatus,
        requestedAtMs: toEpochMs(data.timestamp || data.createdAt),
      });
    });

    blockedSnap.docs.forEach((d) => {
      const data = d.data() || {};
      blockedMap.set(d.id, {
        uid: d.id,
        fallbackName: data.name,
        fallbackHandle: data.handle,
        fallbackAvatar: data.avatarUrl,
        status: 'BLOCKED' as FollowStatus,
        requestedAtMs: toEpochMs(data.timestamp || data.createdAt),
      });
    });

    // Merge canonical `follows` table rows (`status: 'PENDING' | 'ACCEPTED' | 'BLOCKED'`)
    followsSnap.docs.forEach((d) => {
      const data = d.data() || {};
      const uid = data.followerId;
      if (!uid) return;
      const rowStatus = data.status as FollowStatus;
      const entry = {
        uid,
        fallbackName: data.followerName,
        fallbackHandle: data.followerHandle,
        fallbackAvatar: data.followerAvatar,
        status: rowStatus,
        requestedAtMs: toEpochMs(data.createdAt || data.updatedAt),
      };
      if (rowStatus === 'PENDING' && !pendingMap.has(uid) && !blockedMap.has(uid)) {
        pendingMap.set(uid, entry);
      } else if (rowStatus === 'ACCEPTED' && !acceptedMap.has(uid) && !blockedMap.has(uid)) {
        acceptedMap.set(uid, entry);
      } else if (rowStatus === 'BLOCKED' && !blockedMap.has(uid)) {
        blockedMap.set(uid, entry);
      }
    });

    const ownerAcceptedSet = new Set<string>(acceptedMap.keys());
    const selectedRawList = Array.from(
      (status === 'PENDING' ? pendingMap : status === 'ACCEPTED' ? acceptedMap : blockedMap).values()
    ).sort((a, b) => b.requestedAtMs - a.requestedAtMs);

    // Hydrate profile details + mutual counts
    const hydratedAll = await hydrateWithMutuals(ownerAcceptedSet, selectedRawList);

    // Apply search query filter
    const filtered = queryText
      ? hydratedAll.filter(
          (item) =>
            item.name.toLowerCase().includes(queryText) ||
            item.handle.toLowerCase().includes(queryText)
        )
      : hydratedAll;

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * limit;
    const items = filtered.slice(startIdx, startIdx + limit);

    const payload: PaginatedFollowersResponse = {
      items,
      page: safePage,
      limit,
      totalCount,
      totalPages,
      counts: {
        pending: pendingMap.size,
        accepted: acceptedMap.size,
        blocked: blockedMap.size,
      },
      isPrivateAccount,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[GET /api/privacy/followers] Error:', error);
    return NextResponse.json({ error: 'Failed to load follower privacy records.' }, { status: 500 });
  }
}

/**
 * POST /api/privacy/followers
 * Authenticated mutations for Private Account Toggle, Confirm/Decline Request,
 * Bulk Approve All / Decline All, Silent Remove Follower, and Block/Unblock User.
 */
export async function POST(req: NextRequest) {
  const targetUid = await authenticateTargetUser(req);
  if (!targetUid) {
    return NextResponse.json({ error: 'Unauthorized: Valid authentication required.' }, { status: 401 });
  }

  try {
    const rawBody = await req.json().catch(() => null);
    const parsed = FollowerActionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const ownerRef = adminDb.collection('users').doc(targetUid);
    const ownerSnap = await ownerRef.get();
    const ownerData = ownerSnap.exists ? ownerSnap.data() || {} : {};
    const ownerProfile = {
      uid: targetUid,
      name: ownerData.name || 'Lonkind User',
      handle: ownerData.handle || 'user',
      avatarUrl: ownerData.avatarUrl || '',
    };

    // Helper: Confirm a single pending follower atomically inside a Firestore Transaction
    // 1. Removes pending request from followRequests / friendRequests / follower_requests
    // 2. Adds requester to target's `followers` (+ `friends`) & target to requester's `following` (+ `friends`)
    // 3. Safely increments follower/following counters (idempotent — never double-increments)
    // 4. Sends a "Follow Request Accepted" notification to the requester
    const approveSingleFollower = async (rawFollowerUid: string) => {
      const followerUid = String(rawFollowerUid || '').trim();
      if (!followerUid) {
        throw new Error('Missing requester user ID.');
      }
      if (followerUid === targetUid) {
        throw new Error('You cannot approve a follow request from yourself.');
      }

      const followerRef = adminDb.collection('users').doc(followerUid);
      const followDocId = `${followerUid}_${targetUid}`;
      const followRef = adminDb.collection('follows').doc(followDocId);
      const topFollowReqRef = adminDb.collection('follower_requests').doc(followDocId);
      const ownerFollowerRef = ownerRef.collection('followers').doc(followerUid);
      const requesterFollowingRef = followerRef.collection('following').doc(targetUid);
      const ownerFriendRef = ownerRef.collection('friends').doc(followerUid);
      const requesterFriendRef = followerRef.collection('friends').doc(targetUid);
      const ownerFriendReqRef = ownerRef.collection('friendRequests').doc(followerUid);
      const ownerFollowReqRef = ownerRef.collection('followRequests').doc(followerUid);
      const notifRef = followerRef.collection('notifications').doc(`follow_accepted_${targetUid}_${followerUid}`);

      await adminDb.runTransaction(async (tx) => {
        const [
          freshOwnerSnap,
          freshFollowerSnap,
          existingFollowerSnap,
          existingFollowingSnap,
          existingFriendSnap,
        ] = await Promise.all([
          tx.get(ownerRef),
          tx.get(followerRef),
          tx.get(ownerFollowerRef),
          tx.get(requesterFollowingRef),
          tx.get(ownerFriendRef),
        ]);

        const freshOwner = freshOwnerSnap.exists ? freshOwnerSnap.data() || {} : ownerData;
        const fData = freshFollowerSnap.exists ? freshFollowerSnap.data() || {} : {};
        const followerProfile = {
          uid: followerUid,
          name: fData.name || 'Lonkind User',
          handle: fData.handle || 'user',
          avatarUrl: fData.avatarUrl || '',
        };

        // 1. Canonical `follows` status -> ACCEPTED
        tx.set(
          followRef,
          {
            id: followDocId,
            followerId: followerUid,
            targetUserId: targetUid,
            status: 'ACCEPTED',
            followerName: followerProfile.name,
            followerHandle: followerProfile.handle,
            followerAvatar: followerProfile.avatarUrl,
            acceptedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // 2. Remove pending requests from all request stores
        tx.delete(ownerFriendReqRef);
        tx.delete(ownerFollowReqRef);
        tx.delete(topFollowReqRef);

        // 3. Add to target's `followers` (+ `friends`) and requester's `following` (+ `friends`)
        tx.set(
          ownerFollowerRef,
          {
            ...followerProfile,
            followedAt: FieldValue.serverTimestamp(),
            timestamp: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        tx.set(
          requesterFollowingRef,
          {
            ...ownerProfile,
            followedAt: FieldValue.serverTimestamp(),
            timestamp: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        tx.set(
          ownerFriendRef,
          {
            ...followerProfile,
            timestamp: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        tx.set(
          requesterFriendRef,
          {
            ...ownerProfile,
            timestamp: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // 4. Safely increment counters only if relationship wasn't already recorded
        const ownerUpdates: Record<string, any> = {
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (!existingFollowerSnap.exists) {
          ownerUpdates.followersCount = Math.max(0, Number(freshOwner.followersCount || 0)) + 1;
        }
        if (!existingFriendSnap.exists) {
          ownerUpdates.friendsCount = Math.max(0, Number(freshOwner.friendsCount || 0)) + 1;
        }
        tx.set(ownerRef, ownerUpdates, { merge: true });

        const followerUpdates: Record<string, any> = {
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (!existingFollowingSnap.exists) {
          followerUpdates.followingCount = Math.max(0, Number(fData.followingCount || 0)) + 1;
        }
        if (!existingFriendSnap.exists) {
          followerUpdates.friendsCount = Math.max(0, Number(fData.friendsCount || 0)) + 1;
        }
        tx.set(followerRef, followerUpdates, { merge: true });

        // 5. Send "Follow Request Accepted" notification to the requester
        tx.set(
          notifRef,
          {
            type: 'follow_request_accepted',
            fromUser: ownerProfile,
            message: `${ownerProfile.name} accepted your follow request!`,
            read: false,
            timestamp: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
    };

    // Helper: Collect all pending requester UIDs for the authenticated target user
    const getAllPendingUids = async (): Promise<string[]> => {
      const [reqSnap, followReqSnap, followsPendingSnap, topFollowReqSnap] = await Promise.all([
        ownerRef.collection('friendRequests').get(),
        ownerRef.collection('followRequests').get(),
        adminDb
          .collection('follows')
          .where('targetUserId', '==', targetUid)
          .where('status', '==', 'PENDING')
          .get(),
        adminDb
          .collection('follower_requests')
          .where('targetUserId', '==', targetUid)
          .where('status', '==', 'PENDING')
          .get(),
      ]);
      const set = new Set<string>();
      reqSnap.docs.forEach((d) => set.add(d.data()?.from?.uid || d.id));
      followReqSnap.docs.forEach((d) => set.add(d.data()?.followerId || d.data()?.from?.uid || d.id));
      followsPendingSnap.docs.forEach((d) => {
        if (d.data()?.followerId) set.add(d.data().followerId);
      });
      topFollowReqSnap.docs.forEach((d) => {
        if (d.data()?.followerId) set.add(d.data().followerId);
      });
      return Array.from(set);
    };

    switch (body.action) {
      case 'toggle_private': {
        await ownerRef.set(
          {
            privateAccount: body.privateAccount,
            settings: {
              ...(ownerData.settings || {}),
              privacy: {
                ...(ownerData.settings?.privacy || {}),
                privateAccount: body.privateAccount,
              },
            },
            settingsUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        let autoApprovedCount = 0;
        if (!body.privateAccount && body.autoApprovePending) {
          const pendingUids = await getAllPendingUids();
          for (const fUid of pendingUids) {
            await approveSingleFollower(fUid);
            autoApprovedCount += 1;
          }
        }

        return NextResponse.json({
          success: true,
          isPrivateAccount: body.privateAccount,
          autoApprovedCount,
        });
      }

      case 'confirm': {
        await approveSingleFollower(body.followerUid);
        return NextResponse.json({ success: true, status: 'ACCEPTED', followerUid: body.followerUid });
      }

      case 'decline': {
        const batch = adminDb.batch();
        const followDocId = `${body.followerUid}_${targetUid}`;
        batch.delete(ownerRef.collection('friendRequests').doc(body.followerUid));
        batch.delete(ownerRef.collection('followRequests').doc(body.followerUid));
        batch.delete(adminDb.collection('follows').doc(followDocId));
        batch.delete(adminDb.collection('follower_requests').doc(followDocId));
        await batch.commit();
        return NextResponse.json({ success: true, declinedUid: body.followerUid });
      }

      case 'approve_all': {
        const pendingUids = await getAllPendingUids();
        for (const fUid of pendingUids) {
          await approveSingleFollower(fUid);
        }
        return NextResponse.json({ success: true, approvedCount: pendingUids.length });
      }

      case 'decline_all': {
        const pendingUids = await getAllPendingUids();
        const batch = adminDb.batch();
        pendingUids.forEach((fUid) => {
          const followDocId = `${fUid}_${targetUid}`;
          batch.delete(ownerRef.collection('friendRequests').doc(fUid));
          batch.delete(ownerRef.collection('followRequests').doc(fUid));
          batch.delete(adminDb.collection('follows').doc(followDocId));
          batch.delete(adminDb.collection('follower_requests').doc(followDocId));
        });
        if (pendingUids.length > 0) await batch.commit();
        return NextResponse.json({ success: true, declinedCount: pendingUids.length });
      }

      case 'remove_follower': {
        // Silently removes the follower without creating any notification
        const followerRef = adminDb.collection('users').doc(body.followerUid);
        const followDocId = `${body.followerUid}_${targetUid}`;
        await adminDb.runTransaction(async (tx) => {
          const [oSnap, fSnap, hadFollower, hadFollowing, hadFriend] = await Promise.all([
            tx.get(ownerRef),
            tx.get(followerRef),
            tx.get(ownerRef.collection('followers').doc(body.followerUid)),
            tx.get(followerRef.collection('following').doc(targetUid)),
            tx.get(ownerRef.collection('friends').doc(body.followerUid)),
          ]);
          tx.delete(ownerRef.collection('followers').doc(body.followerUid));
          tx.delete(followerRef.collection('following').doc(targetUid));
          tx.delete(ownerRef.collection('friends').doc(body.followerUid));
          tx.delete(followerRef.collection('friends').doc(targetUid));
          tx.delete(adminDb.collection('follows').doc(followDocId));
          tx.delete(adminDb.collection('follower_requests').doc(followDocId));

          const oData = oSnap.data() || {};
          const fData = fSnap.data() || {};
          tx.set(
            ownerRef,
            {
              ...(hadFollower.exists ? { followersCount: Math.max(0, Number(oData.followersCount || 0) - 1) } : {}),
              ...(hadFriend.exists ? { friendsCount: Math.max(0, Number(oData.friendsCount || 0) - 1) } : {}),
            },
            { merge: true }
          );
          tx.set(
            followerRef,
            {
              ...(hadFollowing.exists ? { followingCount: Math.max(0, Number(fData.followingCount || 0) - 1) } : {}),
              ...(hadFriend.exists ? { friendsCount: Math.max(0, Number(fData.friendsCount || 0) - 1) } : {}),
            },
            { merge: true }
          );
        });
        return NextResponse.json({ success: true, removedUid: body.followerUid });
      }

      case 'block_user': {
        if (body.targetUid === targetUid) {
          return NextResponse.json({ error: 'You cannot block your own account.' }, { status: 400 });
        }
        const targetProfileSnap = await adminDb.collection('users').doc(body.targetUid).get();
        const tData = targetProfileSnap.exists ? targetProfileSnap.data() || {} : {};
        const blockName = body.name || tData.name || 'User';
        const blockHandle = body.handle || tData.handle || 'user';
        const blockAvatar = tData.avatarUrl || '';

        const followDocId = `${body.targetUid}_${targetUid}`;
        const batch = adminDb.batch();

        // Mark canonical follow relationship as BLOCKED
        batch.set(
          adminDb.collection('follows').doc(followDocId),
          {
            id: followDocId,
            followerId: body.targetUid,
            targetUserId: targetUid,
            status: 'BLOCKED',
            followerName: blockName,
            followerHandle: blockHandle,
            followerAvatar: blockAvatar,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Add to owner's blockedUsers subcollection & clean up any pending request or active friendship
        batch.set(ownerRef.collection('blockedUsers').doc(body.targetUid), {
          uid: body.targetUid,
          name: blockName,
          handle: blockHandle,
          avatarUrl: blockAvatar,
          timestamp: FieldValue.serverTimestamp(),
        });
        batch.delete(ownerRef.collection('friendRequests').doc(body.targetUid));
        batch.delete(ownerRef.collection('friends').doc(body.targetUid));
        batch.delete(adminDb.collection('users').doc(body.targetUid).collection('friends').doc(targetUid));

        await batch.commit();
        return NextResponse.json({ success: true, status: 'BLOCKED', blockedUid: body.targetUid });
      }

      case 'unblock_user': {
        const batch = adminDb.batch();
        batch.delete(ownerRef.collection('blockedUsers').doc(body.targetUid));
        batch.delete(adminDb.collection('follows').doc(`${body.targetUid}_${targetUid}`));
        await batch.commit();
        return NextResponse.json({ success: true, unblockedUid: body.targetUid });
      }
    }
  } catch (error) {
    console.error('[POST /api/privacy/followers] Error:', error);
    return NextResponse.json({ error: 'Could not process follower privacy action.' }, { status: 500 });
  }
}
