import { NextRequest, NextResponse } from 'next/server';
import { getPaymentIntent, toStableBytes32 } from '@/app/lib/payment-intents-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const intent = getPaymentIntent(id);

  if (!intent) {
    return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...intent,
    paymentIntentIdBytes32: toStableBytes32(intent.id),
    orderIdBytes32: toStableBytes32(intent.orderId)
  });
}

