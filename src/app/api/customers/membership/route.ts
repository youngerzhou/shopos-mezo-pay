import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getCustomerMembership } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();

    const { searchParams } = new URL(req.url);
    const referralId = searchParams.get('referral_id')?.trim();

    if (!referralId) {
      return NextResponse.json({ error: 'Missing referral_id' }, { status: 400 });
    }

    const membership = await getCustomerMembership(referralId);
    if (!membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(membership);
  } catch (error: any) {
    console.error('API GET /api/customers/membership Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
