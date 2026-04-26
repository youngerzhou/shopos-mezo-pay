
import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getCustomerByReferralId, getStaffByStaffId, createPendingRegistration } from '@/app/lib/db';
import { getPassportLevel, calculateDiscountedPrice } from '@/app/lib/passport';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, amount, referralId } = body;

    const cookieStore = await cookies();
    let sessionToken = cookieStore.get('shopos_session')?.value;
    
    if (!sessionToken) {
      sessionToken = Math.random().toString(36).substring(2, 15);
      // We don't necessarily need to set it here if we just use it for the order, 
      // but it's better if the client has it.
    }

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
      // Try customer referral
      const referrer = await getCustomerByReferralId(referralId);
      if (referrer) {
        validatedReferralId = referralId;
        finalDiscountRate += 0.05;
        commissionAmount = baseAmount * 0.05;
      } else {
        // Try staff referral
        const staff = await getStaffByStaffId(referralId);
        if (staff) {
          validatedReferralId = referralId; // Use staff_id as referral identifier
          finalDiscountRate += 0.05;
          commissionAmount = 0; // Staff might have different incentive structure, but for now we track them
          
          // Create pending registration for auto-binding
          await createPendingRegistration(staff.staff_id, sessionToken);
        }
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
      commissionAmount,
      sessionToken
    );
    
    const response = NextResponse.json({
      ...order,
      passport_level: level,
      referral_applied: !!validatedReferralId
    });

    // Set sample session cookie if it wasn't there
    response.cookies.set('shopos_session', sessionToken, { 
      path: '/', 
      maxAge: 60 * 60 * 24, // 24 hours
      httpOnly: true 
    });

    return response;
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
