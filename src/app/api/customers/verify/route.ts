import { NextRequest, NextResponse } from 'next/server';
import { getSql, ensureDb } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('Backend: Received verify request', body);
        const { referral_id, action, allowance_amount } = body;

        if (!referral_id) {
            return NextResponse.json({ error: 'Missing referral_id' }, { status: 400 });
        }

        await ensureDb();
        const sql = getSql();

        if (action === 'verify_identity') {
            const signature = body.signature as string | undefined;
            if (!signature) {
                return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
            }
            console.log('Backend: verify_identity signature', signature, 'for referral_id', referral_id);
            // Update identity verification status and persist the wallet signature
            const result = await sql`
        UPDATE customers
        SET identity_verified = TRUE, verified_at = CURRENT_TIMESTAMP, identity_signature = ${signature}
        WHERE referral_id = ${referral_id}
        RETURNING *
      `;

            console.log('Backend: verify_identity result', result[0]);
            if (result.length === 0) {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                customer: result[0]
            });
        } else if (action === 'enable_fast_pay') {
            // Update fast pay authorization
            console.log('====================================');
            console.log('Received frontend authorization request.');
            console.log('User ID:', referral_id);
            console.log('Allowance amount:', allowance_amount);
            console.log('Transaction hash:', body.tx_hash);
            console.log('====================================');

            const allowanceAmount = Number(allowance_amount);
            const txHash = body.tx_hash as string | undefined;
            console.log('Backend: Enabling fast pay for referral_id', referral_id, 'allowance_amount', allowance_amount, 'parsed', allowanceAmount, 'tx_hash', txHash);
            if (allowance_amount === undefined || allowance_amount === null || Number.isNaN(allowanceAmount)) {
                return NextResponse.json({ error: 'Missing or invalid allowance_amount for fast pay' }, { status: 400 });
            }

            // Security: Validate allowance amount against authorized whitelist
            const ALLOWANCE_TIERS = [100, 500, 1000];
            if (!ALLOWANCE_TIERS.includes(allowanceAmount)) {
                console.warn('[Backend/verify] Rejected non-whitelisted allowance amount:', allowanceAmount);
                return NextResponse.json({ error: 'Invalid allowance amount. Must be one of 100, 500, or 1000.' }, { status: 400 });
            }

            // Check for existing fast pay with same tx_hash or allowance_amount to prevent duplicates
            const existing = await sql`
        SELECT id, fast_pay_enabled, fast_pay_allowance, fast_pay_tx_hash
        FROM customers
        WHERE referral_id = ${referral_id}
        LIMIT 1
      `;

            if (existing.length > 0) {
                const customer = existing[0];
                if (customer.fast_pay_enabled && customer.fast_pay_allowance === allowanceAmount) {
                    console.log('Backend: Fast pay already enabled with same allowance, skipping update');
                    return NextResponse.json({
                        success: true,
                        customer: customer,
                        message: 'Fast pay already enabled with this allowance'
                    });
                }
                if (txHash && customer.fast_pay_tx_hash === txHash) {
                    console.log('Backend: Fast pay tx_hash already processed, skipping update');
                    return NextResponse.json({
                        success: true,
                        customer: customer,
                        message: 'Fast pay transaction already processed'
                    });
                }
            }

            const result = await sql`
        UPDATE customers
        SET fast_pay_enabled = TRUE, fast_pay_allowance = ${allowanceAmount}, fast_pay_tx_hash = ${txHash || null}
        WHERE referral_id = ${referral_id}
        RETURNING *
      `;

            console.log('Backend: fast_pay_enable result', result[0]);
            if (result.length === 0) {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                customer: result[0]
            });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const referral_id = searchParams.get('referral_id');

        if (!referral_id) {
            return NextResponse.json({ error: 'Missing referral_id parameter' }, { status: 400 });
        }

        await ensureDb();
        const sql = getSql();

        const customer = await sql`
      SELECT id, username, contact_info, referral_id, identity_verified, identity_signature, verified_at, fast_pay_enabled, fast_pay_allowance, fast_pay_tx_hash, created_at
      FROM customers
      WHERE referral_id = ${referral_id}
      LIMIT 1
    `;

        if (customer.length === 0) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        console.log('Backend: Retrieved customer verify data', customer[0]);
        return NextResponse.json(customer[0]);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
