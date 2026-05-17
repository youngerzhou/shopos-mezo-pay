import { NextRequest, NextResponse } from 'next/server';
import { getAddress } from 'viem';
import { getSetting } from '@/app/lib/db';
import { createPaymentIntent, toStableBytes32 } from '@/app/lib/payment-intents-store';
import { MUSD_ADDRESSES } from '@/app/lib/mezo-config';
import { roundMoney2 } from '@/app/lib/money';

export const dynamic = 'force-dynamic';

function getMerchantWallet(value: string) {
  return getAddress(value);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const amountUsd = roundMoney2(Number(body.amountUsd));
    const amountMUSD = roundMoney2(Number(body.amountMUSD));

    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json({ error: 'amountUsd must be greater than 0' }, { status: 400 });
    }
    if (!Number.isFinite(amountMUSD) || amountMUSD <= 0) {
      return NextResponse.json({ error: 'amountMUSD must be greater than 0' }, { status: 400 });
    }

    const merchantWallet = getMerchantWallet(
      process.env.SHOPOS_MERCHANT_WALLET?.trim() ||
      process.env.NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET?.trim() ||
      await getSetting('Merchant_Wallet_Address', '0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7')
    );
    const intent = createPaymentIntent({ amountUsd, amountMUSD, merchantWallet });
    const paymentIntentIdBytes32 = toStableBytes32(intent.id);
    const orderIdBytes32 = toStableBytes32(intent.orderId);
    const qrParams = new URLSearchParams({
      paymentIntentId: intent.id,
      orderId: intent.orderId,
      paymentIntentIdBytes32,
      orderIdBytes32,
      merchant: intent.merchantWallet,
      token: 'MUSD',
      amount: intent.amountMUSD.toFixed(2),
      network: 'mezo-testnet'
    });
    const qrPayload = `https://shopos-mezo-pay.vercel.app/customer-pay?${qrParams.toString()}`;
    console.log('[PaymentIntentIdentity] QR URL generated', {
      paymentIntentId: intent.id,
      paymentRef: intent.id,
      orderId: intent.orderId,
      amount: intent.amountMUSD,
      status: intent.status,
      createdAt: intent.createdAt,
      paymentIntentIdBytes32,
      orderIdBytes32,
      qrPayload
    });

    return NextResponse.json({
      paymentIntentId: intent.id,
      paymentRef: intent.id,
      orderId: intent.orderId,
      amountUsd: intent.amountUsd,
      amountMUSD: intent.amountMUSD,
      token: intent.token,
      network: intent.network,
      merchantWallet: intent.merchantWallet,
      status: intent.status,
      qrPayload,
      expiresAt: intent.expiresAt,
      paymentIntentIdBytes32,
      orderIdBytes32,
      musdTokenAddress: MUSD_ADDRESSES.testnet
    });
  } catch (error: any) {
    console.error('API POST /api/pos/payment-intents Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to create payment intent' }, { status: 500 });
  }
}
