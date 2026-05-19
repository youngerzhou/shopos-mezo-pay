import { NextRequest, NextResponse } from 'next/server';
import { completePickupOrder, ensureDb } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureDb();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const order = await completePickupOrder(id, body.completed_by || 'counter_staff');
    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('API POST /api/pos/orders/[id]/complete-pickup Error:', error);
    const status =
      error.message === 'Order not found' ? 404 :
      error.message === 'Payment required before pickup' ? 409 :
      400;
    return NextResponse.json({ error: error.message || 'Unable to complete pickup' }, { status });
  }
}
