import { NextRequest, NextResponse } from 'next/server';
import { getDailyReconciliationReport } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseRange(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const today = new Date();

  const from = fromParam ? new Date(fromParam) : startOfLocalDay(today);
  const to = toParam ? new Date(toParam) : endOfLocalDay(today);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid from/to date range');
  }
  if (from.getTime() > to.getTime()) {
    throw new Error('from must be before to');
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

export async function GET(req: NextRequest) {
  try {
    const { from, to } = parseRange(req);
    const report = await getDailyReconciliationReport(from, to);
    return NextResponse.json(report);
  } catch (error: any) {
    const message = error.message || 'Unable to load reconciliation report';
    const status = message.includes('Invalid') || message.includes('from must') ? 400 : 500;
    console.error('API GET /api/pos/reconciliation Error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
