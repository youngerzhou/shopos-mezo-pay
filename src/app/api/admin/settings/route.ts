
import { NextRequest, NextResponse } from 'next/server';
import { getSql, ensureDb, getSetting, updateSetting } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const discount = await getSetting('Global_Discount_Rate', '0.05');
    const commission = await getSetting('Referral_Commission_Rate', '0.05');
    const multiplier = await getSetting('Mezo_Passport_Bonus_Multiplier', '1.2');

    return NextResponse.json({
      Global_Discount_Rate: discount,
      Referral_Commission_Rate: commission,
      Mezo_Passport_Bonus_Multiplier: multiplier
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    await updateSetting(key, String(value));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
