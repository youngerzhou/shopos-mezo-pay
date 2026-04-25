
import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Simple GET endpoint for short polling.
 * Returns the current status of an order.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  try {
    const order = await getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...order,
      _server_time: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err: any) {
    console.error('[API] Status Check Error:', err);
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 });
  }
}
