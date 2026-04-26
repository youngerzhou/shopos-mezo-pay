
import { NextRequest, NextResponse } from 'next/server';
import { getStaffByStaffId, getSql, ensureDb } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get('staffId');

    if (!staffId) {
      return NextResponse.json({ error: 'Missing staffId' }, { status: 400 });
    }

    const staff = await getStaffByStaffId(staffId);
    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    // Get recent customers referred by this staff
    const recentCustomers = await sql`
      SELECT wallet_address, level, created_at 
      FROM customers 
      WHERE referred_by_staff_id = ${staffId} 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    
    return NextResponse.json({
      ...staff,
      recent_customers: recentCustomers
    });
  } catch (error: any) {
    console.error('API /api/staff/stats Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
