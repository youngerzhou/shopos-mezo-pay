import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getSql } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

const ADMIN_COUPONS: Record<string, {
  couponType: string;
  title: string;
  discountAmount: number;
  minimumSpend: number;
  expiresInDays: number;
}> = {
  'new-member-welcome': {
    couponType: 'threshold_discount',
    title: 'New Member Welcome Coupon',
    discountAmount: 5,
    minimumSpend: 100,
    expiresInDays: 30
  },
  'next-purchase-reward': {
    couponType: 'threshold_discount',
    title: 'Next Purchase Coupon',
    discountAmount: 3,
    minimumSpend: 50,
    expiresInDays: 30
  }
};

function couponExpiry(days: number) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    await ensureDb();
    const sql = getSql();
    const { memberId } = await params;
    const body = await req.json().catch(() => ({}));
    const couponId = typeof body.couponId === 'string' ? body.couponId.trim() : '';
    const coupon = ADMIN_COUPONS[couponId];

    if (!coupon) {
      return NextResponse.json({ error: 'Coupon campaign not found.' }, { status: 404 });
    }

    const members = await sql`
      SELECT id, username, referral_id, wallet_address
      FROM customers
      WHERE id = ${memberId}
      OR referral_id = ${memberId}
      LIMIT 1
    `;
    const member = members[0];
    if (!member) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    const referralId = member.referral_id || null;
    const wallet = member.wallet_address ? String(member.wallet_address).toLowerCase().trim() : null;

    if (couponId === 'new-member-welcome') {
      const existing = await sql`
        SELECT id, status
        FROM user_coupons
        WHERE title = ${coupon.title}
        AND (
          (${referralId}::text IS NOT NULL AND customer_referral_id = ${referralId})
          OR (${wallet}::text IS NOT NULL AND LOWER(customer_wallet) = ${wallet})
        )
        LIMIT 1
      `;
      if (existing[0]) {
        return NextResponse.json({
          error: 'This member already has a New Member Welcome Coupon.',
          coupon: existing[0]
        }, { status: 409 });
      }
    } else {
      const existingUnused = await sql`
        SELECT id, status
        FROM user_coupons
        WHERE title = ${coupon.title}
        AND status = 'unused'
        AND expires_at > CURRENT_TIMESTAMP
        AND (
          (${referralId}::text IS NOT NULL AND customer_referral_id = ${referralId})
          OR (${wallet}::text IS NOT NULL AND LOWER(customer_wallet) = ${wallet})
        )
        LIMIT 1
      `;
      if (existingUnused[0]) {
        return NextResponse.json({
          error: 'This member already has an unused coupon with this title.',
          coupon: existingUnused[0]
        }, { status: 409 });
      }
    }

    const id = `cpn_admin_${Math.random().toString(36).slice(2, 10)}`;
    const sourceRef = couponId === 'new-member-welcome'
      ? couponId
      : `${couponId}_${Date.now().toString(36)}`;

    const inserted = await sql`
      INSERT INTO user_coupons (
        id, customer_wallet, customer_referral_id, coupon_type, title,
        discount_amount, minimum_spend, status, source, source_ref, expires_at
      )
      VALUES (
        ${id},
        ${wallet},
        ${referralId},
        ${coupon.couponType},
        ${coupon.title},
        ${coupon.discountAmount},
        ${coupon.minimumSpend},
        'unused',
        'ADMIN_MEMBER_SEND',
        ${sourceRef},
        ${couponExpiry(coupon.expiresInDays)}
      )
      RETURNING
        id, customer_wallet, customer_referral_id, coupon_type, title,
        discount_amount::float, minimum_spend::float,
        status, source, source_ref, created_at, expires_at
    `;

    return NextResponse.json({ coupon: inserted[0] });
  } catch (error: any) {
    console.error('API POST /api/admin/members/[memberId]/send-coupon Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to send coupon.' }, { status: 500 });
  }
}
