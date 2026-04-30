import { NextRequest, NextResponse } from 'next/server';
import { getSql, ensureDb } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referral_id } = body;

    if (!referral_id) {
      return NextResponse.json({ error: 'Missing referral_id' }, { status: 400 });
    }

    await ensureDb();
    const sql = getSql();

    // Update customer identity verification status
    const result = await sql`
      UPDATE customers
      SET identity_verified = TRUE, verified_at = CURRENT_TIMESTAMP
      WHERE referral_id = ${referral_id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      customer: result[0]
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const referral_id = searchParams.get('referral_id');

    if (!referral_id) {
      return NextResponse.json({ error: 'Missing referral_id parameter' }, { status: 400 });
    }

    await ensureDb();
    const sql = getSql();

    const customer = await sql`
      SELECT id, username, contact_info, referral_id, identity_verified, verified_at, created_at
      FROM customers
      WHERE referral_id = ${referral_id}
      LIMIT 1
    `;

    if (customer.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}