
import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

/**
 * [Server Logic] 处理订单创建
 * 对应传统的 server.ts 部分逻辑
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, amount } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    // 使用 POS 机的固定收款地址作为 recipient，而不是用户的钱包地址
    const POS_RECIPIENT = "0x92a3c1adc73f79818a09c6494a7bd28da9ea98e7";
    
    // 调用 DB 逻辑创建订单 (POS机地址, 金额, 付款人地址)
    const order = await createOrder(POS_RECIPIENT, amount || 1, walletAddress);
    
    return NextResponse.json(order);
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
