import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { positions, positionHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const positionId = parseInt(id);

    if (isNaN(positionId)) {
      return NextResponse.json({ success: false, error: 'Invalid position ID' }, { status: 400 });
    }

    const body = await request.json();
    const { stopLossPrice, takeProfitPrice } = body;

    if (stopLossPrice === undefined && takeProfitPrice === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one of stopLossPrice or takeProfitPrice must be provided',
        },
        { status: 400 }
      );
    }

    const [positionData] = await db
      .select()
      .from(positions)
      .where(eq(positions.id, positionId))
      .limit(1);

    if (!positionData) {
      return NextResponse.json({ success: false, error: 'Position not found' }, { status: 404 });
    }

    if (positionData.status !== 'open') {
      return NextResponse.json(
        { success: false, error: `Position is ${positionData.status}, cannot modify` },
        { status: 400 }
      );
    }

    // Validate stop-loss/take-profit logic
    if (stopLossPrice && takeProfitPrice) {
      const entryPrice = parseFloat(positionData.entryPrice);
      if (positionData.side === 'long') {
        if (!(stopLossPrice < entryPrice && entryPrice < takeProfitPrice)) {
          return NextResponse.json(
            { success: false, error: 'For long positions: stop loss < entry < take profit' },
            { status: 400 }
          );
        }
      } else {
        if (!(takeProfitPrice < entryPrice && entryPrice < stopLossPrice)) {
          return NextResponse.json(
            { success: false, error: 'For short positions: take profit < entry < stop loss' },
            { status: 400 }
          );
        }
      }
    }

    const [updated] = await db
      .update(positions)
      .set({
        stopLossPrice: stopLossPrice?.toString() || positionData.stopLossPrice,
        takeProfitPrice: takeProfitPrice?.toString() || positionData.takeProfitPrice,
        updatedAt: new Date(),
      })
      .where(eq(positions.id, positionId))
      .returning();

    await db.insert(positionHistory).values({
      positionId: positionId,
      action: 'modify_sl_tp',
      price: null,
      quantity: null,
      pnl: null,
      fee: null,
      metadata: JSON.stringify({
        oldStopLoss: positionData.stopLossPrice,
        newStopLoss: stopLossPrice,
        oldTakeProfit: positionData.takeProfitPrice,
        newTakeProfit: takeProfitPrice,
      }),
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error(`[PUT /api/positions/${params}/modify] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to modify position',
      },
      { status: 500 }
    );
  }
}
