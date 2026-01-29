import { NextResponse } from 'next/server';
import { db } from '@/db';
import { klineIntervals } from '@/db/schema';

// GET /api/kline-intervals - 获取所有K线周期
export async function GET() {
  try {
    const allIntervals = await db
      .select()
      .from(klineIntervals)
      .orderBy(klineIntervals.displayOrder);
    return NextResponse.json(allIntervals);
  } catch (error) {
    console.error('Error fetching kline intervals:', error);
    return NextResponse.json({ error: 'Failed to fetch kline intervals' }, { status: 500 });
  }
}
