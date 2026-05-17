import { NextRequest, NextResponse } from 'next/server';
import { processMusdOrderPaidWebhook } from '@/app/lib/musd-payment-webhook';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await processMusdOrderPaidWebhook(body);

    return NextResponse.json({
      success: result.errors.length === 0,
      processed: result.confirmed.length,
      confirmed: result.confirmed,
      errors: result.errors
    }, {
      status: result.errors.length > 0 && result.confirmed.length === 0 ? 400 : 200
    });
  } catch (error: any) {
    console.error('API POST /api/webhooks/goldsky/musd-payment Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to process MUSD payment webhook' }, { status: 500 });
  }
}
