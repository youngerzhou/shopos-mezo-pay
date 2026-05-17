import { NextRequest, NextResponse } from 'next/server';
import { updateTransactionByRecipient, logWebhook } from '@/app/lib/db';
import { roundMoney2 } from '@/app/lib/money';
import { normalizeGoldskyOrderPaidEvent, processMusdOrderPaidWebhook } from '@/app/lib/musd-payment-webhook';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Handle OPTIONS for CORS Preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Handle GET for basic testing
 */
export async function GET() {
  return NextResponse.json({ 
    message: "Webhook endpoint active.",
    usage: "Send POST requests with transaction data." 
  }, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  });
}

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

/**
 * Handle Webhooks from Goldsky Indexer
 */
export async function POST(req: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await req.text();
    const payload = rawBody ? JSON.parse(rawBody) : {};
    console.log('[GoldskyWebhook] request received', {
      route: '/api/webhook',
      method: req.method,
      url: req.url,
      headers: redactHeaders(req.headers),
      rawBody,
      logs: extractLogPreview(payload)
    });
    
    // Save raw payload (essential for debug)
    await logWebhook(payload);

    const musdResult = await processMusdOrderPaidWebhook(payload);
    if (musdResult.handled) {
      if (musdResult.errors.length > 0 && musdResult.confirmed.length === 0) {
        console.warn('[OrderPaid webhook] Unable to confirm payment intent:', musdResult.errors.join('; '));
        const responseBody = {
          success: false,
          processed: 0,
          errors: musdResult.errors,
          acknowledged: true
        };
        console.log('[GoldskyWebhook] response', { route: '/api/webhook', status: 200, body: responseBody });
        return NextResponse.json(responseBody, {
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }

      const responseBody = {
        success: musdResult.errors.length === 0,
        processed: musdResult.confirmed.length,
        confirmed: musdResult.confirmed.map((intent) => intent.id),
        errors: musdResult.errors
      };
      console.log('[GoldskyWebhook] response', { route: '/api/webhook', status: 200, body: responseBody });
      return NextResponse.json(responseBody, {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Normalize events
    let events: any[] = [];
    if (Array.isArray(payload)) {
      events = payload.map(item => item.data || item);
    } else if (payload.data) {
      events = Array.isArray(payload.data) ? payload.data : [payload.data];
    } else {
      events = [payload];
    }
    
    const results: string[] = [];
    const startTime = Date.now();

    // Process events
    for (const data of events) {
      // 1. Extract recipient and sender
      const rawRecipient = data.recipient || data.to || data.address || "";
      const recipient = rawRecipient.toString().toLowerCase().trim();
      
      const rawSender = data.sender || data.from || "";
      const sender = rawSender.toString().toLowerCase().trim();

      // 2. Handle amount conversion (e.g., 1000000000000000000 -> 1)
      let amount = 0;
      const rawAmount = data.amount || data.value || "0";
      try {
        if (typeof rawAmount === 'string' && rawAmount.length > 15) {
          // Standard conversion for 18 decimals (Wei to Eth/Token)
          amount = roundMoney2(parseFloat(rawAmount) / 1e18);
        } else {
          amount = roundMoney2(parseFloat(rawAmount));
        }
      } catch (e) {
        console.warn('Amount conversion error:', e);
      }

      // 3. Extract transaction hash
      const txHash = (data.transaction_hash || data.hash || "0x_unknown").toString();

      console.log(`[GOLD SKY EVENT] Match Candidate -> Recipient: ${recipient}, Sender: ${sender}, Amount: ${amount}, TX: ${txHash}`);

      if (recipient) {
        // This function handles the LOWER() matching internally in db.ts
        const updatedTx = await updateTransactionByRecipient(recipient, amount, txHash, sender);
        if (updatedTx) {
          results.push(updatedTx.id);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Webhook processed ${results.length} results in ${duration}ms`);

    const responseBody = { 
      success: true, 
      processed: results.length 
    };
    console.log('[GoldskyWebhook] response', { route: '/api/webhook', status: 200, body: responseBody });
    return NextResponse.json(responseBody, {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error: any) {
    console.error('[GoldskyWebhook] processing failed:', {
      route: '/api/webhook',
      message: error.message,
      rawBody,
      error
    });
    const responseBody = { error: 'Server error' };
    console.log('[GoldskyWebhook] response', { route: '/api/webhook', status: 500, body: responseBody });
    return NextResponse.json(responseBody, { 
      status: 500, 
      headers: { 'Access-Control-Allow-Origin': '*' } 
    });
  }
}
