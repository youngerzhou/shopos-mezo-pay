import { NextRequest, NextResponse } from 'next/server';
import { ensureDb, getSetting, updateSetting } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_CAMPAIGNS = [
  {
    id: 'new-member-welcome',
    title: 'New Member Welcome Coupon',
    description: 'Spend 100, save 5',
    couponType: 'threshold_discount',
    discountAmount: 5,
    minimumSpend: 100,
    expiresInDays: 30
  },
  {
    id: 'next-purchase-reward',
    title: 'Next Purchase Coupon',
    description: 'Spend 50, save 3',
    couponType: 'threshold_discount',
    discountAmount: 3,
    minimumSpend: 50,
    expiresInDays: 30
  }
];

async function getCampaignsList(): Promise<any[]> {
  const settingStr = await getSetting('coupon_campaigns', '[]');
  const list = JSON.parse(settingStr);
  if (!Array.isArray(list) || list.length === 0) {
    return DEFAULT_CAMPAIGNS;
  }
  
  // Merge default campaigns if they are not already in the list
  const merged = [...DEFAULT_CAMPAIGNS];
  for (const item of list) {
    if (!merged.some(c => c.id === item.id)) {
      merged.push(item);
    }
  }
  return merged;
}

export async function GET(req: NextRequest) {
  try {
    await ensureDb();
    const campaigns = await getCampaignsList();
    return NextResponse.json({ campaigns });
  } catch (error: any) {
    console.error('API GET /api/admin/coupons Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json().catch(() => ({}));
    const { title, couponType, discountAmount, minimumSpend } = body;

    if (!title || !couponType || typeof discountAmount !== 'number') {
      return NextResponse.json({ error: 'Missing title, couponType or discountAmount' }, { status: 400 });
    }

    if (couponType !== 'threshold_discount' && couponType !== 'cash_discount') {
      return NextResponse.json({ error: 'Unsupported coupon type' }, { status: 400 });
    }

    const minSpend = couponType === 'cash_discount' ? 0 : Number(minimumSpend || 0);
    const discAmount = Number(discountAmount);

    let description = '';
    if (couponType === 'threshold_discount') {
      description = `Spend ${minSpend.toFixed(0)}, save ${discAmount.toFixed(0)}`;
    } else {
      description = `Save ${discAmount.toFixed(0)}`;
    }

    const id = `cpn-camp-${Math.random().toString(36).slice(2, 10)}`;

    const newCampaign = {
      id,
      title: title.trim(),
      description,
      couponType,
      discountAmount: discAmount,
      minimumSpend: minSpend,
      expiresInDays: 30
    };

    // Load existing custom campaigns
    const settingStr = await getSetting('coupon_campaigns', '[]');
    let currentCustom = JSON.parse(settingStr);
    if (!Array.isArray(currentCustom)) {
      currentCustom = [];
    }

    currentCustom.push(newCampaign);
    await updateSetting('coupon_campaigns', JSON.stringify(currentCustom));

    const allCampaigns = await getCampaignsList();
    return NextResponse.json({ success: true, campaign: newCampaign, campaigns: allCampaigns });
  } catch (error: any) {
    console.error('API POST /api/admin/coupons Error:', error);
    return NextResponse.json({ error: error.message || 'Unable to create campaign' }, { status: 500 });
  }
}
