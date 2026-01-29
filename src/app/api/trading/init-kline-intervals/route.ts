import { NextResponse } from 'next/server';
import { db } from '@/db';
import { klineIntervals } from '@/db/schema';

export async function POST() {
  try {
    // Check if intervals already exist
    const existing = await db.select().from(klineIntervals);

    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Kline intervals already initialized',
        count: existing.length,
      });
    }

    // Insert kline intervals
    const intervals = await db
      .insert(klineIntervals)
      .values([
        { code: '1m', label: '1分钟', seconds: 60, displayOrder: 1, isActive: true },
        { code: '3m', label: '3分钟', seconds: 180, displayOrder: 2, isActive: true },
        { code: '5m', label: '5分钟', seconds: 300, displayOrder: 3, isActive: true },
        { code: '15m', label: '15分钟', seconds: 900, displayOrder: 4, isActive: true },
        { code: '30m', label: '30分钟', seconds: 1800, displayOrder: 5, isActive: true },
        { code: '1h', label: '1小时', seconds: 3600, displayOrder: 6, isActive: true },
        { code: '4h', label: '4小时', seconds: 14400, displayOrder: 7, isActive: true },
        { code: '1d', label: '1天', seconds: 86400, displayOrder: 8, isActive: true },
      ])
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Kline intervals initialized successfully',
      count: intervals.length,
      data: intervals,
    });
  } catch (error) {
    console.error('Error initializing kline intervals:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize kline intervals',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
