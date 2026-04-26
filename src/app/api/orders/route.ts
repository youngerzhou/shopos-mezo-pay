
import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getCustomerByReferralId, bindWalletToCustomer, getSetting } from '@/app/lib/db';
import { getPassportLevel, calculateDiscountedPrice } from '@/app/lib/passport';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, walletAddress, amount } = body;

    // Load dynamic settings
    const globalDiscountRate = parseFloat(await getSetting('Global_Discount_Rate', '0.05'));
    const commissionRate = parseFloat(await getSetting('Referral_Commission_Rate', '0.05'));
    const passportMultiplier = parseFloat(await getSetting('Mezo_Passport_Bonus_Multiplier', '1.0'));

    let effectiveCustomerId = customerId;

    // WALLET AUTO-LOOKUP: If no member card scanned, check if wallet belongs to a member
    if (!effectiveCustomerId && walletAddress) {
      const { getSql, ensureDb } = await import('@/app/lib/db');
      await ensureDb();
      const sql = getSql();
      const existingCustomer = await sql`SELECT referral_id FROM customers WHERE wallet_address = ${walletAddress}`;
      if (existingCustomer.length > 0) {
        effectiveCustomerId = existingCustomer[0].referral_id;
        console.log(`[Auto-Lookup] SUCCESS: ${walletAddress} matched to ${effectiveCustomerId}`);
      }
    }

    // 1. Verify Customer Identity (Retail CRM)
    const customer = effectiveCustomerId ? await getCustomerByReferralId(effectiveCustomerId) : null;
    
    // FAST PAY & TIERED DISCOUNT LOGIC: Fetch allowance and determine tier/discount
    let fastPayTriggered = false;
    let fastPayHash = null;
    let allowanceDiscount = 0;
    let membershipTierLabel = 'Standard';

    if (walletAddress) {
      const { getOnChainAllowance, getTierForAllowance, checkFastPayAllowance, executePullPayment } = await import('@/app/lib/mezo-pull-payment');
      
      // Fetch current on-chain allowance limit
      const currentAllowance = await getOnChainAllowance(walletAddress);
      const tierInfo = getTierForAllowance(currentAllowance);
      
      allowanceDiscount = tierInfo.discount;
      membershipTierLabel = tierInfo.label;
      console.log(`[Tiered Discount] Wallet: ${walletAddress} | Tier: ${membershipTierLabel} | Discount: ${allowanceDiscount}`);

      // Handle Pull Payment if enabled
      if (customer?.fast_pay_enabled) {
        const isAllowed = await checkFastPayAllowance(walletAddress, amount || 1);
        if (isAllowed) {
          console.log(`[Fast Pay] TRIGGERED for customer ${walletAddress}`);
          const POS_RECIPIENT = await getSetting('Merchant_Wallet_Address', '0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7');
          fastPayHash = await executePullPayment(walletAddress, POS_RECIPIENT, amount || 1);
          if (fastPayHash) {
            fastPayTriggered = true;
          }
        }
      }
    }

    // 2. Lock attribution and initial discount
    // Guest = 0, Member = Global Discount + Tier Discount
    let finalDiscountRate = customer ? (globalDiscountRate + allowanceDiscount) : 0;
    let passportLevel = 0;
    
    // 3. Handle Payment Phase (Step 2)
    if (walletAddress) {
      // Auto-Bind: Permanent link if currently null and we have a confirmed customer
      if (customer && !customer.wallet_address) {
        console.log(`[Auto-Bind] Linking wallet ${walletAddress} to member ${effectiveCustomerId}`);
        await bindWalletToCustomer(effectiveCustomerId, walletAddress);
      }
      
      // Passport analysis
      passportLevel = getPassportLevel(walletAddress);
      const passportData = calculateDiscountedPrice(amount || 1, passportLevel);
      finalDiscountRate += (passportData.discountRate * passportMultiplier);
    }

    const baseAmount = amount || 1;
    const finalPrice = baseAmount * (1 - finalDiscountRate);
    const commissionAmount = customer ? (baseAmount * commissionRate) : 0; 
    
    // POS Machine fixed recipient
    const POS_RECIPIENT = await getSetting('Merchant_Wallet_Address', '0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7');
    
    // Create order (With Fast Pay status if applicable)
    const order = await createOrder(
      POS_RECIPIENT, 
      finalPrice, 
      walletAddress || 'pending_payment', 
      baseAmount, 
      finalDiscountRate, 
      passportLevel,
      customer?.referred_by_staff_id || null,
      commissionAmount,
      null, // sessionToken
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

    const { getSql, ensureDb } = await import('@/app/lib/db');
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
