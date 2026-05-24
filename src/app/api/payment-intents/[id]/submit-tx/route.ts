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
      // Transaction reverted on-chain. Try to extract the revert reason for debugging.
      const revertReason = receipt.logs?.length === 0
        ? 'Transaction reverted (no logs emitted)'
        : `Transaction reverted (status=${receipt.status})`;
      console.error('[submit-tx] On-chain revert detected:', {
        txHash,
        paymentIntentId: id,
        revertReason,
        blockNumber: receipt.blockNumber?.toString(),
        gasUsed: receipt.gasUsed?.toString()
      });
      return NextResponse.json({ error: revertReason, status: 'failed' }, { status: 400 });
    }

    // Transaction succeeded on-chain. Now attempt backend indexing.
    const result = await processMusdOrderPaidWebhook(
      receipt.logs.map((log) => ({
        ...log,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber)
      }))
    );
    const confirmedIntent = result.confirmed.find((item: any) => item.id === id) || result.confirmed[0] || null;

    if (!confirmedIntent) {
      // Re-check DB — Goldsky webhook may have already confirmed it
      const latestIntent = await getPaymentIntent(id);
      if (latestIntent?.status === 'confirmed') {
        return NextResponse.json({ status: latestIntent.status, paymentIntent: latestIntent, txHash });
      }
      // Indexing failed but tx is confirmed on-chain. Return 202 so the frontend
      // treats this as 'pending' and lets Goldsky webhook handle final confirmation.
      // Do NOT return 400 here — the money has already moved.
      console.warn('[submit-tx] Backend indexing failed but tx confirmed on-chain:', {
        txHash,
        paymentIntentId: id,
        webhookErrors: result.errors
      });
      return NextResponse.json({
        status: 'pending',
        message: 'Transaction confirmed on-chain. Awaiting Goldsky webhook indexing.',
        txHash,
        webhookErrors: result.errors
      }, { status: 202 });
    }

    return NextResponse.json({
      status: confirmedIntent.status,
      paymentIntent: confirmedIntent,
      txHash
    });
  } catch (error: any) {
    const message = error?.message || 'Waiting for blockchain confirmation';
    const isPending = /not found|could not find|transaction receipt/i.test(message);
    console.warn('[submit-tx] getTransactionReceipt error:', {
      txHash,
      paymentIntentId: id,
      isPending,
      error: message
    });
    // RPC couldn't find the receipt yet — return 202 (pending), not 500
    return NextResponse.json({
      status: 'pending',
      message: isPending ? 'Waiting for blockchain confirmation' : 'RPC error — Goldsky webhook will confirm',
      details: message
    }, { status: 202 });
  }
}
