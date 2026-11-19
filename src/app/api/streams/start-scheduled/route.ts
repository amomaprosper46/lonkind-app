import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb, adminMessaging } from '@/lib/firebase-admin';

const StartScheduledSchema = z.object({
  scheduleId: z.string().min(1),
  streamTitle: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(40).optional(),
  coverUrl: z.string().optional().nullable(),
  visibility: z.enum(['public', 'followers']).optional(),
  allowChat: z.boolean().optional(),
  allowGifts: z.boolean().optional(),
  allowCoHostRequests: z.boolean().optional(),
});

/**
 * POST /api/streams/start-scheduled
 * Called when a creator launches a scheduled live broadcast:
 *  1. Marks `scheduled_streams/{scheduleId}` as `status: 'LIVE'`
 *  2. Creates/activates the room in `streams/{roomId}` and `live_streams/{roomId}`
 *  3. Dispatches In-App notifications (`users/{uid}/notifications`) + FCM Web Push
 *     to every user in `scheduled_streams/{scheduleId}/reminders`.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Sign in to start your scheduled live.' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const callerUid = decoded.uid;

    const rawBody = await req.json().catch(() => null);
    const parsed = StartScheduledSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid start-scheduled payload.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      scheduleId,
      streamTitle,
      category,
      coverUrl,
      visibility,
      allowChat,
      allowGifts,
      allowCoHostRequests,
    } = parsed.data;

    const scheduleRef = adminDb.collection('scheduled_streams').doc(scheduleId);
    const scheduleSnap = await scheduleRef.get();
    if (!scheduleSnap.exists) {
      return NextResponse.json({ error: 'Scheduled stream not found.' }, { status: 404 });
    }

    const scheduleData = scheduleSnap.data() || {};
    const hostId = String(scheduleData.hostId || '');

    // Verify caller owns this scheduled stream (or is admin)
    if (hostId !== callerUid) {
      const callerSnap = await adminDb.collection('users').doc(callerUid).get();
      const callerData = callerSnap.data() || {};
      const isCallerAdmin =
        callerData.isAdmin === true ||
        callerData.handle === 'lonkind' ||
        callerData.handle === 'admin_lonkind' ||
        callerData.email === 'admin@lonkind.com';

      if (!isCallerAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Only the host can start this scheduled stream.' },
          { status: 403 }
        );
      }
    }

    // Load fresh host profile for accurate @handle / avatar in notifications
    const hostUserSnap = await adminDb.collection('users').doc(hostId).get();
    const hostUser = hostUserSnap.data() || {};
    const hostName = String(hostUser.name || scheduleData.hostName || 'Lonkind Creator');
    const hostHandle = String(
      hostUser.handle ||
        scheduleData.hostHandle ||
        hostName.toLowerCase().replace(/[^a-z0-9_]/g, '') ||
        'creator'
    );
    const hostAvatar = String(hostUser.avatarUrl || scheduleData.hostAvatar || '');

    const finalTitle = (streamTitle || scheduleData.title || `${hostName}'s Live Stream`).trim();
    const finalCategory = (category || scheduleData.category || 'chat').trim();
    const finalCoverUrl = coverUrl ?? scheduleData.coverUrl ?? null;
    const roomId = `live_${hostId}`;

    // 1. Mark scheduled stream as LIVE
    await scheduleRef.set(
      {
        status: 'LIVE',
        title: finalTitle,
        category: finalCategory,
        ...(finalCoverUrl ? { coverUrl: finalCoverUrl } : {}),
        streamId: roomId,
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 2. Create/activate the room in both `streams/{roomId}` and `live_streams/{roomId}`
    const streamPayload = {
      roomId,
      hostUid: hostId,
      hostName,
      hostHandle,
      hostAvatar,
      title: finalTitle,
      category: finalCategory,
      thumbnailUrl: finalCoverUrl,
      visibility: visibility || 'public',
      allowChat: allowChat ?? true,
      allowGifts: allowGifts ?? true,
      allowCoHostRequests: allowCoHostRequests ?? true,
      scheduledStreamId: scheduleId,
      status: 'active',
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await Promise.all([
      adminDb.collection('streams').doc(roomId).set(streamPayload, { merge: true }),
      adminDb
        .collection('live_streams')
        .doc(roomId)
        .set(
          {
            ...streamPayload,
            viewerCount: 1,
          },
          { merge: true }
        ),
    ]);

    // 3. Fetch all subscribed users from `scheduled_streams/{scheduleId}/reminders`
    const remindersSnap = await scheduleRef.collection('reminders').get();
    const notificationHeadline = `🔴 @${hostHandle} is LIVE now!`;
    const notificationBody = `@${hostHandle} is LIVE now: ${finalTitle}!`;

    let notifiedInAppCount = 0;
    let notifiedPushCount = 0;
    const fcmTokensSet = new Set<string>();
    const fallbackUserIds: string[] = [];

    const subscriberDocs = remindersSnap.docs.filter((d) => d.id !== hostId);

    // Write in-app notifications in chunks of 450 (Firestore batch limit is 500)
    const BATCH_LIMIT = 450;
    for (let i = 0; i < subscriberDocs.length; i += BATCH_LIMIT) {
      const chunk = subscriberDocs.slice(i, i + BATCH_LIMIT);
      const batch = adminDb.batch();

      for (const remDoc of chunk) {
        const remData = remDoc.data() || {};
        const subscriberUid = String(remData.userId || remDoc.id);
        if (!subscriberUid) continue;

        if (typeof remData.fcmToken === 'string' && remData.fcmToken.trim().length > 10) {
          fcmTokensSet.add(remData.fcmToken.trim());
        } else {
          fallbackUserIds.push(subscriberUid);
        }

        const notifRef = adminDb
          .collection('users')
          .doc(subscriberUid)
          .collection('notifications')
          .doc(`sched_live_${scheduleId}`);

        batch.set(
          notifRef,
          {
            type: 'scheduled_live_started',
            scheduleId,
            streamId: roomId,
            hostUid: hostId,
            streamTitle: finalTitle,
            message: notificationBody,
            fromUser: {
              uid: hostId,
              name: hostName,
              handle: hostHandle,
              avatarUrl: hostAvatar,
            },
            read: false,
            timestamp: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        notifiedInAppCount++;
      }

      await batch.commit();
    }

    // Look up fallback FCM tokens on `users/{uid}` for subscribers who toggled before token refresh
    if (fallbackUserIds.length > 0) {
      const userRefs = fallbackUserIds.map((uid) => adminDb.collection('users').doc(uid));
      const userSnaps = await adminDb.getAll(...userRefs);
      for (const snap of userSnaps) {
        const tok = snap.data()?.fcmToken;
        if (typeof tok === 'string' && tok.trim().length > 10) {
          fcmTokensSet.add(tok.trim());
        }
      }
    }

    // 4. Dispatch FCM Web Push multicast notifications (max 500 tokens per batch)
    const fcmTokens = Array.from(fcmTokensSet);
    const FCM_LIMIT = 500;
    for (let i = 0; i < fcmTokens.length; i += FCM_LIMIT) {
      const tokenChunk = fcmTokens.slice(i, i + FCM_LIMIT);
      try {
        const fcmRes = await adminMessaging.sendEachForMulticast({
          tokens: tokenChunk,
          notification: {
            title: notificationHeadline,
            body: notificationBody,
          },
          webpush: {
            notification: {
              title: notificationHeadline,
              body: notificationBody,
              icon: hostAvatar || '/icon-192x192.png',
              badge: '/icon-192x192.png',
            },
            fcmOptions: {
              link: `/?view=live&host=${encodeURIComponent(hostId)}`,
            },
          },
          data: {
            type: 'scheduled_live_started',
            scheduleId,
            streamId: roomId,
            hostUid: hostId,
            hostHandle,
            streamTitle: finalTitle,
            url: `/?view=live&host=${encodeURIComponent(hostId)}`,
          },
        });
        notifiedPushCount += fcmRes.successCount;
      } catch (fcmErr) {
        console.warn('[POST /api/streams/start-scheduled] FCM multicast warning:', fcmErr);
      }
    }

    return NextResponse.json({
      success: true,
      roomId,
      scheduleId,
      notifiedInAppCount,
      notifiedPushCount,
      totalSubscribers: subscriberDocs.length,
    });
  } catch (err: any) {
    console.error('[POST /api/streams/start-scheduled] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to start scheduled stream and notify subscribers.' },
      { status: 500 }
    );
  }
}
