import { NextRequest, NextResponse } from 'next/server';
import { getWebhookLogs } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const logs = await getWebhookLogs(50);
    return NextResponse.json(logs || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
