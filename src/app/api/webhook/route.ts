
import { NextRequest, NextResponse } from 'next/server';
import { updateOrderByWallet, logWebhook } from '@/app/lib/db';

/**
 * Handle Webhooks from Goldsky Indexer
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('--- Webhook Received ---');
    console.log('Full Received Payload from Goldsky:', JSON.stringify(payload, null, 2));
    
    // Save to DB for debugging interface
    await logWebhook(payload);
    // Goldsky often sends: { "data": { ... } } or an array of those
    let data = payload.data;
    if (!data) {
      if (Array.isArray(payload)) {
        data = payload[0]?.data || payload[0];
      } else {
        data = payload;
      }
    }
    
    // Normalize possible field names from various indexer configs
    // Goldsky raw logs often use "sender", "from", "payer", or custom fields in the sink
    const customerAddress = (data.sender || data.from || data.payer || data.owner || "").toString(); 
    const txHash = (data.transaction_hash || data.hash || data.tx_hash || "0x_simulated").toString();

    console.log('Parsed Event Data:', { customerAddress, txHash });
    console.log(`Extracted customerAddress: "${customerAddress}"`);
    console.log(`Extracted txHash: "${txHash}"`);

    if (!customerAddress || customerAddress.trim() === "") {
      console.error('Webhook Error: No customer address found in payload. Check your Goldsky sink field mapping.');
      return NextResponse.json({ error: 'No sender address found', received: data }, { status: 400 });
    }

    const normalizedAddress = customerAddress.toLowerCase().trim();
    console.log(`Updating order for: ${normalizedAddress}`);
    
    const updatedOrder = await updateOrderByWallet(normalizedAddress, 'paid', txHash);

    if (updatedOrder) {
      console.log(`Order ${updatedOrder.id} is now PAID`);
      return NextResponse.json({ success: true, orderId: updatedOrder.id });
    }

    console.warn(`Webhook: No pending order exists for wallet: ${normalizedAddress}`);
    return NextResponse.json({ error: 'No matching pending order', wallet: normalizedAddress }, { status: 404 });
  } catch (error: any) {
    console.error('Webhook failed:', error.message);
    return NextResponse.json({ error: 'Server error', detail: error.message }, { status: 500 });
  }
}
