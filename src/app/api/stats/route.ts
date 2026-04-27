import { NextRequest, NextResponse } from 'next/server';
import { getSql, ensureDb } from '@/app/lib/db';
import { roundMoney2 } from '@/app/lib/money';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || 'staff';
    const storeId = searchParams.get('storeId');
    const staffId = searchParams.get('staffId');

    await ensureDb();
    const sql = getSql();

    if (role === 'admin') {
      // Global stats
      const revenue = await sql`SELECT SUM(amount)::float as total FROM transactions WHERE status = 'success'`;
      const referrals = await sql`SELECT COUNT(*)::int as total FROM customers WHERE referred_by_staff_id IS NOT NULL`;
      const storeStats = await sql`
        SELECT 
          s.store_id, 
          COUNT(c.id)::int as customer_count,
          SUM(t.amount)::float as store_revenue
        FROM staff s
        LEFT JOIN customers c ON s.staff_id = c.referred_by_staff_id
        LEFT JOIN transactions t ON c.wallet_address = t.sender AND t.status = 'success'
        GROUP BY s.store_id
      `;

      return NextResponse.json({
        total_revenue: roundMoney2(Number(revenue[0]?.total) || 0),
        total_referrals: referrals[0]?.total || 0,
        store_stats: storeStats.map((row: { store_id: string; customer_count: number; store_revenue: number | null }) => ({
          ...row,
          store_revenue: roundMoney2(Number(row.store_revenue) || 0),
        })),
      });
    }

    if (role === 'manager' && storeId) {
      // Store stats
      const storeRevenue = await sql`
        SELECT SUM(t.amount)::float as total 
        FROM transactions t
        JOIN staff s ON t.referral_id = s.staff_id
        WHERE s.store_id = ${storeId} AND t.status = 'success'
      `;
      const staffPerformance = await sql`
        SELECT staff_id, username, total_referrals 
        FROM staff 
        WHERE store_id = ${storeId}
      `;

      return NextResponse.json({
        store_id: storeId,
        store_revenue: roundMoney2(Number(storeRevenue[0]?.total) || 0),
        staff_performance: staffPerformance
      });
    }

    // Default: Staff stats
    if (staffId) {
      const staff = await sql`SELECT * FROM staff WHERE staff_id = ${staffId}`;
      if (staff.length === 0) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });

      const recentCustomers = await sql`
        SELECT wallet_address, level, created_at 
        FROM customers 
        WHERE referred_by_staff_id = ${staffId} 
        ORDER BY created_at DESC 
        LIMIT 10
      `;

      return NextResponse.json({
        ...staff[0],
        recent_customers: recentCustomers
      });
    }

    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  } catch (error: any) {
    console.error('API /api/stats Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
