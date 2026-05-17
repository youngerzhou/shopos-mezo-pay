import { randomUUID } from 'crypto';
import { keccak256, toBytes } from 'viem';
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

export function toStableBytes32(value: string) {
  return keccak256(toBytes(value));
}

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
  store.intentBytes32ToId.set(toStableBytes32(intent.id).toLowerCase(), intent.id);
  store.orderBytes32ToId.set(toStableBytes32(intent.orderId).toLowerCase(), intent.id);
  return intent;
}

export function getPaymentIntent(id: string) {
  return store.intents.get(id) || null;
}

export function findPaymentIntentByOrderId(orderId: string) {
  const orderKey = orderId.toLowerCase();
  const intentId = store.orderBytes32ToId.get(orderKey);
  if (intentId) return getPaymentIntent(intentId);

  for (const intent of store.intents.values()) {
    if (intent.orderId === orderId) return intent;
  }
  return null;
}

export function findPaymentIntentByPaymentIntentIdOrBytes32(paymentIntentId: string) {
  const intent = getPaymentIntent(paymentIntentId);
  if (intent) return intent;

  const intentId = store.intentBytes32ToId.get(paymentIntentId.toLowerCase());
  return intentId ? getPaymentIntent(intentId) : null;
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
