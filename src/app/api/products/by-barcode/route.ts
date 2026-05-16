import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getProductByBarcode } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();

    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get('barcode')?.trim();

    if (!barcode) {
      return NextResponse.json({ error: 'Missing barcode' }, { status: 400 });
    }

    const product = await getProductByBarcode(barcode);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('API GET /api/products/by-barcode Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
