import { NextResponse } from 'next/server';
import { db } from '@/db';
import { klineIntervals } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const intervals = await db
      .select()
      .from(klineIntervals)
      .where(eq(klineIntervals.isActive, true))
      .orderBy(klineIntervals.displayOrder);
    return NextResponse.json(intervals);
  } catch (error) {
    console.error('Error fetching kline intervals:', error);
    return NextResponse.json({ error: 'Failed to fetch kline intervals' }, { status: 500 });
  }
}
