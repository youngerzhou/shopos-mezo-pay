
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

    // 调用 DB 逻辑创建订单
    const order = await createOrder(walletAddress, amount || 100);
    
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
