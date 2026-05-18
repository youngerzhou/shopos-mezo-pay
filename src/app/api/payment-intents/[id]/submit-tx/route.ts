import { NextRequest, NextResponse } from 'next/server';
import { publicClient } from '@/app/lib/mezo-config';
import { getPaymentIntent } from '@/app/lib/payment-intents-store';
import { processMusdOrderPaidWebhook } from '@/app/lib/musd-payment-webhook';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const intent = await getPaymentIntent(id);
  if (!intent) {
    return NextResponse.json({ error: 'Payment intent not found.' }, { status: 404 });
  }
  if (intent.status === 'confirmed') {
    return NextResponse.json({ status: intent.status, paymentIntent: intent, txHash: intent.txHash });
  }

  const body = await req.json().catch(() => ({}));
  const txHash = String(body.txHash || '').trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json({ error: 'Invalid txHash.' }, { status: 400 });
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Payment failed' }, { status: 400 });
    }

    const result = await processMusdOrderPaidWebhook(
      receipt.logs.map((log) => ({
        ...log,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber)
      }))
    );
    const confirmedIntent = result.confirmed.find((item: any) => item.id === id) || result.confirmed[0] || null;

    if (!confirmedIntent) {
      const latestIntent = await getPaymentIntent(id);
      if (latestIntent?.status === 'confirmed') {
        return NextResponse.json({ status: latestIntent.status, paymentIntent: latestIntent, txHash });
      }
      return NextResponse.json({
        error: result.errors[0] || 'Payment failed',
        handled: result.handled,
        errors: result.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      status: confirmedIntent.status,
      paymentIntent: confirmedIntent,
      txHash
    });
  } catch (error: any) {
    const message = error?.message || 'Waiting for blockchain confirmation';
    const pending = /not found|could not find|transaction receipt/i.test(message);
    return NextResponse.json({
      status: pending ? 'pending' : 'failed',
      error: pending ? 'Waiting for blockchain confirmation' : 'Payment failed',
      details: message
    }, { status: pending ? 202 : 500 });
  }
}
