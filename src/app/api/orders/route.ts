import { NextRequest, NextResponse } from 'next/server';
import {
  createOrder,
  getCustomerByReferralId,
  bindWalletToCustomer,
  getSetting,
  getSql,
  ensureDb,
} from '@/app/lib/db';
import { getPassportLevel, calculateDiscountedPrice } from '@/app/lib/passport';
import {
  getOnChainAllowance,
  getTierForAllowance,
  executePullPayment,
} from '@/app/lib/mezo-pull-payment';
import { roundMoney2, roundDiscountRate } from '@/app/lib/money';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, walletAddress, amount } = body;
    const baseAmount = roundMoney2(amount != null && amount !== '' ? Number(amount) : 1) || 1;

    // Load dynamic settings
    const globalDiscountRate = roundDiscountRate(parseFloat(await getSetting('Global_Discount_Rate', '0.05')));
    const commissionRate = roundDiscountRate(parseFloat(await getSetting('Referral_Commission_Rate', '0.05')));
    const passportMultiplier = roundDiscountRate(parseFloat(await getSetting('Mezo_Passport_Bonus_Multiplier', '1.0')));

    let effectiveCustomerId = customerId;

    // WALLET AUTO-LOOKUP: If no member card scanned, check if wallet belongs to a member
    if (!effectiveCustomerId && walletAddress) {
      await ensureDb();
      const sql = getSql();
      const existingCustomer = await sql`SELECT referral_id FROM customers WHERE wallet_address = ${walletAddress}`;
      if (existingCustomer.length > 0) {
        effectiveCustomerId = existingCustomer[0].referral_id;
        console.log(`[Auto-Lookup] SUCCESS: ${walletAddress} matched to ${effectiveCustomerId}`);
      }
    }

    // 1. Verify Customer Identity
    const customer = effectiveCustomerId ? await getCustomerByReferralId(effectiveCustomerId) : null;

    // 2. Calculate Discounts & Final Price
    let allowanceDiscount = 0;
    let membershipTierLabel = 'Standard';
    let finalDiscountRate = 0;
    let passportLevel = 0;

    if (walletAddress) {
      // Auto-Bind: Permanent link if currently null
      if (customer && !customer.wallet_address) {
        console.log(`[Auto-Bind] Linking wallet ${walletAddress} to member ${effectiveCustomerId}`);
        await bindWalletToCustomer(effectiveCustomerId, walletAddress);
      }

      // Determine Tier & Allowance Discount (On-Chain)
      const currentAllowance = await getOnChainAllowance(walletAddress);
      const tierInfo = getTierForAllowance(currentAllowance);
      allowanceDiscount = tierInfo.discount;
      membershipTierLabel = tierInfo.label;
      console.log(`[Tiered Discount] Wallet: ${walletAddress} | Tier: ${membershipTierLabel} | Discount: ${allowanceDiscount}`);

      // Passport analysis
      passportLevel = getPassportLevel(walletAddress);
      const passportData = calculateDiscountedPrice(baseAmount, (passportLevel || 1) as 1 | 2 | 3);

      // Guest = 0, Member = Global Discount + Tier Discount
      finalDiscountRate = customer
        ? roundDiscountRate(globalDiscountRate + allowanceDiscount)
        : 0;

      finalDiscountRate = roundDiscountRate(
        finalDiscountRate + passportData.discountRate * passportMultiplier
      );
    } else {
      finalDiscountRate = 0;
    }

    const finalPrice = roundMoney2(baseAmount * (1 - finalDiscountRate));
    const commissionAmount = roundMoney2(customer ? baseAmount * commissionRate : 0);
    const POS_RECIPIENT = await getSetting('Merchant_Wallet_Address', '0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7');

    // 3. Fast Pay Logic (DB-based Authorization Check)
    // Requirement: Check DB fast_pay_enabled and fast_pay_allowance
    let fastPayTriggered = false;
    let fastPayHash = null;

    if (customer?.fast_pay_enabled && walletAddress) {
      const dbAllowance = Number(customer.fast_pay_allowance || 0);
      console.log(`[Fast Pay] Checking DB: Enabled=${customer.fast_pay_enabled}, Allowance=${dbAllowance}, Price=${finalPrice}`);

      if (dbAllowance >= finalPrice) {
        console.log(`[Fast Pay] Authorization Passed. Initiating transferFrom for ${finalPrice} MUSD.`);
        fastPayHash = await executePullPayment(walletAddress, POS_RECIPIENT, finalPrice);
        if (fastPayHash) {
          fastPayTriggered = true;
        } else {
          console.warn('[Fast Pay] Execution failed. Fallback to manual payment.');
        }
      } else {
        console.log(`[Fast Pay] Insufficient DB Allowance (${dbAllowance} < ${finalPrice}). Fallback to manual payment.`);
      }
    }

    // 4. Create Order
    const order = await createOrder(
      POS_RECIPIENT,
      finalPrice,
      walletAddress || 'pending_payment',
      baseAmount,
      finalDiscountRate,
      passportLevel,
      customer?.referred_by_staff_id || null,
      commissionAmount,
      undefined, // sessionToken
      fastPayTriggered ? 'success' : 'pending',
      fastPayHash
    );

    return NextResponse.json({
      ...order,
      customer_id: effectiveCustomerId,
      passport_level: passportLevel,
      membership_tier: membershipTierLabel,
      referral_applied: !!customer,
      fast_pay_triggered: fastPayTriggered
    });
  } catch (error: any) {
    console.error('API POST /api/orders Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, status, txHash } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: 'Missing orderId or status' }, { status: 400 });
    }

    await ensureDb();
    const sql = getSql();

    const result = await sql`
      UPDATE transactions 
      SET status = ${status}, transaction_hash = ${txHash || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${orderId}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
