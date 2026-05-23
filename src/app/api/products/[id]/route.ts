import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getSql } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureDb();
    const sql = getSql();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
    const price = body.price !== undefined && body.price !== null ? Number(body.price) : null;
    const sku = typeof body.sku === 'string' && body.sku.trim() ? body.sku.trim() : null;
    const color = typeof body.color === 'string' && body.color.trim() ? body.color.trim() : null;
    const size = typeof body.size === 'string' && body.size.trim() ? body.size.trim() : null;
    const imageUrl = typeof body.image_url === 'string' && body.image_url.trim() ? body.image_url.trim() : null;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
    }

    // Run direct SQL Update returning the updated row
    const updated = await sql`
      UPDATE products
      SET
        name = COALESCE(${name}, name),
        price = COALESCE(${price}::decimal, price),
        sku = COALESCE(${sku}, sku),
        color = COALESCE(${color}, color),
        size = COALESCE(${size}, size),
        image_url = COALESCE(${imageUrl}, image_url)
      WHERE id = ${id}
      RETURNING
        id, barcode, sku, name, category, brand, color, size,
        price::float, currency, stock_qty, image_url, is_active
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    return NextResponse.json({ product: updated[0] });
  } catch (error: any) {
    console.error('API PUT /api/products/[id] Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to update product.' }, { status: 500 });
  }
}
