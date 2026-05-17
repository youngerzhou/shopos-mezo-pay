import { decodeAbiParameters, decodeEventLog, formatUnits, getAddress, parseAbiItem } from 'viem';
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
const ORDER_PAID_TOPIC0 = '0x09e99da262bb12c46eaeae571a859520dbb1218e8f6e186e4c0392269e98ed36';

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

function normalizeTopics(value: any) {
  if (Array.isArray(value)) return value.map((topic) => String(topic).trim()).filter(Boolean);
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map((topic) => String(topic).trim()).filter(Boolean) : undefined;
    } catch {
      return undefined;
    }
  }

  return trimmed.replace(/^\{|\}$/g, '').split(',').map((topic) => topic.trim().replace(/^"|"$/g, '')).filter(Boolean);
}

function getTopicsFromRawLog(event: any) {
  const topics = normalizeTopics(event?.topics || event?.log?.topics);
  if (topics?.length) return topics;

  const positionalTopics = [
    pick(event, ['topic0', 'topic_0', 'topicZero']),
    pick(event, ['topic1', 'topic_1']),
    pick(event, ['topic2', 'topic_2']),
    pick(event, ['topic3', 'topic_3'])
  ].filter(Boolean);

  return positionalTopics.length ? positionalTopics.map(String) : undefined;
}

function getLogData(event: any) {
  return pick(event, ['data', 'logData', 'log_data']) || pick(event?.log, ['data', 'logData', 'log_data']);
}

function getTxHash(event: any) {
  return String(pick(event, ['transaction_hash', 'transactionHash', 'tx_hash', 'txHash', 'hash']) || '');
}

function getBlockNumber(event: any) {
  return Number(pick(event, ['block_number', 'blockNumber']) || 0) || undefined;
}

function getLogAddress(event: any) {
  return String(pick(event, ['address', 'contract_address', 'contractAddress']) || pick(event?.log, ['address']) || '');
}

function topicToAddress(topic?: string) {
  if (!topic || !/^0x[a-fA-F0-9]{64}$/.test(topic)) return '';
  return getAddress(`0x${topic.slice(-40)}`);
}

function logRawLogDecodeSnapshot(event: any, decoded?: NormalizedGoldskyOrderPaidEvent, error?: unknown) {
  const topics = getTopicsFromRawLog(event) || [];
  console.log('[GoldskyWebhook] raw log decode snapshot', {
    txHash: getTxHash(event),
    logAddress: getLogAddress(event),
    topicsCount: topics.length,
    topic0: topics[0],
    decodedPaymentIntentId: decoded?.paymentIntentId || '',
    decodedOrderId: decoded?.orderId || '',
    decodedMerchant: decoded?.merchant || '',
    decodedPayer: decoded?.payerWallet || '',
    decodedToken: decoded?.token || '',
    decodedAmount: decoded?.amountMUSD,
    decodeError: error instanceof Error ? error.message : error
  });
}

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
  const topics = getTopicsFromRawLog(event);
  const data = getLogData(event);
  if (!Array.isArray(topics) || topics.length === 0 || !data) {
    logRawLogDecodeSnapshot(event, undefined, 'Missing topics or data');
    return null;
  }

  if (topics[0]?.toLowerCase() !== ORDER_PAID_TOPIC0) {
    logRawLogDecodeSnapshot(event, undefined, 'Non-OrderPaid topic0');
    return null;
  }

  try {
    const decoded = decodeEventLog({
      abi: [ORDER_PAID_EVENT],
      data,
      topics
    });
    if (decoded.eventName !== 'OrderPaid') return null;
    const normalized = normalizeDecodedArgs(decoded.args, event);
    logRawLogDecodeSnapshot(event, normalized);
    return normalized;
  } catch (err) {
    try {
      const [payer, token, amount] = decodeAbiParameters(
        [
          { name: 'payer', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        data
      );
      const normalized = {
        paymentIntentId: topics[1] || '',
        orderId: topics[2] || '',
        merchant: topicToAddress(topics[3]),
        payerWallet: payer,
        token,
        amountMUSD: toNumberAmount(amount),
        rawEvent: event
      };
      logRawLogDecodeSnapshot(event, normalized);
      return normalized;
    } catch (fallbackErr) {
      logRawLogDecodeSnapshot(event, undefined, fallbackErr);
      return null;
    }
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

  return events.flatMap((event: any) => {
    const decoded = tryDecodeLog(event);
    if (decoded) {
      return [{
        ...decoded,
        txHash: getTxHash(event),
        blockNumber: getBlockNumber(event)
      }];
    }

    const args = event?.args || event?.decoded || event?.event || event;
    const normalized = {
      paymentIntentId: String(pick(args, ['paymentIntentId', 'payment_intent_id', 'paymentIntentIdBytes32']) || ''),
      orderId: String(pick(args, ['orderId', 'order_id', 'orderIdBytes32']) || ''),
      merchant: String(pick(args, ['merchant']) || ''),
      payerWallet: String(pick(args, ['payer', 'payerWallet', 'payer_wallet']) || ''),
      token: String(pick(args, ['token']) || ''),
      amountMUSD: toNumberAmount(pick(args, ['amountMUSD', 'amount_musd', 'amount', 'value'])),
      txHash: getTxHash(event) || String(pick(args, ['transaction_hash', 'transactionHash', 'tx_hash', 'txHash', 'hash']) || ''),
      blockNumber: getBlockNumber(event) || Number(pick(args, ['block_number', 'blockNumber']) || 0) || undefined,
      rawEvent: event
    };
    return normalized.paymentIntentId || normalized.orderId ? [normalized] : [];
  });
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

  console.log('[GoldskyWebhook] decoded OrderPaid events', JSON.stringify(normalizedEvents, null, 2));

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
