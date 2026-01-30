import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { positions, tradingPairs, traders } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/positions/[id]
 * 获取持仓详情
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const positionId = parseInt(id);

    if (isNaN(positionId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid position ID',
        },
        { status: 400 }
      );
    }

    const position = await db
      .select({
        position: positions,
        trader: {
          id: traders.id,
          name: traders.name,
        },
        tradingPair: {
          id: tradingPairs.id,
          symbol: tradingPairs.symbol,
          baseAsset: tradingPairs.baseAsset,
          quoteAsset: tradingPairs.quoteAsset,
        },
      })
      .from(positions)
      .leftJoin(traders, eq(positions.traderId, traders.id))
      .leftJoin(tradingPairs, eq(positions.tradingPairId, tradingPairs.id))
      .where(eq(positions.id, positionId))
      .limit(1);

    if (!position || position.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Position with id ${positionId} not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: position[0],
    });
  } catch (error) {
    console.error(`[GET /api/positions/${params}] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch position',
      },
      { status: 500 }
    );
  }
}
