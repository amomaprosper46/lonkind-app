import { NextResponse } from 'next/server';
import { getTermiiBalance } from '@/lib/termii';

export async function GET() {
  try {
    const result = await getTermiiBalance();
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to retrieve Termii balance' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      balance: result.balance,
      currency: result.currency,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
