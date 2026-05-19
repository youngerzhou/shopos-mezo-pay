import { NextRequest, NextResponse } from 'next/server';
import {
  ensureDb,
  getCustomerByReferralId,
  getCustomerByWallet,
  getSql,
  issueNewMemberCoupon
} from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await ensureDb();

    const body = await req.json().catch(() => ({}));
    const referralId = typeof body.referral_id === 'string' ? body.referral_id.trim() : '';
    const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : '';

    if (!referralId && !wallet) {
      return NextResponse.json({ error: 'Missing customer identity.' }, { status: 400 });
    }

    const customer = referralId
      ? await getCustomerByReferralId(referralId)
      : await getCustomerByWallet(wallet);

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    }

    const customerReferralId = customer.referral_id || referralId || null;
    const customerWallet = customer.wallet_address || wallet || null;
    const normalizedWallet = customerWallet ? String(customerWallet).toLowerCase().trim() : null;
    const sql = getSql();

    const existing = await sql`
      SELECT
        id, customer_wallet, customer_referral_id, coupon_type, title,
        discount_amount::float, minimum_spend::float,
        status, source, source_ref, created_at, expires_at
      FROM user_coupons
      WHERE (source = 'NEW_MEMBER_SIGNUP' OR title = 'New Member Welcome Coupon')
      AND (
        (${customerReferralId}::text IS NOT NULL AND customer_referral_id = ${customerReferralId})
        OR (${normalizedWallet}::text IS NOT NULL AND LOWER(customer_wallet) = ${normalizedWallet})
      )
      LIMIT 1
    `;

    if (existing[0]) {
      return NextResponse.json({
        error: 'New Member Welcome Coupon has already been claimed.',
        coupon: existing[0]
      }, { status: 409 });
    }

    const coupon = await issueNewMemberCoupon(customerWallet, customerReferralId);
    if (!coupon) {
      return NextResponse.json({ error: 'Unable to issue coupon.' }, { status: 500 });
    }

    return NextResponse.json({ coupon });
  } catch (error: any) {
    console.error('API POST /api/customers/coupons/claim-new-member Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to claim coupon.' }, { status: 500 });
  }
}
