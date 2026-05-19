import { NextResponse } from 'next/server';
import { ensureDb, getActiveProducts } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDb();
    const products = await getActiveProducts();
    return NextResponse.json({ products });
  } catch (error: any) {
    console.error('API GET /api/products Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to load products' }, { status: 500 });
  }
}
