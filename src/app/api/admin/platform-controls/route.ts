import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifySuperAdminRequest } from '@/lib/admin-auth';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

async function verifyLonkindAdmin(req: NextRequest): Promise<{ uid: string; email?: string } | null> {
  const result = await verifySuperAdminRequest(req);
  if (!result.authorized) return null;
  return { uid: result.uid, email: result.email };
}

export async function GET() {
  try {
    const [eventsSnap, giftOverridesSnap] = await Promise.all([
      adminDb.collection('platform_settings').doc('events').get(),
      adminDb.collection('platform_settings').doc('gift_overrides').get(),
    ]);

    return NextResponse.json({
      success: true,
      events: eventsSnap.exists ? eventsSnap.data() : {
        eventActive: false,
        eventName: 'Lonkind Creator Festival',
        eventBannerText: 'Special Event Live! Send a Free Event Gift today!',
        freeGiftId: 'rose',
        freeGiftDailyLimit: 1,
      },
      giftOverrides: giftOverridesSnap.exists ? giftOverridesSnap.data() : {},
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load platform controls' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminUser = await verifyLonkindAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized: Lonkind Admin access required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // 1. Set Free Gift of the Day / Active Event Configuration
    if (action === 'set_event_config') {
      const {
        eventActive,
        eventName,
        eventBannerText,
        freeGiftId,
        freeGiftDailyLimit,
      } = body;

      const payload = {
        eventActive: Boolean(eventActive),
        eventName: String(eventName || 'Lonkind Special Event').trim(),
        eventBannerText: String(eventBannerText || '').trim(),
        freeGiftId: String(freeGiftId || 'rose'),
        freeGiftDailyLimit: Math.max(1, Number(freeGiftDailyLimit) || 1),
        updatedBy: adminUser.uid,
        updatedAt: FieldValue.serverTimestamp(),
      };

      await adminDb.collection('platform_settings').doc('events').set(payload, { merge: true });

      return NextResponse.json({
        success: true,
        message: payload.eventActive
          ? `Event "${payload.eventName}" is now LIVE with Free Gift: ${payload.freeGiftId.toUpperCase()}!`
          : 'Event & Free Gift mode has been turned off.',
        events: payload,
      });
    }

    // 2. Grant Event Coins / Diamonds / Free Gift Drop to a specific user or all users
    if (action === 'grant_event_reward') {
      const { targetIdentifier, rewardType, amount, reason, broadcastToAll } = body;
      const numAmount = Math.floor(Number(amount) || 0);
      if (numAmount <= 0 || numAmount > 1_000_000) {
        return NextResponse.json({ error: 'Amount must be between 1 and 1,000,000.' }, { status: 400 });
      }

      const fieldToIncrement = rewardType === 'diamonds' ? 'diamonds' : 'coins';

      if (broadcastToAll) {
        const usersSnap = await adminDb.collection('users').limit(400).get();
        const batch = adminDb.batch();
        usersSnap.docs.forEach((uDoc) => {
          batch.update(uDoc.ref, {
            [fieldToIncrement]: FieldValue.increment(numAmount),
          });
        });
        await batch.commit();

        await adminDb.collection('wallet_audit_logs').add({
          type: 'admin_event_drop_all',
          userId: 'ALL_USERS',
          diamondAmount: rewardType === 'diamonds' ? numAmount : 0,
          coinAmount: rewardType === 'coins' ? numAmount : 0,
          details: `Lonkind Admin Event Drop (+${numAmount} ${fieldToIncrement}) to ${usersSnap.size} users: ${reason || 'Special Event'}`,
          timestamp: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({
          success: true,
          message: `Successfully dropped +${numAmount.toLocaleString()} ${fieldToIncrement} to ${usersSnap.size} users!`,
        });
      }

      const cleanTarget = String(targetIdentifier || '').trim().replace(/^@/, '');
      if (!cleanTarget) {
        return NextResponse.json({ error: 'Please enter a user @handle, email, or UID.' }, { status: 400 });
      }

      let targetDoc = await adminDb.collection('users').doc(cleanTarget).get();
      if (!targetDoc.exists) {
        const byHandle = await adminDb.collection('users').where('handle', '==', cleanTarget.toLowerCase()).limit(1).get();
        if (!byHandle.empty) {
          targetDoc = byHandle.docs[0];
        } else {
          const byEmail = await adminDb.collection('users').where('email', '==', cleanTarget.toLowerCase()).limit(1).get();
          if (!byEmail.empty) {
            targetDoc = byEmail.docs[0];
          }
        }
      }

      if (!targetDoc.exists) {
        return NextResponse.json({ error: `User "${cleanTarget}" not found.` }, { status: 404 });
      }

      await targetDoc.ref.update({
        [fieldToIncrement]: FieldValue.increment(numAmount),
      });

      const targetData = targetDoc.data() || {};

      // Send an official notification from Lonkind
      await targetDoc.ref.collection('notifications').add({
        type: 'new_message',
        fromUser: {
          uid: adminUser.uid,
          name: 'Lonkind',
          handle: 'lonkind',
          avatarUrl: 'https://impactful-ideas.web.app/logo.png',
        },
        messageSnippet: `🎁 Lonkind Event Reward: You received +${numAmount.toLocaleString()} ${fieldToIncrement.toUpperCase()}! (${reason || 'Admin Event Gift'})`,
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      });

      await adminDb.collection('wallet_audit_logs').add({
        type: 'admin_grant',
        userId: targetDoc.id,
        diamondAmount: rewardType === 'diamonds' ? numAmount : 0,
        coinAmount: rewardType === 'coins' ? numAmount : 0,
        details: `Admin granted +${numAmount} ${fieldToIncrement} to @${targetData.handle || targetDoc.id}: ${reason || 'Admin Grant'}`,
        timestamp: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        message: `Granted +${numAmount.toLocaleString()} ${fieldToIncrement} to ${targetData.name || cleanTarget} (@${targetData.handle || ''})!`,
      });
    }

    // 3. Update User Permissions & Badges (Verified Checkmark, Badges, Moderator/Admin role)
    if (action === 'update_user_permissions') {
      const { targetIdentifier, isProfessional, isAdmin, badgeToToggle } = body;
      const cleanTarget = String(targetIdentifier || '').trim().replace(/^@/, '');
      if (!cleanTarget) {
        return NextResponse.json({ error: 'Please enter a user @handle, email, or UID.' }, { status: 400 });
      }

      let targetDoc = await adminDb.collection('users').doc(cleanTarget).get();
      if (!targetDoc.exists) {
        const byHandle = await adminDb.collection('users').where('handle', '==', cleanTarget.toLowerCase()).limit(1).get();
        if (!byHandle.empty) {
          targetDoc = byHandle.docs[0];
        } else {
          const byEmail = await adminDb.collection('users').where('email', '==', cleanTarget.toLowerCase()).limit(1).get();
          if (!byEmail.empty) {
            targetDoc = byEmail.docs[0];
          }
        }
      }

      if (!targetDoc.exists) {
        return NextResponse.json({ error: `User "${cleanTarget}" not found.` }, { status: 404 });
      }

      const currentData = targetDoc.data() || {};
      const updates: Record<string, any> = {};

      if (typeof isProfessional === 'boolean') {
        updates.isProfessional = isProfessional;
      }
      if (typeof isAdmin === 'boolean') {
        updates.isAdmin = isAdmin;
        if (isAdmin) {
          await adminDb.collection('admins').doc(targetDoc.id).set({ addedAt: new Date(), addedBy: adminUser.uid }, { merge: true });
        } else if (targetDoc.id !== adminUser.uid) {
          await adminDb.collection('admins').doc(targetDoc.id).delete().catch(() => {});
        }
      }
      if (badgeToToggle) {
        const currentBadges: string[] = Array.isArray(currentData.badges) ? currentData.badges : [];
        if (currentBadges.includes(badgeToToggle)) {
          updates.badges = currentBadges.filter((b) => b !== badgeToToggle);
        } else {
          updates.badges = [...currentBadges, badgeToToggle];
        }
      }

      await targetDoc.ref.update(updates);

      return NextResponse.json({
        success: true,
        message: `Updated permissions & badges for ${currentData.name || cleanTarget} (@${currentData.handle || ''}).`,
        updatedFields: updates,
      });
    }

    // 4. Save Custom or AI-Generated Gift Video URL to Live Catalog Overrides
    if (action === 'save_gift_video') {
      const { giftId, videoUrl } = body;
      if (!giftId || !videoUrl) {
        return NextResponse.json({ error: 'giftId and videoUrl are required.' }, { status: 400 });
      }

      await adminDb.collection('platform_settings').doc('gift_overrides').set(
        {
          [giftId]: {
            videoUrl: String(videoUrl).trim(),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: adminUser.uid,
          },
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        message: `Gift video for "${giftId.toUpperCase()}" is now live across all streams!`,
      });
    }

    // 5. Generate 3D CGI Gift Video via Google Veo 2 / Gemini Video API or fal.ai Kling/Luma
    if (action === 'generate_ai_gift_video') {
      const { giftId, prompt, engine = 'veo2' } = body;
      if (!prompt) {
        return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
      }

      const fullCgiPrompt = `3D Unreal Engine 5 cinematic virtual gift animation: ${prompt}. Isolated in the center of a pure pitch-black #000000 void background, volumetric gold and neon lighting, glowing magical particles, no floor, no background clutter, ultra-detailed 60fps game reward VFX.`;

      // Option A: fal.ai (Kling / Luma Ray 2) if FAL_KEY is configured
      const falKey = process.env.FAL_KEY;
      if (engine === 'fal' && falKey) {
        const falRes = await fetch('https://fal.run/fal-ai/luma-dream-machine', {
          method: 'POST',
          headers: {
            Authorization: `Key ${falKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: fullCgiPrompt,
            aspect_ratio: '9:16',
          }),
        });
        const falData = await falRes.json();
        const generatedUrl = falData?.video?.url || falData?.url;
        if (!falRes.ok || !generatedUrl) {
          throw new Error(falData?.detail || falData?.error || 'fal.ai video generation failed.');
        }
        return NextResponse.json({
          success: true,
          videoUrl: generatedUrl,
          giftId,
          promptUsed: fullCgiPrompt,
        });
      }

      // Option B: Google Veo 2 (`veo-2.0-generate-001`) via Gemini API Key
      const geminiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return NextResponse.json(
          {
            error:
              'NoGOOGLE_GENAI_API_KEY or FAL_KEY found in environment variables. You can add GOOGLE_GENAI_API_KEY (for Google Veo 2) or FAL_KEY (for Kling/Luma), or upload any MP4/WebM gift video directly below!',
          },
          { status: 400 }
        );
      }

      const veoStartRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: fullCgiPrompt }],
            parameters: {
              aspectRatio: '9:16',
              sampleCount: 1,
              durationSeconds: 5,
            },
          }),
        }
      );

      const veoStartData = await veoStartRes.json();
      if (!veoStartRes.ok || !veoStartData.name) {
        throw new Error(
          veoStartData?.error?.message ||
            'Google Veo 2 API requires billing/access enabled on your GOOGLE_GENAI_API_KEY, or you can upload an MP4/WebM directly.'
        );
      }

      // Poll up to 45 seconds for operation completion
      const opName = veoStartData.name;
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${geminiKey}`
        );
        const pollData = await pollRes.json();
        if (pollData.done) {
          const videoUri =
            pollData?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
            pollData?.response?.videos?.[0]?.uri;
          if (videoUri) {
            const finalUrl = videoUri.includes('?')
              ? `${videoUri}&key=${geminiKey}`
              : `${videoUri}?key=${geminiKey}`;
            return NextResponse.json({
              success: true,
              videoUrl: finalUrl,
              giftId,
              promptUsed: fullCgiPrompt,
            });
          }
          throw new Error('Veo 2 finished but returned no video URI.');
        }
      }

      return NextResponse.json(
        {
          error: 'Video generation is still processing on Google Veo 2. Please try again in a moment.',
        },
        { status: 202 }
      );
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[platform-controls] POST error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
