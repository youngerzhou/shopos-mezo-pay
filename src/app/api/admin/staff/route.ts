
import { NextRequest, NextResponse } from 'next/server';
import { getSql, ensureDb } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const sql = getSql();
    const staff = await sql`SELECT * FROM staff ORDER BY created_at DESC`;
    return NextResponse.json(staff);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { staff_id, username, role, store_id } = body;

    if (!staff_id || !username || !role || !store_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await ensureDb();
    const sql = getSql();
    const id = Math.random().toString(36).substring(7);

    const result = await sql`
      INSERT INTO staff (id, staff_id, username, role, store_id, password_hash)
      VALUES (${id}, ${staff_id}, ${username}, ${role}, ${store_id}, 'temp_pass')
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, role, store_id, username } = body;

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await ensureDb();
    const sql = getSql();

    const result = await sql`
      UPDATE staff 
      SET role = ${role}, store_id = ${store_id}, username = ${username}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await ensureDb();
    const sql = getSql();
    await sql`DELETE FROM staff WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
