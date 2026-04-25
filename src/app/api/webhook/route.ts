
import { NextRequest, NextResponse } from 'next/server';
import { updateTransactionByRecipient, logWebhook } from '@/app/lib/db';

/**
 * Handle Webhooks from Goldsky Indexer
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('--- Webhook Received (Neon Mode) ---');
    console.log('Full Received Payload:', JSON.stringify(payload, null, 2));
    
    // Save to DB for debugging
    await logWebhook(payload);

    // Extract data from Goldsky payload structure
    let data = payload.data;
    if (!data) {
      if (Array.isArray(payload)) {
        data = payload[0]?.data || payload[0];
      } else {
        data = payload;
      }
    }
    
    // Extract recipient, amount, and hash based on typical indexer fields
    // recipient is often 'to', 'recipient', 'wallet'
    const recipient = (data.recipient || data.to || data.receiver || data.owner || "").toString();
    const amount = parseFloat(data.amount || data.value || data.size || "1.0");
    const txHash = (data.transaction_hash || data.hash || data.tx_hash || "0x_unknown").toString();

    console.log('Parsed Event Data:', { recipient, amount, txHash });

    if (!recipient || recipient.trim() === "") {
      console.error('Webhook Error: No recipient address found in payload.');
      return NextResponse.json({ error: 'No recipient found', received: data }, { status: 400 });
    }

    // Process the transaction record
    const updatedTx = await updateTransactionByRecipient(recipient, amount, txHash);

    if (updatedTx) {
      console.log(`Transaction ${updatedTx.id} processed successfully as success`);
      return NextResponse.json({ success: true, transactionId: updatedTx.id });
    }

    return NextResponse.json({ error: 'Transaction processing failed', recipient }, { status: 500 });
  } catch (error: any) {
    console.error('Webhook failed:', error.message);
    return NextResponse.json({ error: 'Server error', detail: error.message }, { status: 500 });
  }
}
