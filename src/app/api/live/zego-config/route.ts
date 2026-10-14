import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ZEGO_APP_ID, isValidZegoSecret, DEFAULT_ZEGO_SERVER_SECRET } from '@/lib/zego';

export async function GET() {
  const envSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || process.env.ZEGO_SERVER_SECRET || DEFAULT_ZEGO_SERVER_SECRET;
  const isConfigured = isValidZegoSecret(envSecret);

  return NextResponse.json({
    appId: ZEGO_APP_ID,
    configured: isConfigured,
    // Provide serverSecret to client if configured in server env
    serverSecret: isConfigured ? envSecret : null,
  });
}

export async function POST(req: Request) {
  try {
    const { serverSecret } = await req.json();

    if (!isValidZegoSecret(serverSecret)) {
      return NextResponse.json(
        { error: 'Invalid ServerSecret format. It must be exactly 32 alphanumeric characters.' },
        { status: 400 }
      );
    }

    const cleanSecret = serverSecret.trim();

    // Persist to .env.local if possible
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('NEXT_PUBLIC_ZEGO_SERVER_SECRET=')) {
          envContent = envContent.replace(
            /NEXT_PUBLIC_ZEGO_SERVER_SECRET=.*/g,
            `NEXT_PUBLIC_ZEGO_SERVER_SECRET=${cleanSecret}`
          );
        } else {
          envContent += `\nNEXT_PUBLIC_ZEGO_SERVER_SECRET=${cleanSecret}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
    } catch (e) {
      console.warn('Could not update .env.local:', e);
    }

    return NextResponse.json({ success: true, serverSecret: cleanSecret });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
