import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getAvailableCoupons, getCustomerByReferralId } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();

    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet')?.trim();
    const referralId = searchParams.get('referral_id')?.trim();
    const amountParam = searchParams.get('amount');
    const amount = amountParam == null || amountParam === '' ? undefined : Number(amountParam);

    let customerWallet = wallet || null;
    if (!customerWallet && referralId) {
      const customer = await getCustomerByReferralId(referralId);
      customerWallet = customer?.wallet_address || null;
    }

    if (!customerWallet && !referralId) {
      return NextResponse.json({ error: 'Missing customer identity' }, { status: 400 });
    }

    const coupons = await getAvailableCoupons(customerWallet, amount, referralId);
    return NextResponse.json({ coupons });
  } catch (error: any) {
    console.error('API GET /api/customers/coupons Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
