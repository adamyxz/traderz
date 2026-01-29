import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tradingPairs } from '@/db/schema';

// GET /api/trading-pairs - 获取所有交易对
export async function GET() {
  try {
    const allPairs = await db.select().from(tradingPairs).orderBy(tradingPairs.symbol);
    return NextResponse.json(allPairs);
  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    return NextResponse.json({ error: 'Failed to fetch trading pairs' }, { status: 500 });
  }
}
