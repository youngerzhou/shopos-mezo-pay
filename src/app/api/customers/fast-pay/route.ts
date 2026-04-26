import { NextRequest, NextResponse } from 'next/server';
import { getSql, ensureDb } from '@/app/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { referral_id, enabled } = await req.json();

    if (!referral_id) {
      return NextResponse.json({ error: 'Missing referral_id' }, { status: 400 });
    }

    await ensureDb();
    const sql = getSql();

    await sql`
      UPDATE customers 
      SET fast_pay_enabled = ${enabled} 
      WHERE referral_id = ${referral_id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
