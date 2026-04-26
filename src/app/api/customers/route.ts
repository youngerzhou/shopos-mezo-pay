
import { NextRequest, NextResponse } from 'next/server';
import { createCustomer, getStaffByStaffId } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { staffPromoId } = body;

    if (!staffPromoId) {
      return NextResponse.json({ error: 'Missing staffPromoId' }, { status: 400 });
    }

    // Validate staff
    const staff = await getStaffByStaffId(staffPromoId);
    if (!staff) {
      return NextResponse.json({ error: 'Invalid Staff ID' }, { status: 404 });
    }

    // Phase 1: Create customer record with unique referral_id
    const referralId = 'MEM_' + Math.random().toString(36).substring(2, 9).toUpperCase();
    
    // Create customer without wallet (NULL)
    const customer = await createCustomer(referralId, 1, staffPromoId);

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('API /api/customers Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
