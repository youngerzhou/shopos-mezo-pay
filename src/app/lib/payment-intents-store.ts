import { randomUUID } from 'crypto';
import { hexToString, isHex, keccak256, padHex, stringToHex, toBytes } from 'viem';
import { roundMoney2 } from '@/app/lib/money';

export type PaymentIntentStatus = 'pending' | 'detected' | 'confirmed' | 'expired' | 'failed';

export type PaymentIntent = {
  id: string;
  orderId: string;
  amountUsd: number;
  amountMUSD: number;
  token: 'MUSD';
  network: 'mezo-testnet';
  merchantWallet: string;
  status: PaymentIntentStatus;
  paymentFlow: 'musd_scan_to_pay';
  createdAt: string;
  expiresAt: string;
  payerWallet?: string;
  txHash?: string;
  blockNumber?: number;
  rawEvent?: unknown;
  confirmedAt?: string;
};

type StoreState = {
  intents: Map<string, PaymentIntent>;
  intentBytes32ToId: Map<string, string>;
  orderBytes32ToId: Map<string, string>;
  txHashes: Set<string>;
};

const globalStore = globalThis as typeof globalThis & {
  __shoposPaymentIntentsStore?: StoreState;
};

const store = globalStore.__shoposPaymentIntentsStore || {
  intents: new Map<string, PaymentIntent>(),
  intentBytes32ToId: new Map<string, string>(),
  orderBytes32ToId: new Map<string, string>(),
  txHashes: new Set<string>()
};

globalStore.__shoposPaymentIntentsStore = store;

function makeId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
}

export function toLegacyStableBytes32(value: string) {
  return keccak256(toBytes(value));
}

export function toBytes32String(value: string) {
  const bytes = toBytes(value);
  if (bytes.length > 32) {
    throw new Error(`Cannot encode ${value} as bytes32 string: ${bytes.length} bytes exceeds 32 bytes`);
  }
  return padHex(stringToHex(value), { size: 32, dir: 'right' });
}

export function fromBytes32String(value: string) {
  if (!isHex(value) || value.length !== 66) return value;

  try {
    const decoded = hexToString(value, { size: 32 }).replace(/\0+$/g, '');
    return decoded || value;
  } catch {
    return value;
  }
}

export const toStableBytes32 = toBytes32String;

export function createPaymentIntent(input: {
  amountUsd: number;
  amountMUSD: number;
  merchantWallet: string;
  ttlMinutes?: number;
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (input.ttlMinutes || 15) * 60 * 1000);
  const intent: PaymentIntent = {
    id: makeId('PI'),
    orderId: makeId('ORD'),
    amountUsd: roundMoney2(input.amountUsd),
    amountMUSD: roundMoney2(input.amountMUSD),
    token: 'MUSD',
    network: 'mezo-testnet',
    merchantWallet: input.merchantWallet,
    status: 'pending',
    paymentFlow: 'musd_scan_to_pay',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  store.intents.set(intent.id, intent);
  store.intentBytes32ToId.set(toBytes32String(intent.id).toLowerCase(), intent.id);
  store.intentBytes32ToId.set(toLegacyStableBytes32(intent.id).toLowerCase(), intent.id);
  store.orderBytes32ToId.set(toBytes32String(intent.orderId).toLowerCase(), intent.id);
  store.orderBytes32ToId.set(toLegacyStableBytes32(intent.orderId).toLowerCase(), intent.id);
  console.log('[PaymentIntentIdentity] POS stored payment intent', {
    paymentIntentId: intent.id,
    paymentRef: intent.id,
    orderId: intent.orderId,
    amountUsd: intent.amountUsd,
    amountMUSD: intent.amountMUSD,
    status: intent.status,
    createdAt: intent.createdAt,
    paymentIntentIdBytes32: toBytes32String(intent.id),
    orderIdBytes32: toBytes32String(intent.orderId),
    legacyPaymentIntentHash: toLegacyStableBytes32(intent.id),
    legacyOrderHash: toLegacyStableBytes32(intent.orderId)
  });
  return intent;
}

export function getPaymentIntent(id: string) {
  return store.intents.get(id) || null;
}

export function findPaymentIntentByOrderId(orderId: string) {
  const canonicalOrderId = fromBytes32String(orderId);
  const orderKey = canonicalOrderId.toLowerCase();
  const intentId = store.orderBytes32ToId.get(orderKey);
  if (intentId) {
    const intent = getPaymentIntent(intentId);
    console.log('[PaymentIntentIdentity] lookup by orderId bytes32 map', { input: orderId, lookupKey: orderKey, found: Boolean(intent), paymentIntentId: intent?.id });
    return intent;
  }

  for (const intent of store.intents.values()) {
    if (intent.orderId === canonicalOrderId) {
      console.log('[PaymentIntentIdentity] lookup by canonical orderId', { input: orderId, lookupKey: canonicalOrderId, found: true, paymentIntentId: intent.id });
      return intent;
    }
  }
  console.warn('[PaymentIntentIdentity] order lookup missed', { input: orderId, lookupKey: canonicalOrderId });
  return null;
}

export function findPaymentIntentByPaymentIntentIdOrBytes32(paymentIntentId: string) {
  const canonicalPaymentIntentId = fromBytes32String(paymentIntentId);
  const intent = getPaymentIntent(canonicalPaymentIntentId);
  console.log('[PaymentIntentIdentity] lookup by paymentIntentId', {
    input: paymentIntentId,
    lookupKey: canonicalPaymentIntentId,
    found: Boolean(intent),
    paymentIntentId: intent?.id
  });
  if (intent) return intent;

  const intentId = store.intentBytes32ToId.get(paymentIntentId.toLowerCase());
  const mappedIntent = intentId ? getPaymentIntent(intentId) : null;
  console.log('[PaymentIntentIdentity] lookup by paymentIntentId bytes32 map', {
    input: paymentIntentId,
    lookupKey: paymentIntentId.toLowerCase(),
    found: Boolean(mappedIntent),
    paymentIntentId: mappedIntent?.id
  });
  return mappedIntent;
}

export function hasTxHash(txHash: string) {
  return store.txHashes.has(txHash.toLowerCase());
}

export function markPaymentIntentConfirmed(intent: PaymentIntent, update: {
  txHash: string;
  payerWallet?: string;
  blockNumber?: number;
  rawEvent?: unknown;
}) {
  const nextIntent: PaymentIntent = {
    ...intent,
    status: 'confirmed',
    txHash: update.txHash,
    payerWallet: update.payerWallet,
    blockNumber: update.blockNumber,
    rawEvent: update.rawEvent,
    confirmedAt: new Date().toISOString()
  };

  store.intents.set(nextIntent.id, nextIntent);
  store.txHashes.add(update.txHash.toLowerCase());
  return nextIntent;
}
