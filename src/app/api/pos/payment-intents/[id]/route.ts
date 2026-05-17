import { NextRequest, NextResponse } from 'next/server';
import {
  getAvailablePaymentIntentIds,
  getMemoryPaymentIntentIds,
  getPaymentIntent,
  PAYMENT_INTENT_STORAGE_BACKEND,
  toStableBytes32
} from '@/app/lib/payment-intents-store';
import { ensureDb, getSql } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const intent = await getPaymentIntent(id);
  let orderExists = false;
  try {
    await ensureDb();
    const sql = getSql();
    const rows = await sql`
      SELECT 1
      FROM pos_orders
      WHERE id = ${intent?.orderId || id}
      LIMIT 1
    `;
    orderExists = rows.length > 0;
  } catch (error) {
    console.warn('[PaymentIntentIdentity] POS order existence check failed', {
      requestedPaymentIntentId: id,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  if (!intent) {
    const availablePaymentIntentIds = await getAvailablePaymentIntentIds();
    const memoryPaymentIntentIds = getMemoryPaymentIntentIds();
    console.warn('[PaymentIntentIdentity] POS status lookup failed', {
      requestedPaymentIntentId: id,
      lookupKey: id,
      lookupKeyType: 'paymentIntentId',
      storageBackend: PAYMENT_INTENT_STORAGE_BACKEND,
      orderExists,
      paymentIntentExists: false,
      availablePaymentIntentIds,
      memoryPaymentIntentIds
    });
    return NextResponse.json({
      error: 'Payment intent not found',
      lookupKey: id,
      lookupKeyType: 'paymentIntentId',
      orderExists,
      paymentIntentExists: false,
      storageBackend: PAYMENT_INTENT_STORAGE_BACKEND,
      availablePaymentIntentIds,
      possibleReason: 'The POS status endpoint could not find this paymentIntentId in persistent storage. If this ID was just created, verify the create request completed successfully and returned the same paymentIntentId used for polling.'
    }, { status: 404 });
  }

  const paymentIntentIdBytes32 = toStableBytes32(intent.id);
  const orderIdBytes32 = toStableBytes32(intent.orderId);
  console.log('[PaymentIntentIdentity] POS status lookup succeeded', {
    requestedPaymentIntentId: id,
    lookupKey: id,
    lookupKeyType: 'paymentIntentId',
    storageBackend: PAYMENT_INTENT_STORAGE_BACKEND,
    orderExists,
    paymentIntentExists: true,
    paymentIntentId: intent.id,
    paymentRef: intent.id,
    orderId: intent.orderId,
    amountMUSD: intent.amountMUSD,
    status: intent.status,
    createdAt: intent.createdAt,
    paymentIntentIdBytes32,
    orderIdBytes32
  });

  return NextResponse.json({
    ...intent,
    paymentRef: intent.id,
    lookupKey: id,
    lookupKeyType: 'paymentIntentId',
    orderExists,
    paymentIntentExists: true,
    storageBackend: PAYMENT_INTENT_STORAGE_BACKEND,
    paymentIntentIdBytes32,
    orderIdBytes32
  });
}
