import { randomUUID } from 'crypto';
import { hexToString, isHex, keccak256, padHex, stringToHex, toBytes } from 'viem';
import { roundMoney2 } from '@/app/lib/money';
import { ensureDb, getSql, markPosOrderPaid } from '@/app/lib/db';

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

export const PAYMENT_INTENT_STORAGE_BACKEND = 'database:payment_intents';

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

function mirrorIntent(intent: PaymentIntent) {
  store.intents.set(intent.id, intent);
  store.intentBytes32ToId.set(toBytes32String(intent.id).toLowerCase(), intent.id);
  store.intentBytes32ToId.set(toLegacyStableBytes32(intent.id).toLowerCase(), intent.id);
  store.orderBytes32ToId.set(toBytes32String(intent.orderId).toLowerCase(), intent.id);
  store.orderBytes32ToId.set(toLegacyStableBytes32(intent.orderId).toLowerCase(), intent.id);
  if (intent.txHash) store.txHashes.add(intent.txHash.toLowerCase());
}

function rowToPaymentIntent(row: any): PaymentIntent {
  const intent: PaymentIntent = {
    id: row.id,
    orderId: row.order_id,
    amountUsd: roundMoney2(Number(row.amount_usd || 0)),
    amountMUSD: roundMoney2(Number(row.amount_musd || 0)),
    token: (row.token || 'MUSD') as 'MUSD',
    network: (row.network || 'mezo-testnet') as 'mezo-testnet',
    merchantWallet: row.merchant_wallet,
    status: row.status || 'pending',
    paymentFlow: (row.payment_flow || 'musd_scan_to_pay') as 'musd_scan_to_pay',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : new Date(row.expires_at).toISOString(),
    payerWallet: row.payer_wallet || undefined,
    txHash: row.tx_hash || undefined,
    blockNumber: row.block_number || undefined,
    rawEvent: row.raw_event || undefined,
    confirmedAt: row.confirmed_at ? (row.confirmed_at instanceof Date ? row.confirmed_at.toISOString() : new Date(row.confirmed_at).toISOString()) : undefined
  };
  mirrorIntent(intent);
  return intent;
}

export function getMemoryPaymentIntentIds() {
  return Array.from(store.intents.keys());
}

export async function getAvailablePaymentIntentIds(limit = 25) {
  await ensureDb();
  const sql = getSql();
  const rows = await sql`
    SELECT id
    FROM payment_intents
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row: any) => row.id);
}

export async function createPaymentIntent(input: {
  amountUsd: number;
  amountMUSD: number;
  merchantWallet: string;
  orderId?: string;
  ttlMinutes?: number;
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (input.ttlMinutes || 15) * 60 * 1000);
  const intent: PaymentIntent = {
    id: makeId('PI'),
    orderId: input.orderId || makeId('ORD'),
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

  await ensureDb();
  const sql = getSql();
  await sql`
    INSERT INTO payment_intents (
      id, order_id, amount_usd, amount_musd, token, network, merchant_wallet,
      status, payment_flow, expires_at, created_at, updated_at
    )
    VALUES (
      ${intent.id},
      ${intent.orderId},
      ${intent.amountUsd},
      ${intent.amountMUSD},
      ${intent.token},
      ${intent.network},
      ${intent.merchantWallet},
      ${intent.status},
      ${intent.paymentFlow},
      ${intent.expiresAt},
      ${intent.createdAt},
      ${intent.createdAt}
    )
  `;
  mirrorIntent(intent);
  console.log('[PaymentIntentIdentity] POS stored payment intent', {
    storageBackend: PAYMENT_INTENT_STORAGE_BACKEND,
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

export async function getPaymentIntent(id: string) {
  await ensureDb();
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM payment_intents
    WHERE id = ${id}
    LIMIT 1
  `;
  if (rows.length > 0) return rowToPaymentIntent(rows[0]);
  return store.intents.get(id) || null;
}

export async function findPaymentIntentByOrderId(orderId: string) {
  const canonicalOrderId = fromBytes32String(orderId);
  await ensureDb();
  const sql = getSql();
  const directRows = await sql`
    SELECT *
    FROM payment_intents
    WHERE order_id = ${canonicalOrderId}
    LIMIT 1
  `;
  if (directRows.length > 0) {
    const intent = rowToPaymentIntent(directRows[0]);
    console.log('[PaymentIntentIdentity] lookup by canonical orderId', { storageBackend: PAYMENT_INTENT_STORAGE_BACKEND, input: orderId, lookupKey: canonicalOrderId, found: true, paymentIntentId: intent.id });
    return intent;
  }

  const orderKey = canonicalOrderId.toLowerCase();
  const intentId = store.orderBytes32ToId.get(orderKey);
  if (intentId) {
    const intent = await getPaymentIntent(intentId);
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

export async function findPaymentIntentByPaymentIntentIdOrBytes32(paymentIntentId: string) {
  const canonicalPaymentIntentId = fromBytes32String(paymentIntentId);
  const intent = await getPaymentIntent(canonicalPaymentIntentId);
  console.log('[PaymentIntentIdentity] lookup by paymentIntentId', {
    storageBackend: PAYMENT_INTENT_STORAGE_BACKEND,
    input: paymentIntentId,
    lookupKey: canonicalPaymentIntentId,
    found: Boolean(intent),
    paymentIntentId: intent?.id
  });
  if (intent) return intent;

  const intentId = store.intentBytes32ToId.get(paymentIntentId.toLowerCase());
  const mappedIntent = intentId ? await getPaymentIntent(intentId) : null;
  console.log('[PaymentIntentIdentity] lookup by paymentIntentId bytes32 map', {
    input: paymentIntentId,
    lookupKey: paymentIntentId.toLowerCase(),
    found: Boolean(mappedIntent),
    paymentIntentId: mappedIntent?.id
  });
  return mappedIntent;
}

export async function hasTxHash(txHash: string) {
  await ensureDb();
  const sql = getSql();
  const rows = await sql`
    SELECT id
    FROM payment_intents
    WHERE LOWER(tx_hash) = ${txHash.toLowerCase()}
    LIMIT 1
  `;
  if (rows.length > 0) return true;
  return store.txHashes.has(txHash.toLowerCase());
}

export async function markPaymentIntentConfirmed(intent: PaymentIntent, update: {
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

  await ensureDb();
  const sql = getSql();
  await sql`
    UPDATE payment_intents
    SET status = 'confirmed',
        tx_hash = ${update.txHash},
        payer_wallet = ${update.payerWallet || null},
        block_number = ${update.blockNumber || null},
        raw_event = ${JSON.stringify(update.rawEvent || null)}::jsonb,
        confirmed_at = ${nextIntent.confirmedAt},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${intent.id}
  `;
  mirrorIntent(nextIntent);
  try {
    await markPosOrderPaid(intent.orderId, update.txHash);
  } catch (error) {
    console.warn('[PaymentIntentIdentity] POS order paid sync skipped', {
      orderId: intent.orderId,
      paymentIntentId: intent.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  return nextIntent;
}
