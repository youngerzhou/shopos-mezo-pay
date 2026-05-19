import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getSql } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const sql = getSql();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim().toLowerCase() || '';

    const rows = await sql`
      SELECT
        c.id,
        c.username AS name,
        c.contact_info,
        c.phone,
        c.email,
        c.referral_id,
        c.wallet_address,
        c.created_at,
        COALESCE(COUNT(uc.id) FILTER (
          WHERE uc.status = 'unused'
          AND uc.expires_at > CURRENT_TIMESTAMP
        ), 0)::int AS unused_coupon_count,
        COALESCE(COUNT(uc.id) FILTER (
          WHERE uc.status = 'used'
        ), 0)::int AS used_coupon_count,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', uc.id,
              'title', uc.title,
              'discount_amount', uc.discount_amount::float,
              'minimum_spend', uc.minimum_spend::float,
              'status', uc.status,
              'expires_at', uc.expires_at
            )
            ORDER BY uc.created_at DESC
          ) FILTER (
            WHERE uc.id IS NOT NULL
            AND uc.status = 'unused'
            AND uc.expires_at > CURRENT_TIMESTAMP
          ),
          '[]'::json
        ) AS unused_coupons
      FROM customers c
      LEFT JOIN user_coupons uc
        ON uc.customer_referral_id = c.referral_id
        OR (
          c.wallet_address IS NOT NULL
          AND uc.customer_wallet IS NOT NULL
          AND LOWER(uc.customer_wallet) = LOWER(c.wallet_address)
        )
      WHERE (
        ${q} = ''
        OR LOWER(COALESCE(c.username, '')) LIKE ${`%${q}%`}
        OR LOWER(COALESCE(c.phone, '')) LIKE ${`%${q}%`}
        OR LOWER(COALESCE(c.email, '')) LIKE ${`%${q}%`}
        OR LOWER(COALESCE(c.contact_info, '')) LIKE ${`%${q}%`}
        OR LOWER(COALESCE(c.referral_id, '')) LIKE ${`%${q}%`}
        OR LOWER(COALESCE(c.wallet_address, '')) LIKE ${`%${q}%`}
      )
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ members: rows });
  } catch (error: any) {
    console.error('API GET /api/admin/members Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to load members.' }, { status: 500 });
  }
}
