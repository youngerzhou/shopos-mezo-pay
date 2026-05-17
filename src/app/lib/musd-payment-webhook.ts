import { decodeEventLog, formatUnits, getAddress, parseAbiItem } from 'viem';
import { MUSD_ADDRESSES } from '@/app/lib/mezo-config';
import {
  findPaymentIntentByOrderId,
  findPaymentIntentByPaymentIntentIdOrBytes32,
  getPaymentIntent,
  hasTxHash,
  markPaymentIntentConfirmed
} from '@/app/lib/payment-intents-store';
import { roundMoney2 } from '@/app/lib/money';

const ORDER_PAID_EVENT = parseAbiItem(
  'event OrderPaid(bytes32 indexed paymentIntentId, bytes32 indexed orderId, address indexed merchant, address payer, address token, uint256 amount)'
);

export type NormalizedGoldskyOrderPaidEvent = {
  paymentIntentId?: string;
  orderId?: string;
  merchant?: string;
  payerWallet?: string;
  token?: string;
  amountMUSD?: number;
  txHash?: string;
  blockNumber?: number;
  rawEvent: unknown;
};

function pick(obj: any, keys: string[]) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function sameAddress(left?: string, right?: string) {
  if (!left || !right) return false;
  try {
    return getAddress(left) === getAddress(right);
  } catch {
    return left.toLowerCase() === right.toLowerCase();
  }
}

function toNumberAmount(value: any) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'bigint') return roundMoney2(Number(formatUnits(value, 18)));
  if (typeof value === 'number') return roundMoney2(value > 1e12 ? value / 1e18 : value);
  const raw = String(value);
  if (/^\d+$/.test(raw) && raw.length > 12) return roundMoney2(Number(formatUnits(BigInt(raw), 18)));
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? roundMoney2(parsed) : undefined;
}

function normalizeDecodedArgs(args: any, rawEvent: unknown): NormalizedGoldskyOrderPaidEvent {
  return {
    paymentIntentId: String(args.paymentIntentId || ''),
    orderId: String(args.orderId || ''),
    merchant: args.merchant,
    payerWallet: args.payer,
    token: args.token,
    amountMUSD: toNumberAmount(args.amount),
    rawEvent
  };
}

function tryDecodeLog(event: any): NormalizedGoldskyOrderPaidEvent | null {
  const topics = event?.topics || event?.log?.topics;
  const data = event?.data || event?.log?.data;
  if (!Array.isArray(topics) || !data) return null;

  try {
    const decoded = decodeEventLog({
      abi: [ORDER_PAID_EVENT],
      data,
      topics
    });
    if (decoded.eventName !== 'OrderPaid') return null;
    return normalizeDecodedArgs(decoded.args, event);
  } catch {
    return null;
  }
}

function unwrapGoldskyPayload(payload: any) {
  if (Array.isArray(payload)) return payload.flatMap(unwrapGoldskyPayload);
  if (Array.isArray(payload?.data)) return payload.data.flatMap(unwrapGoldskyPayload);
  if (payload?.data && typeof payload.data === 'object') return [payload.data];
  return [payload];
}

export function normalizeGoldskyOrderPaidEvent(payload: unknown): NormalizedGoldskyOrderPaidEvent[] {
  const events = unwrapGoldskyPayload(payload);

  return events.map((event: any) => {
    const decoded = tryDecodeLog(event);
    if (decoded) {
      return {
        ...decoded,
        txHash: String(pick(event, ['transaction_hash', 'transactionHash', 'txHash', 'hash']) || ''),
        blockNumber: Number(pick(event, ['block_number', 'blockNumber']) || 0) || undefined
      };
    }

    const args = event?.args || event?.decoded || event?.event || event;
    return {
      paymentIntentId: String(pick(args, ['paymentIntentId', 'payment_intent_id', 'paymentIntentIdBytes32']) || ''),
      orderId: String(pick(args, ['orderId', 'order_id', 'orderIdBytes32']) || ''),
      merchant: String(pick(args, ['merchant']) || ''),
      payerWallet: String(pick(args, ['payer', 'payerWallet', 'payer_wallet']) || ''),
      token: String(pick(args, ['token']) || ''),
      amountMUSD: toNumberAmount(pick(args, ['amountMUSD', 'amount_musd', 'amount', 'value'])),
      txHash: String(pick(event, ['transaction_hash', 'transactionHash', 'txHash', 'hash']) || pick(args, ['transaction_hash', 'transactionHash', 'txHash', 'hash']) || ''),
      blockNumber: Number(pick(event, ['block_number', 'blockNumber']) || pick(args, ['block_number', 'blockNumber']) || 0) || undefined,
      rawEvent: event
    };
  }).filter((event) => event.paymentIntentId || event.orderId || event.txHash || event.amountMUSD !== undefined);
}

function getExpectedMerchant() {
  return process.env.NEXT_PUBLIC_SHOPOS_MERCHANT_WALLET?.trim() ||
    process.env.SHOPOS_MERCHANT_WALLET?.trim() ||
    '0x92a3C1AdC73F79818a09C6494a7bd28da9ea98E7';
}

function isMusdToken(token?: string) {
  if (!token) return false;
  return token === 'MUSD' || sameAddress(token, MUSD_ADDRESSES.testnet);
}

export async function processMusdOrderPaidWebhook(payload: unknown) {
  const normalizedEvents = normalizeGoldskyOrderPaidEvent(payload);
  const confirmed: any[] = [];
  const errors: string[] = [];

  for (const event of normalizedEvents) {
    const intent = event.paymentIntentId
      ? findPaymentIntentByPaymentIntentIdOrBytes32(event.paymentIntentId)
      : event.orderId
        ? findPaymentIntentByOrderId(event.orderId)
        : null;

    if (!intent) {
      errors.push(`Payment intent not found for paymentIntentId=${event.paymentIntentId || '-'} orderId=${event.orderId || '-'}`);
      continue;
    }
    if (intent.status === 'confirmed') {
      errors.push(`Payment intent already confirmed: ${intent.id}`);
      continue;
    }
    if (!event.paymentIntentId && !event.orderId) {
      errors.push('Missing paymentIntentId/orderId');
      continue;
    }
    if (!event.txHash) {
      errors.push(`Missing txHash for ${intent.id}`);
      continue;
    }
    if (hasTxHash(event.txHash)) {
      errors.push(`Duplicate txHash ${event.txHash}`);
      continue;
    }
    if (!isMusdToken(event.token)) {
      errors.push(`Invalid token for ${intent.id}: ${event.token || '-'}`);
      continue;
    }
    if (!sameAddress(event.merchant, getExpectedMerchant())) {
      errors.push(`Invalid merchant for ${intent.id}: ${event.merchant || '-'}`);
      continue;
    }
    if (!sameAddress(event.merchant, intent.merchantWallet)) {
      errors.push(`Merchant does not match intent ${intent.id}`);
      continue;
    }
    if (event.amountMUSD === undefined || event.amountMUSD < intent.amountMUSD) {
      errors.push(`Insufficient amount for ${intent.id}: ${event.amountMUSD ?? '-'}`);
      continue;
    }

    const nextIntent = markPaymentIntentConfirmed(intent, {
      txHash: event.txHash,
      payerWallet: event.payerWallet,
      blockNumber: event.blockNumber,
      rawEvent: event.rawEvent
    });
    confirmed.push(nextIntent);
  }

  return {
    handled: normalizedEvents.length > 0,
    confirmed,
    errors
  };
}
