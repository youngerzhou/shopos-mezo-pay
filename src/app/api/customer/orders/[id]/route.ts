import { NextResponse } from 'next/server';
import { ensureDb, getPosOrderById } from '@/app/lib/db';
import { findPaymentIntentByOrderId, toStableBytes32 } from '@/app/lib/payment-intents-store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureDb();
    const { id } = await params;
    const order = await getPosOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const url = new URL(req.url);
    const claimUrl = order.pickup_token
      ? `${url.origin}/pos/orders/claim/${encodeURIComponent(order.pickup_token)}`
      : null;
    const intent = await findPaymentIntentByOrderId(order.id);
    const paymentUrl = intent ? `${url.origin}/customer/pay/${encodeURIComponent(intent.id)}?${new URLSearchParams({
      paymentIntentId: intent.id,
      orderId: intent.orderId,
      paymentIntentIdBytes32: toStableBytes32(intent.id),
      orderIdBytes32: toStableBytes32(intent.orderId),
      merchant: intent.merchantWallet,
      token: 'MUSD',
      amount: intent.amountMUSD.toFixed(2),
      network: 'mezo-testnet'
    }).toString()}` : null;
    return NextResponse.json({ order, claimUrl, paymentUrl, paymentIntent: intent });
  } catch (error: any) {
    console.error('API GET /api/customer/orders/[id] Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to load order' }, { status: 500 });
  }
}
