import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { traders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { executeHeartbeat } from '@/lib/heartbeat/executor';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const traderId = parseInt(id);

    if (isNaN(traderId)) {
      return NextResponse.json({ success: false, error: 'Invalid trader ID' }, { status: 400 });
    }

    const trader = await db.query.traders.findFirst({
      where: eq(traders.id, traderId),
    });

    if (!trader) {
      return NextResponse.json({ success: false, error: 'Trader not found' }, { status: 404 });
    }

    // Execute heartbeat (returns immediately with heartbeat record ID)
    const heartbeatRecord = await executeHeartbeat(trader);

    return NextResponse.json({
      success: true,
      data: {
        heartbeatId: heartbeatRecord.id,
        status: heartbeatRecord.status,
        triggeredAt: heartbeatRecord.triggeredAt,
      },
    });
  } catch (error) {
    console.error(`[POST /api/traders/${params}/heartbeat] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trigger heartbeat',
      },
      { status: 500 }
    );
  }
}
