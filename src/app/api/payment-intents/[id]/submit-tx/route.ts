import { NextRequest, NextResponse } from 'next/server';
import { decodeEventLog, formatUnits, hexToString, parseAbiItem } from 'viem';
import { publicClient } from '@/app/lib/mezo-config';
import { MUSD_ADDRESSES } from '@/app/lib/mezo-config';
import { getPaymentIntent, hasTxHash, markPaymentIntentConfirmed } from '@/app/lib/payment-intents-store';
import { processMusdOrderPaidWebhook } from '@/app/lib/musd-payment-webhook';

export const dynamic = 'force-dynamic';

const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const TRANSFER_SELECTOR = '0xa9059cbb';
const TRANSFER_CALLDATA_HEX_LENGTH = 2 + 8 + 64 + 64;
const PAYMENT_REF_PREFIX = 'SHOPOS_PAYMENT_REF:';

function sameAddress(left?: string, right?: string) {
  return !!left && !!right && left.toLowerCase() === right.toLowerCase();
}

function musdAmount(value: bigint) {
  return Number(formatUnits(value, 18));
}

function parseDirectTransferPaymentRef(input?: string) {
  if (!input || !input.toLowerCase().startsWith(TRANSFER_SELECTOR)) return null;
  if (input.length <= TRANSFER_CALLDATA_HEX_LENGTH) return null;

  try {
    const refText = hexToString(`0x${input.slice(TRANSFER_CALLDATA_HEX_LENGTH)}` as `0x${string}`);
    if (!refText.startsWith(PAYMENT_REF_PREFIX)) return null;
    const [paymentRefPart, orderPart = ''] = refText.split(';ORDER:');
    return {
      paymentIntentId: paymentRefPart.slice(PAYMENT_REF_PREFIX.length).trim(),
      orderId: orderPart.trim(),
      raw: refText
    };
  } catch {
    return null;
  }
}

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
    const transaction = await publicClient.getTransaction({ hash: txHash as `0x${string}` });

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
      const directTransferLog = receipt.logs.find((log) => {
        if (!sameAddress(log.address, MUSD_ADDRESSES.testnet)) return false;
        try {
          const decoded = decodeEventLog({
            abi: [TRANSFER_EVENT],
            data: log.data,
            topics: log.topics
          });
          if (decoded.eventName !== 'Transfer') return false;
          const { to, value } = decoded.args;
          return sameAddress(to, intent.merchantWallet) && musdAmount(value) >= intent.amountMUSD;
        } catch {
          return false;
        }
      });
      const paymentRef = parseDirectTransferPaymentRef(transaction.input);

      if (directTransferLog) {
        if (!sameAddress(transaction.to || '', MUSD_ADDRESSES.testnet)) {
          return NextResponse.json({ error: 'Direct transfer transaction target is not the configured MUSD token.' }, { status: 400 });
        }
        if (!paymentRef || paymentRef.paymentIntentId !== id || paymentRef.orderId !== intent.orderId) {
          return NextResponse.json({
            error: 'Direct transfer Payment Ref mismatch.',
            expectedPaymentIntentId: id,
            expectedOrderId: intent.orderId,
            decodedPaymentRef: paymentRef
          }, { status: 400 });
        }
        if (await hasTxHash(txHash)) {
          return NextResponse.json({ error: `Duplicate txHash ${txHash}` }, { status: 409 });
        }

        const decoded = decodeEventLog({
          abi: [TRANSFER_EVENT],
          data: directTransferLog.data,
          topics: directTransferLog.topics
        });
        const { from, to, value } = decoded.args;
        const directIntent = await markPaymentIntentConfirmed(intent, {
          txHash,
          payerWallet: from,
          blockNumber: Number(receipt.blockNumber),
          rawEvent: {
            eventName: 'Transfer',
            paymentMode: 'direct_transfer',
            token: MUSD_ADDRESSES.testnet,
            from,
            to,
            amount: value.toString(),
            amountMUSD: musdAmount(value),
            paymentRef: paymentRef.paymentIntentId,
            orderRef: paymentRef.orderId,
            paymentRefRaw: paymentRef.raw,
            transactionHash: txHash,
            blockNumber: Number(receipt.blockNumber)
          }
        });

        return NextResponse.json({
          status: directIntent.status,
          paymentIntent: directIntent,
          txHash,
          paymentMode: 'direct_transfer'
        });
      }

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
