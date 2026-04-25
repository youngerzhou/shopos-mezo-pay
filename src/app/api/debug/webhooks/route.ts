
import { NextRequest, NextResponse } from 'next/server';
import { getWebhookLogs } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const logs = await getWebhookLogs(50);
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('Debug API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
