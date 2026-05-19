import { NextRequest, NextResponse } from 'next/server';
import { getAddress } from 'viem';
import { createPosOrder, ensureDb, getSetting } from '@/app/lib/db';
import { createPaymentIntent, toStableBytes32 } from '@/app/lib/payment-intents-store';
import { MUSD_ADDRESSES } from '@/app/lib/mezo-config';

export const dynamic = 'force-dynamic';

function claimUrl(origin: string, token: string) {
  return `${origin}/pos/orders/claim/${encodeURIComponent(token)}`;
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json();
    const mode = body.mode === 'pay_online' ? 'pay_online' : 'pay_at_counter';
    const order = await createPosOrder({
      shopId: 'STORE_A',
      customerReferralId: body.customer_referral_id,
      customerWallet: body.customer_wallet,
      couponId: body.coupon_id,
      passportLevel: body.passport_level,
      currency: 'MUSD',
      source: 'customer_self_order',
      fulfillmentType: 'pickup',
      fulfillmentStatus: 'pending',
      paymentStatus: mode === 'pay_online' ? 'pending' : 'unpaid',
      paymentMethod: mode === 'pay_online' ? 'musd_wallet' : 'counter',
      items: body.items
    });

    let paymentIntent = null;
    let paymentUrl = null;
    if (mode === 'pay_online') {
      const merchantWallet = getAddress(
        process.env.SHOPOS_MERCHANT_WALLET?.trim() ||
        process.env.NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET?.trim() ||
        await getSetting('Merchant_Wallet_Address', '0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7')
      );
      const intent = await createPaymentIntent({
        orderId: order.order_id,
        amountUsd: Number(order.total_amount),
        amountMUSD: Number(order.total_amount),
        merchantWallet
      });
      const paymentIntentIdBytes32 = toStableBytes32(intent.id);
      const orderIdBytes32 = toStableBytes32(intent.orderId);
      const params = new URLSearchParams({
        paymentIntentId: intent.id,
        orderId: intent.orderId,
        paymentIntentIdBytes32,
        orderIdBytes32,
        merchant: intent.merchantWallet,
        token: 'MUSD',
        amount: intent.amountMUSD.toFixed(2),
        network: 'mezo-testnet'
      });
      paymentUrl = `${req.nextUrl.origin}/customer/pay/${encodeURIComponent(intent.id)}?${params.toString()}`;
      paymentIntent = {
        paymentIntentId: intent.id,
        paymentRef: intent.id,
        orderId: intent.orderId,
        amountUsd: intent.amountUsd,
        amountMUSD: intent.amountMUSD,
        merchantWallet: intent.merchantWallet,
        status: intent.status,
        paymentIntentIdBytes32,
        orderIdBytes32,
        musdTokenAddress: MUSD_ADDRESSES.testnet
      };
    }

    return NextResponse.json({
      order,
      paymentIntent,
      paymentUrl,
      claimUrl: order.pickup_token ? claimUrl(req.nextUrl.origin, order.pickup_token) : null
    });
  } catch (error: any) {
    console.error('API POST /api/customer/orders Error:', error);
    const message = error.message || 'Unable to create customer order';
    const status =
      message.startsWith('Product not found') ? 404 :
      message.startsWith('Insufficient stock') ? 409 :
      message === 'Cart is empty' ? 400 :
      500;
    return NextResponse.json({ error: message }, { status });
  }
}
