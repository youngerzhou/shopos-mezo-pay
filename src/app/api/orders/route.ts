
import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getCustomerByReferralId, bindWalletToCustomer, getSetting } from '@/app/lib/db';
import { getPassportLevel, calculateDiscountedPrice } from '@/app/lib/passport';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, walletAddress, amount } = body;

    if (!customerId) {
       return NextResponse.json({ error: 'Step 1 Missing: Scan Member Card' }, { status: 400 });
    }

    // Load dynamic settings
    const globalDiscountRate = parseFloat(await getSetting('Global_Discount_Rate', '0.05'));
    const commissionRate = parseFloat(await getSetting('Referral_Commission_Rate', '0.05'));
    const passportMultiplier = parseFloat(await getSetting('Mezo_Passport_Bonus_Multiplier', '1.0'));

    // 1. Verify Customer Identity (Retail CRM)
    const customer = await getCustomerByReferralId(customerId);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid Member Card' }, { status: 404 });
    }

    // 2. Lock attribution and initial discount
    let finalDiscountRate = globalDiscountRate;
    let passportLevel = 0;
    
    // 3. Handle Payment Phase (Step 2)
    if (walletAddress) {
      // Auto-Bind: Permanent link if currently null
      if (!customer.wallet_address) {
        console.log(`[Auto-Bind] Linking wallet ${walletAddress} to member ${customerId}`);
        await bindWalletToCustomer(customerId, walletAddress);
      }
      
      // Passport analysis
      passportLevel = getPassportLevel(walletAddress);
      const passportData = calculateDiscountedPrice(amount || 1, passportLevel);
      finalDiscountRate += (passportData.discountRate * passportMultiplier);
    }

    const baseAmount = amount || 1;
    const finalPrice = baseAmount * (1 - finalDiscountRate);
    const commissionAmount = baseAmount * commissionRate; 

    // POS Machine fixed recipient
    const POS_RECIPIENT = "0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7";
    
    // Create order
    const order = await createOrder(
      POS_RECIPIENT, 
      finalPrice, 
      walletAddress || 'pending_payment', 
      baseAmount, 
      finalDiscountRate, 
      passportLevel,
      customer.referred_by_staff_id,
      commissionAmount
    );
    
    return NextResponse.json({
      ...order,
      customer_id: customerId,
      passport_level: passportLevel,
      referral_applied: true
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
      UPDATE orders 
      SET status = ${status}, tx_hash = ${txHash || null}, updated_at = CURRENT_TIMESTAMP
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
