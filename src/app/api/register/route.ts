import { NextRequest, NextResponse } from 'next/server';
import { getSql, ensureDb } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, contact, staff_id } = body;

    if (!username || !contact) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await ensureDb();
    const sql = getSql();

    // Generate unique MEM_ ID
    const referral_id = `MEM_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const id = Math.random().toString(36).substring(7);

    const result = await sql`
      INSERT INTO customers (id, username, contact_info, referral_id, referred_by_staff_id)
      VALUES (${id}, ${username}, ${contact}, ${referral_id}, ${staff_id || null})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const staff_id = searchParams.get('staff_id');
    const lookup = searchParams.get('lookup');

    await ensureDb();
    const sql = getSql();

    if (lookup) {
      const customer = await sql`SELECT * FROM customers WHERE contact_info = ${lookup} LIMIT 1`;
      return NextResponse.json(customer[0] || { error: 'Not found' });
    }

    if (!staff_id) return NextResponse.json({ error: 'Missing staff_id' }, { status: 400 });

    const staff = await sql`SELECT username FROM staff WHERE staff_id = ${staff_id}`;
    return NextResponse.json(staff[0] || { username: 'Our Team' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
