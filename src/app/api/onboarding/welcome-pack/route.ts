import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const FALLBACK_ADMIN_UID = '7KTSOaVtOGepngVE7LO3prZvzuo1';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    if (!uid) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
    }

    const dbInstance = adminDb;
    const userRef = dbInstance.collection('users').doc(uid);

    // Resolve the official Lonkind admin account (by name == 'Lonkind' or handle == 'lonkind')
    let adminUid = FALLBACK_ADMIN_UID;
    try {
      const byHandle = await dbInstance.collection('users').where('handle', '==', 'lonkind').limit(1).get();
      if (!byHandle.empty) {
        adminUid = byHandle.docs[0].id;
      } else {
        const byName = await dbInstance.collection('users').where('name', '==', 'Lonkind').limit(1).get();
        if (!byName.empty) {
          adminUid = byName.docs[0].id;
        }
      }
    } catch (_) {}

    if (uid === adminUid) {
      return NextResponse.json({ success: true, skippedAdmin: true });
    }

    const adminRef = dbInstance.collection('users').doc(adminUid);
    let grantedNow = false;

    await dbInstance.runTransaction(async (tx: any) => {
      const [userSnap, adminSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(adminRef),
      ]);

      const userData = userSnap.exists ? userSnap.data() : {};
      if (
        userData?.welcomePackClaimed ||
        userData?.name?.trim()?.toLowerCase() === 'lonkind' ||
        userData?.handle?.toLowerCase() === 'lonkind'
      ) {
        return;
      }

      grantedNow = true;

      const adminData = adminSnap.exists
        ? adminSnap.data()
        : {
            name: 'Lonkind',
            handle: 'lonkind',
            avatarUrl: 'https://impactful-ideas.web.app/logo.png',
          };

      const adminName = adminData?.name || 'Lonkind';
      const adminHandle = adminData?.handle || 'lonkind';
      const adminAvatar = adminData?.avatarUrl || 'https://impactful-ideas.web.app/logo.png';

      // 1. Mark welcome pack claimed and increment new user's followingCount (+1 for following @lonkind) — NO free coins
      tx.set(
        userRef,
        {
          followingCount: FieldValue.increment(1),
          welcomePackClaimed: true,
          welcomePackClaimedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Have the new user automatically follow @lonkind so they see official posts & live streams
      const userFollowingAdminRef = userRef.collection('following').doc(adminUid);
      tx.set(userFollowingAdminRef, {
        uid: adminUid,
        name: adminName,
        handle: adminHandle,
        avatarUrl: adminAvatar,
        followedAt: FieldValue.serverTimestamp(),
      });

      const adminFollowerRef = adminRef.collection('followers').doc(uid);
      tx.set(adminFollowerRef, {
        uid,
        name: userData?.name || decoded.name || 'New Creator',
        handle: userData?.handle || 'creator',
        avatarUrl: userData?.avatarUrl || decoded.picture || '',
        followedAt: FieldValue.serverTimestamp(),
      });

      tx.set(
        adminRef,
        {
          followersCount: FieldValue.increment(1),
        },
        { merge: true }
      );

      // 3. Create Welcome Notification in users/{uid}/notifications
      const notifRef = userRef.collection('notifications').doc(`welcome_${uid}`);
      tx.set(notifRef, {
        type: 'new_message',
        fromUser: {
          uid: adminUid,
          name: adminName,
          handle: adminHandle,
          avatarUrl: adminAvatar,
        },
        messageSnippet: 'Welcome to Lonkind! 🎉 Connect with creators, watch live streams, and share your ideas.',
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });

      // 4. Create Welcome Direct Message in conversations
      const sortedUids = [adminUid, uid].sort();
      const convId = `${sortedUids[0]}_${sortedUids[1]}`;
      const convRef = dbInstance.collection('conversations').doc(convId);
      const welcomeText =
        'Welcome to Lonkind! 🎉 Connect with inspiring creators, join live streams, and share your ideas with the community.';

      tx.set(
        convRef,
        {
          participantUids: sortedUids,
          participants: [
            {
              uid: adminUid,
              name: adminName,
              handle: adminHandle,
              avatarUrl: adminAvatar,
            },
            {
              uid,
              name: userData?.name || decoded.name || 'New Creator',
              handle: userData?.handle || 'creator',
              avatarUrl: userData?.avatarUrl || decoded.picture || '',
            },
          ],
          lastMessage: {
            text: welcomeText,
            senderId: adminUid,
            timestamp: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const msgRef = convRef.collection('messages').doc(`welcome_msg_${uid}`);
      tx.set(msgRef, {
        senderId: adminUid,
        text: welcomeText,
        type: 'text',
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });
    });

    return NextResponse.json({
      success: true,
      grantedNow,
    });
  } catch (error: any) {
    console.error('[Welcome Pack API Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
