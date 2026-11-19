import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const TicketPayloadSchema = z.object({
  email: z.string().email('Please provide a valid email address.'),
  category: z.string().min(2).max(60).optional(),
  subject: z.string().min(4, 'Subject must be at least 4 characters.').max(140),
  message: z.string().min(15, 'Message must be at least 15 characters.').max(3000),
});

/**
 * POST /api/support/ticket
 * Persists a Help & Support ticket to Firestore `support_tickets` with status: 'OPEN'.
 * Works for both authenticated Lonkind members and signed-out public visitors.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = TicketPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please complete all fields accurately.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let userId: string | null = null;
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        userId = decoded.uid;
      } catch {
        // Proceed as public visitor ticket if token expired
      }
    }

    const docRef = await adminDb.collection('support_tickets').add({
      userId: userId || 'guest',
      email: parsed.data.email.trim().toLowerCase(),
      category: parsed.data.category || 'General Support',
      subject: parsed.data.subject.trim(),
      message: parsed.data.message.trim(),
      status: 'OPEN',
      source: 'settings_support_hub',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      ticketId: docRef.id,
      status: 'OPEN',
    });
  } catch (err) {
    console.error('[POST /api/support/ticket] Error:', err);
    return NextResponse.json(
      { error: 'Unable to submit your support ticket right now. Please email support@lonkind.com.' },
      { status: 500 }
    );
  }
}
