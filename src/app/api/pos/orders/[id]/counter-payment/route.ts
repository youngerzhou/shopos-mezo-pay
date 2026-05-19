import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, markCounterPaymentReceived } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureDb();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const order = await markCounterPaymentReceived(id, body.method || 'counter');
    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('API POST /api/pos/orders/[id]/counter-payment Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to take payment' }, { status: 500 });
  }
}
