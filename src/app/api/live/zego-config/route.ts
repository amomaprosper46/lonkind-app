import { NextResponse } from 'next/server';
import { ZEGO_APP_ID, isValidZegoSecret } from '@/lib/zego';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET() {
  const envSecret = process.env.ZEGO_SERVER_SECRET;
  const isConfigured = isValidZegoSecret(envSecret);

  return NextResponse.json({
    appId: ZEGO_APP_ID,
    configured: isConfigured,
  });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDoc = await adminDb.collection('admins').doc(decoded.uid).get();
    const isAdmin = adminDoc.exists || decoded.email === 'admin@lonkind.com';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { serverSecret } = await req.json();

    if (!isValidZegoSecret(serverSecret)) {
      return NextResponse.json(
        { error: 'Invalid ServerSecret format. It must be exactly 32 alphanumeric characters.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, configured: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
