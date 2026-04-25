
import { NextRequest, NextResponse } from 'next/server';
import { updateTransactionByRecipient, logWebhook } from '@/app/lib/db';

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

/**
 * Handle Webhooks from Goldsky Indexer
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('--- [GOLD SKY] WEBHOOK RECEIVED ---');
    console.log('FULL PAYLOAD:', JSON.stringify(payload, null, 2));
    
    // Save raw payload (essential for debug)
    await logWebhook(payload);

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
      const recipient = (
        data.recipient || data.to || data.receiver || data.owner || data.wallet || data.address || ""
      ).toString().toLowerCase().trim();

      const amount = parseFloat(data.amount || data.value || data.size || "0");
      const txHash = (data.transaction_hash || data.hash || data.tx_hash || "0x_unknown").toString();

      if (recipient) {
        const updatedTx = await updateTransactionByRecipient(recipient, amount, txHash);
        if (updatedTx) results.push(updatedTx.id);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Webhook processed ${results.length} results in ${duration}ms`);

    return NextResponse.json({ 
      success: true, 
      processed: results.length 
    }, {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error: any) {
    console.error('Webhook processing failed:', error.message);
    return NextResponse.json({ error: 'Server error' }, { 
      status: 500, 
      headers: { 'Access-Control-Allow-Origin': '*' } 
    });
  }
}
