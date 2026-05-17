import { NextRequest, NextResponse } from 'next/server';
import { normalizeGoldskyOrderPaidEvent, processMusdOrderPaidWebhook } from '@/app/lib/musd-payment-webhook';

export const dynamic = 'force-dynamic';

function redactHeaders(headers: Headers) {
  return Object.fromEntries(
    Array.from(headers.entries()).map(([key, value]) => [
      key,
      ['authorization', 'cookie', 'x-goldsky-secret', 'x-webhook-secret'].includes(key.toLowerCase()) ? '[redacted]' : value
    ])
  );
}

function extractLogPreview(payload: any) {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [payload?.data || payload];
  return rows.map((row: any) => ({
    txHash: row?.transaction_hash || row?.transactionHash || row?.txHash || row?.hash,
    topics: row?.topics || row?.log?.topics,
    decodedEvent: normalizeGoldskyOrderPaidEvent(row)
  }));
}

export async function POST(req: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};
    console.log('[GoldskyWebhook] request received', {
      route: '/api/webhooks/goldsky/musd-payment',
      method: req.method,
      url: req.url,
      headers: redactHeaders(req.headers),
      rawBody,
      logs: extractLogPreview(body)
    });

    const result = await processMusdOrderPaidWebhook(body);
    const status = 200;
    const responseBody = {
      success: result.errors.length === 0,
      processed: result.confirmed.length,
      confirmed: result.confirmed,
      paymentIntent: result.confirmed[0] || null,
      errors: result.errors,
      acknowledged: true
    };
    console.log('[GoldskyWebhook] response', {
      route: '/api/webhooks/goldsky/musd-payment',
      status,
      body: responseBody
    });

    return NextResponse.json(responseBody, { status });
  } catch (error: any) {
    console.error('[GoldskyWebhook] processing failed:', {
      route: '/api/webhooks/goldsky/musd-payment',
      message: error.message,
      rawBody,
      error
    });
    const responseBody = { error: error.message || 'Unable to process MUSD payment webhook' };
    console.log('[GoldskyWebhook] response', {
      route: '/api/webhooks/goldsky/musd-payment',
      status: 500,
      body: responseBody
    });
    return NextResponse.json(responseBody, { status: 500 });
  }
}
