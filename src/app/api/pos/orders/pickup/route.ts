import { NextResponse } from 'next/server';
import { ensureDb, listCustomerSelfPickupOrders } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDb();
    const orders = await listCustomerSelfPickupOrders();
    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('API GET /api/pos/orders/pickup Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to load pickup orders' }, { status: 500 });
  }
}
