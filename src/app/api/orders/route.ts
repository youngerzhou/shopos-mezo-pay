
import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getCustomerByReferralId } from '@/app/lib/db';
import { getPassportLevel, calculateDiscountedPrice } from '@/app/lib/passport';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, amount, referralId } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    // Default amount if not provided
    const baseAmount = amount || 1;

    // 1. Detect Passport Level and Calculate initial Discount
    const level = getPassportLevel(walletAddress);
    const passportData = calculateDiscountedPrice(baseAmount, level);

    let finalDiscountRate = passportData.discountRate;
    let validatedReferralId = null;
    let commissionAmount = 0;

    // 2. Validate Referral if provided
    if (referralId) {
      const referrer = await getCustomerByReferralId(referralId);
      if (referrer) {
        validatedReferralId = referralId;
        // Apply additional 5% universal referral discount
        finalDiscountRate += 0.05;
        // Calculate 5% commission for referrer
        commissionAmount = baseAmount * 0.05;
      }
    }

    const finalPrice = baseAmount * (1 - finalDiscountRate);

    // POS Machine fixed recipient
    const POS_RECIPIENT = "0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7";
    
    // Create order with all fields
    const order = await createOrder(
      POS_RECIPIENT, 
      finalPrice, 
      walletAddress, 
      baseAmount, 
      finalDiscountRate, 
      level,
      validatedReferralId || undefined,
      commissionAmount
    );
    
    return NextResponse.json({
      ...order,
      passport_level: level,
      referral_applied: !!validatedReferralId
    });
  } catch (error: any) {
    console.error('API POST /api/orders Error:', error);
    
    // 返回详细的错误信息供前端调试
    return NextResponse.json({ 
      error: 'Order Initialization Failed',
      message: error.message,
      code: error.code // PostgreSQL 错误代码
    }, { status: 500 });
  }
}
