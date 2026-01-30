import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { positions, tradingPairs, positionHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { binanceClient } from '@/lib/trading/binance-client';
import { calculateCloseFee, calculatePartialCloseFee } from '@/lib/trading/fee-calculator';
import { calculateRealizedPnl, calculateNetPnl } from '@/lib/trading/pnl-calculator';
import type { ClosePositionRequest } from '@/lib/trading/position-types';
import { getPositionEventDispatcher } from '@/lib/trading/position-events';

/**
 * POST /api/positions/[id]/close
 * 平仓
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // 获取仓位
    const [positionData] = await db
      .select()
      .from(positions)
      .where(eq(positions.id, positionId))
      .limit(1);

    if (!positionData) {
      return NextResponse.json(
        {
          success: false,
          error: `Position with id ${positionId} not found`,
        },
        { status: 404 }
      );
    }

    // 检查仓位状态
    if (positionData.status !== 'open') {
      return NextResponse.json(
        {
          success: false,
          error: `Position is ${positionData.status}, cannot close`,
        },
        { status: 400 }
      );
    }

    // 获取交易对
    const [tradingPair] = await db
      .select()
      .from(tradingPairs)
      .where(eq(tradingPairs.id, positionData.tradingPairId))
      .limit(1);

    if (!tradingPair) {
      return NextResponse.json(
        {
          success: false,
          error: 'Trading pair not found',
        },
        { status: 404 }
      );
    }

    const body: ClosePositionRequest = await request.json();

    // 获取平仓价格
    const closePrice = body.closePrice || (await binanceClient.getPrice(tradingPair.symbol));

    const entryPrice = parseFloat(positionData.entryPrice);
    const positionSize = parseFloat(positionData.positionSize);
    const totalQuantity = parseFloat(positionData.quantity);
    const openFee = parseFloat(positionData.openFee);
    const side = positionData.side;

    let closeQuantity: number;
    let closeSize: number;
    let closeFee: number;
    let realizedPnl: number;
    let remainingQuantity: number;
    let isFullyClosed: boolean;

    if (body.quantity && body.quantity < totalQuantity) {
      // 部分平仓
      closeQuantity = body.quantity;
      closeSize = closeQuantity * closePrice;
      closeFee = calculatePartialCloseFee(positionSize, closeQuantity, closePrice);
      realizedPnl = calculateRealizedPnl(side, entryPrice, closePrice, closeQuantity);
      remainingQuantity = totalQuantity - closeQuantity;
      isFullyClosed = false;

      // 更新仓位（部分平仓）
      await db
        .update(positions)
        .set({
          quantity: remainingQuantity.toString(),
          positionSize: (positionSize - closeSize).toString(),
          closeFee: (parseFloat(positionData.closeFee) + closeFee).toString(),
          realizedPnl: (parseFloat(positionData.realizedPnl) + realizedPnl).toString(),
          updatedAt: new Date(),
        })
        .where(eq(positions.id, positionId));

      // 记录历史
      await db.insert(positionHistory).values({
        positionId: positionId,
        action: 'close',
        price: closePrice.toString(),
        quantity: closeQuantity.toString(),
        pnl: realizedPnl.toString(),
        fee: closeFee.toString(),
        metadata: JSON.stringify({
          type: 'partial',
          remainingQuantity,
        }),
        createdAt: new Date(),
      });
    } else {
      // 全部平仓
      closeQuantity = totalQuantity;
      closeSize = positionSize;
      closeFee = calculateCloseFee(positionSize);
      realizedPnl = calculateRealizedPnl(side, entryPrice, closePrice, closeQuantity);
      remainingQuantity = 0;
      isFullyClosed = true;

      // 更新仓位状态
      await db
        .update(positions)
        .set({
          status: 'closed',
          currentPrice: closePrice.toString(),
          closeFee: closeFee.toString(),
          realizedPnl: realizedPnl.toString(),
          unrealizedPnl: '0',
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(positions.id, positionId));

      // 记录历史
      await db.insert(positionHistory).values({
        positionId: positionId,
        action: 'close',
        price: closePrice.toString(),
        quantity: closeQuantity.toString(),
        pnl: realizedPnl.toString(),
        fee: closeFee.toString(),
        metadata: JSON.stringify({
          type: 'full',
        }),
        createdAt: new Date(),
      });

      // Emit position closed event for SSE (only for full close)
      getPositionEventDispatcher().emitPositionClosed({
        positionId: positionId,
        traderId: positionData.traderId,
        tradingPairId: positionData.tradingPairId,
        tradingPairSymbol: tradingPair.symbol,
      });
    }

    const netPnl = calculateNetPnl(
      realizedPnl,
      openFee * (closeQuantity / totalQuantity),
      closeFee
    );

    return NextResponse.json({
      success: true,
      data: {
        closePrice,
        closeFee,
        realizedPnl,
        netPnl,
        remainingQuantity,
        isFullyClosed,
      },
    });
  } catch (error) {
    console.error(`[POST /api/positions/${params}/close] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close position',
      },
      { status: 500 }
    );
  }
}
