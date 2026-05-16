import { NextRequest, NextResponse } from 'next/server';
import { createPosOrder, ensureDb, markPosOrderPaid } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await ensureDb();

    const body = await req.json();
    const order = await createPosOrder({
      shopId: body.shop_id,
      customerReferralId: body.customer_referral_id,
      customerWallet: body.customer_wallet,
      passportLevel: body.passport_level,
      currency: body.currency,
      items: body.items
    });

    return NextResponse.json(order);
  } catch (error: any) {
    const message = error.message || 'Unable to create POS order';
    const status =
      message.startsWith('Product not found') ? 404 :
      message.startsWith('Insufficient stock') ? 409 :
      message === 'Cart is empty' ? 400 :
      500;

    console.error('API POST /api/pos/orders Error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureDb();

    const body = await req.json();
    const orderId = body.order_id;
    const txHash = body.tx_hash;

    if (!orderId || !txHash) {
      return NextResponse.json({ error: 'Missing order_id or tx_hash' }, { status: 400 });
    }

    const result = await markPosOrderPaid(orderId, txHash);
    return NextResponse.json(result);
  } catch (error: any) {
    const message = error.message || 'Unable to update POS order';
    const status = message === 'POS order not found' ? 404 : 500;

    console.error('API PUT /api/pos/orders Error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
