import { NextRequest, NextResponse } from 'next/server';
import { autonomousNewsReporter } from '@/ai/flows/news-reporter';

export async function POST(req: NextRequest) {
  try {
    const result = await autonomousNewsReporter();
    return NextResponse.json({ success: true, message: 'Autonomous News Reporter published successfully!', ...result });
  } catch (error: any) {
    console.error('News reporter AI error:', error);
    return NextResponse.json(
      { error: error?.message || 'AI news reporter service failed.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const result = await autonomousNewsReporter();
    return NextResponse.json({ success: true, message: 'Autonomous News Reporter published successfully via GET trigger!', ...result });
  } catch (error: any) {
    console.error('News reporter AI error:', error);
    return NextResponse.json(
      { error: error?.message || 'AI news reporter service failed.' },
      { status: 500 }
    );
  }
}
