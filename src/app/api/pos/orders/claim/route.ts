import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getPosOrderByPickupToken } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const token = req.nextUrl.searchParams.get('token')?.trim();
    if (!token) {
      return NextResponse.json({ error: 'Missing pickup token' }, { status: 400 });
    }
    const order = await getPosOrderByPickupToken(token);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('API GET /api/pos/orders/claim Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to load pickup order' }, { status: 500 });
  }
}
