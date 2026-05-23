import { NextRequest, NextResponse } from 'next/server';
import {
  ensureDb,
  getCustomerByReferralId,
  getCustomerByWallet,
  getSql,
  getSetting
} from '@/app/lib/db';
import { roundMoney2 } from '@/app/lib/money';

export const dynamic = 'force-dynamic';

type ClaimableCoupon = {
  id: string;
  couponType: string;
  title: string;
  discountAmount: number;
  minimumSpend: number;
  expiresInDays: number;
};

const BUILTIN_COUPONS: Record<string, ClaimableCoupon> = {
  'new-member-welcome': {
    id: 'new-member-welcome',
    couponType: 'threshold_discount',
    title: 'New Member Welcome Coupon',
    discountAmount: 5,
    minimumSpend: 100,
    expiresInDays: 30
  },
  'next-purchase-reward': {
    id: 'next-purchase-reward',
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

async function getClaimableCoupon(couponId: string): Promise<ClaimableCoupon | null> {
  const builtin = BUILTIN_COUPONS[couponId];
  if (builtin) return builtin;

  // Load custom campaigns from settings
  try {
    const campaignsSetting = await getSetting('coupon_campaigns', '[]');
    const parsedCampaigns = JSON.parse(campaignsSetting);
    if (Array.isArray(parsedCampaigns)) {
      const found = parsedCampaigns.find((c: any) => c.id === couponId);
      if (found) {
        return {
          id: found.id,
          couponType: found.couponType,
          title: found.title,
          discountAmount: roundMoney2(Number(found.discountAmount || 0)),
          minimumSpend: roundMoney2(Number(found.minimumSpend || 0)),
          expiresInDays: found.expiresInDays || 30
        };
      }
    }
  } catch (err) {
    console.error('Failed to parse dynamic campaigns in claim endpoint:', err);
  }

  const sql = getSql();
  const rows = await sql`
    SELECT id, coupon_type, title, discount_amount::float, minimum_spend::float
    FROM user_coupons
    WHERE id = ${couponId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    couponType: row.coupon_type || 'threshold_discount',
    title: row.title,
    discountAmount: roundMoney2(Number(row.discount_amount || 0)),
    minimumSpend: roundMoney2(Number(row.minimum_spend || 0)),
    expiresInDays: 30
  };
}

async function getCampaignStats(coupon: ClaimableCoupon) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      COUNT(*)::int AS claimed_count,
      COALESCE(SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END), 0)::int AS used_count
    FROM user_coupons
    WHERE title = ${coupon.title}
    AND source = 'QR_COUPON_CLAIM'
    AND source_ref = ${coupon.id}
  `;
  return {
    claimedCount: Number(rows[0]?.claimed_count || 0),
    usedCount: Number(rows[0]?.used_count || 0)
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ couponId: string }> }) {
  try {
    await ensureDb();
    const { couponId } = await params;
    const coupon = await getClaimableCoupon(couponId);
    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found.' }, { status: 404 });
    }

    const stats = await getCampaignStats(coupon);
    return NextResponse.json({
      coupon: {
        id: coupon.id,
        coupon_type: coupon.couponType,
        title: coupon.title,
        discount_amount: coupon.discountAmount,
        minimum_spend: coupon.minimumSpend,
        expires_in_days: coupon.expiresInDays
      },
      stats
    });
  } catch (error: any) {
    console.error('API GET /api/customers/coupons/campaign/[couponId] Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to load coupon.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ couponId: string }> }) {
  try {
    await ensureDb();
    const { couponId } = await params;
    const coupon = await getClaimableCoupon(couponId);
    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found.' }, { status: 404 });
    }

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

    // Different duplicate prevention strategies for different coupon types
    let existing;
    if (coupon.id === 'new-member-welcome') {
      // New Member Welcome Coupon: lifetime limit - can only claim once ever
      existing = await sql`
        SELECT
          id, customer_wallet, customer_referral_id, coupon_type, title,
          discount_amount::float, minimum_spend::float,
          status, source, source_ref, created_at, expires_at
        FROM user_coupons
        WHERE title = ${coupon.title}
        AND (
          (${customerReferralId}::text IS NOT NULL AND customer_referral_id = ${customerReferralId})
          OR (${normalizedWallet}::text IS NOT NULL AND LOWER(customer_wallet) = ${normalizedWallet})
        )
        LIMIT 1
      `;
    } else {
      // Other coupons (e.g., Next Purchase Coupon): allow re-claiming after use
      // Only block if there's an unused coupon of the same type
      existing = await sql`
        SELECT
          id, customer_wallet, customer_referral_id, coupon_type, title,
          discount_amount::float, minimum_spend::float,
          status, source, source_ref, created_at, expires_at
        FROM user_coupons
        WHERE title = ${coupon.title}
        AND status = 'unused'
        AND (
          (${customerReferralId}::text IS NOT NULL AND customer_referral_id = ${customerReferralId})
          OR (${normalizedWallet}::text IS NOT NULL AND LOWER(customer_wallet) = ${normalizedWallet})
        )
        ORDER BY created_at DESC
        LIMIT 1
      `;
    }

    if (existing[0]) {
      return NextResponse.json({
        alreadyClaimed: true,
        coupon: existing[0],
        error: 'This coupon has already been claimed.'
      }, { status: 409 });
    }

    const id = `cpn_qr_${Math.random().toString(36).slice(2, 10)}`;
    const inserted = await sql`
      INSERT INTO user_coupons (
        id, customer_wallet, customer_referral_id, coupon_type, title,
        discount_amount, minimum_spend, status, source, source_ref, expires_at
      )
      VALUES (
        ${id},
        ${normalizedWallet},
        ${customerReferralId},
        ${coupon.couponType},
        ${coupon.title},
        ${coupon.discountAmount},
        ${coupon.minimumSpend},
        'unused',
        'QR_COUPON_CLAIM',
        ${coupon.id},
        ${couponExpiry(coupon.expiresInDays)}
      )
      RETURNING
        id, customer_wallet, customer_referral_id, coupon_type, title,
        discount_amount::float, minimum_spend::float,
        status, source, source_ref, created_at, expires_at
    `;

    return NextResponse.json({ alreadyClaimed: false, coupon: inserted[0] });
  } catch (error: any) {
    console.error('API POST /api/customers/coupons/campaign/[couponId] Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to claim coupon.' }, { status: 500 });
  }
}
