import { NextRequest, NextResponse } from 'next/server';
import { getPaymentIntent, toStableBytes32 } from '@/app/lib/payment-intents-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const intent = getPaymentIntent(id);

  if (!intent) {
    console.warn('[PaymentIntentIdentity] POS status lookup failed', {
      requestedPaymentIntentId: id,
      lookupKey: id
    });
    return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 });
  }

  const paymentIntentIdBytes32 = toStableBytes32(intent.id);
  const orderIdBytes32 = toStableBytes32(intent.orderId);
  console.log('[PaymentIntentIdentity] POS status lookup succeeded', {
    requestedPaymentIntentId: id,
    paymentIntentId: intent.id,
    paymentRef: intent.id,
    orderId: intent.orderId,
    amountMUSD: intent.amountMUSD,
    status: intent.status,
    createdAt: intent.createdAt,
    paymentIntentIdBytes32,
    orderIdBytes32
  });

  return NextResponse.json({
    ...intent,
    paymentRef: intent.id,
    paymentIntentIdBytes32,
    orderIdBytes32
  });
}
