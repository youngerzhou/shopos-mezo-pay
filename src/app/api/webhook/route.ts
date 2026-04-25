
import { NextRequest, NextResponse } from 'next/server';
import { updateTransactionByRecipient, logWebhook } from '@/app/lib/db';

/**
 * Handle Webhooks from Goldsky Indexer
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('--- [GOLD SKY] WEBHOOK RECEIVED ---');
    console.log('FULL PAYLOAD:', JSON.stringify(payload, null, 2));
    
    // Save raw payload for debugging interface
    await logWebhook(payload);

    // Goldsky often sends an array of events or a single object with a data property
    // Sometimes it is { "data": { ... } }, sometimes it is [{ "data": { ... } }]
    // We normalize to an array of data objects
    let events: any[] = [];
    if (Array.isArray(payload)) {
      events = payload.map(item => item.data || item);
    } else if (payload.data) {
      events = Array.isArray(payload.data) ? payload.data : [payload.data];
    } else {
      events = [payload];
    }
    
    console.log(`Processing ${events.length} events from payload...`);

    const results = [];

    for (const data of events) {
      // Try to extract recipient address from common Goldsky/Indexer fields
      const recipient = (
        data.recipient || 
        data.to || 
        data.receiver || 
        data.owner || 
        data.wallet || 
        data.address || 
        ""
      ).toString().toLowerCase().trim();

      const amount = parseFloat(data.amount || data.value || data.size || "0");
      const txHash = (data.transaction_hash || data.hash || data.tx_hash || "0x_unknown").toString();

      console.log(`[EVENT] Found Recipient: "${recipient}", Amount: ${amount}, Hash: ${txHash}`);

      if (!recipient) {
        console.warn('Skipping event: No recipient address found in event data.', data);
        continue;
      }

      // Update the transaction in database using case-insensitive match (handled inside the function)
      const updatedTx = await updateTransactionByRecipient(recipient, amount, txHash);
      if (updatedTx) {
        console.log(`[SUCCESS] Transaction ${updatedTx.id} updated to success for ${recipient}`);
        results.push(updatedTx.id);
      } else {
        console.warn(`[MISSING] No matching pending transaction found for recipient: ${recipient}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      transactionIds: results 
    });

  } catch (error: any) {
    console.error('Webhook processing failed fatal error:', error.message);
    return NextResponse.json({ error: 'Server error', detail: error.message }, { status: 500 });
  }
}
