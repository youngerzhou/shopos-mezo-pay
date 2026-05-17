import { NextRequest, NextResponse } from 'next/server';
import { getSql, ensureDb, issueFastPayAuthorizationCoupon } from '@/app/lib/db';
import { getOnChainAllowance } from '@/app/lib/mezo-pull-payment';

export const dynamic = 'force-dynamic';

const ALLOWANCE_TIERS = [100, 500, 1000];

function allowanceUnitsToMusd(allowance: bigint) {
    return Number(allowance) / 1e18;
}

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

            if (!ALLOWANCE_TIERS.includes(allowanceAmount)) {
                console.warn('[Backend/verify] Rejected non-whitelisted allowance amount:', allowanceAmount);
                return NextResponse.json({ error: 'Invalid allowance amount. Must be one of 100, 500, or 1000.' }, { status: 400 });
            }

            const existing = await sql`
        SELECT id, wallet_address, fast_pay_enabled, fast_pay_allowance, fast_pay_tx_hash
        FROM customers
        WHERE referral_id = ${referral_id}
        LIMIT 1
      `;

            if (existing.length === 0) {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }

            const walletAddress = existing[0].wallet_address;
            if (!walletAddress) {
                return NextResponse.json({ error: 'Customer wallet address is required before enabling Fast Pay' }, { status: 400 });
            }

            const onChainAllowance = await getOnChainAllowance(walletAddress);
            const onChainAllowanceMusd = allowanceUnitsToMusd(onChainAllowance);
            const onChainAuthorized = onChainAllowance > 0n && onChainAllowanceMusd >= allowanceAmount;

            console.log('[Backend/verify] Fast Pay on-chain allowance check', {
                referral_id,
                walletAddress,
                requestedAllowance: allowanceAmount,
                onChainAllowanceRaw: onChainAllowance.toString(),
                onChainAllowanceMusd,
                onChainAuthorized
            });

            if (!onChainAuthorized) {
                const disabled = await sql`
          UPDATE customers
          SET fast_pay_enabled = FALSE, fast_pay_allowance = ${onChainAllowanceMusd}, fast_pay_tx_hash = ${txHash || null}
          WHERE referral_id = ${referral_id}
          RETURNING *
        `;

                return NextResponse.json({
                    error: 'Fast Pay approval was not found on-chain for the configured ShopOS PullPayment contract.',
                    fast_pay_enabled: false,
                    fast_pay_allowance: onChainAllowanceMusd,
                    customer: disabled[0]
                }, { status: 400 });
            }

            // Check for existing fast pay with same tx_hash or allowance_amount after current on-chain allowance is verified.
            if (existing.length > 0) {
                const customer = existing[0];
                if (customer.fast_pay_enabled && customer.fast_pay_allowance === allowanceAmount) {
                    console.log('Backend: Fast pay already enabled with same allowance, skipping update');
                    const issuedCoupon = await issueFastPayAuthorizationCoupon(
                        customer.wallet_address,
                        allowanceAmount,
                        txHash || `ALLOWANCE_${allowanceAmount}`
                    );
                    return NextResponse.json({
                        success: true,
                        issued_coupon: issuedCoupon,
                        customer: customer,
                        message: 'Fast pay already enabled with this allowance'
                    });
                }
                if (txHash && customer.fast_pay_tx_hash === txHash) {
                    console.log('Backend: Fast pay tx_hash already processed, skipping update');
                    const issuedCoupon = await issueFastPayAuthorizationCoupon(
                        customer.wallet_address,
                        allowanceAmount,
                        txHash
                    );
                    return NextResponse.json({
                        success: true,
                        issued_coupon: issuedCoupon,
                        customer: customer,
                        message: 'Fast pay transaction already processed'
                    });
                }
            }

            const result = await sql`
        UPDATE customers
        SET fast_pay_enabled = TRUE, fast_pay_allowance = ${onChainAllowanceMusd}, fast_pay_tx_hash = ${txHash || null}
        WHERE referral_id = ${referral_id}
        RETURNING *
      `;

            console.log('Backend: fast_pay_enable result', result[0]);
            if (result.length === 0) {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }
            const issuedCoupon = await issueFastPayAuthorizationCoupon(
                result[0].wallet_address,
                onChainAllowanceMusd,
                txHash || `ALLOWANCE_${onChainAllowanceMusd}`
            );

            return NextResponse.json({
                success: true,
                issued_coupon: issuedCoupon,
                customer: {
                    ...result[0],
                    fast_pay_authorized: !!result[0].fast_pay_enabled
                }
            });
        } else if (action === 'sync_fast_pay') {
            const txHash = body.tx_hash as string | undefined;
            const existing = await sql`
        SELECT id, wallet_address
        FROM customers
        WHERE referral_id = ${referral_id}
        LIMIT 1
      `;

            if (existing.length === 0) {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }

            const walletAddress = existing[0].wallet_address;
            if (!walletAddress) {
                return NextResponse.json({ error: 'Customer wallet address is required before syncing Fast Pay' }, { status: 400 });
            }

            const onChainAllowance = await getOnChainAllowance(walletAddress);
            const onChainAllowanceMusd = allowanceUnitsToMusd(onChainAllowance);
            const fastPayEnabled = onChainAllowance > 0n;

            const result = await sql`
        UPDATE customers
        SET fast_pay_enabled = ${fastPayEnabled}, fast_pay_allowance = ${onChainAllowanceMusd}, fast_pay_tx_hash = COALESCE(${txHash || null}, fast_pay_tx_hash)
        WHERE referral_id = ${referral_id}
        RETURNING id, username, contact_info, referral_id, wallet_address, identity_verified, identity_signature, verified_at, fast_pay_enabled, fast_pay_allowance, fast_pay_tx_hash, created_at
      `;
            const issuedCoupon = fastPayEnabled
                ? await issueFastPayAuthorizationCoupon(
                    result[0].wallet_address,
                    onChainAllowanceMusd,
                    txHash || `ALLOWANCE_${onChainAllowanceMusd}`
                )
                : null;

            console.log('[Backend/verify] Synced Fast Pay after customer allowance refresh', {
                referral_id,
                walletAddress,
                txHash,
                onChainAllowanceRaw: onChainAllowance.toString(),
                onChainAllowanceMusd,
                fastPayEnabled
            });

            return NextResponse.json({
                success: true,
                issued_coupon: issuedCoupon,
                customer: {
                    ...result[0],
                    fast_pay_authorized: fastPayEnabled
                }
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
      SELECT id, username, contact_info, referral_id, wallet_address, identity_verified, identity_signature, verified_at, fast_pay_enabled, fast_pay_allowance, fast_pay_tx_hash, created_at
      FROM customers
      WHERE referral_id = ${referral_id}
      LIMIT 1
    `;

        if (customer.length === 0) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const syncedCustomer = { ...customer[0] };
        if (syncedCustomer.wallet_address) {
            try {
                const onChainAllowance = await getOnChainAllowance(syncedCustomer.wallet_address);
                const onChainAllowanceMusd = allowanceUnitsToMusd(onChainAllowance);
                const fastPayEnabled = onChainAllowance > 0n;

                const result = await sql`
          UPDATE customers
          SET fast_pay_enabled = ${fastPayEnabled}, fast_pay_allowance = ${onChainAllowanceMusd}
          WHERE referral_id = ${referral_id}
          RETURNING id, username, contact_info, referral_id, wallet_address, identity_verified, identity_signature, verified_at, fast_pay_enabled, fast_pay_allowance, fast_pay_tx_hash, created_at
        `;

                Object.assign(syncedCustomer, {
                    ...result[0],
                    fast_pay_authorized: fastPayEnabled
                });
                console.log('[Backend/verify] Synced Fast Pay from on-chain allowance', {
                    referral_id,
                    walletAddress: syncedCustomer.wallet_address,
                    onChainAllowanceRaw: onChainAllowance.toString(),
                    onChainAllowanceMusd,
                    fastPayEnabled
                });
            } catch (err) {
                console.warn('[Backend/verify] Failed to sync Fast Pay allowance from chain:', err);
                syncedCustomer.fast_pay_enabled = false;
                syncedCustomer.fast_pay_authorized = false;
            }
        } else {
            syncedCustomer.fast_pay_enabled = false;
            syncedCustomer.fast_pay_authorized = false;
        }

        console.log('Backend: Retrieved customer verify data', syncedCustomer);
        return NextResponse.json(syncedCustomer);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
