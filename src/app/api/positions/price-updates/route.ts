import { NextResponse } from 'next/server';
import { db } from '@/db';
import { positions, tradingPairs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { binanceClient } from '@/lib/trading/binance-client';
import { calculatePnlMetrics } from '@/lib/trading/pnl-calculator';

/**
 * GET /api/positions/price-updates
 *
 * 获取所有开仓持仓的实时价格和盈亏数据（轻量级）
 * 只返回价格相关字段，不触发数据库更新
 */
export async function GET() {
  try {
    // 获取所有开仓的持仓
    const openPositions = await db
      .select({
        id: positions.id,
        tradingPairId: positions.tradingPairId,
        entryPrice: positions.entryPrice,
        quantity: positions.quantity,
        margin: positions.margin,
        positionSize: positions.positionSize,
        leverage: positions.leverage,
        side: positions.side,
      })
      .from(positions)
      .where(eq(positions.status, 'open'));

    if (openPositions.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 获取所有需要的交易对
    const tradingPairIds = [...new Set(openPositions.map((p) => p.tradingPairId))];
    const tradingPairsData = await db.query.tradingPairs.findMany({
      where: (tradingPair, { inArray }) => inArray(tradingPair.id, tradingPairIds),
    });

    const pairIdToSymbolMap = new Map(tradingPairsData.map((pair) => [pair.id, pair.symbol]));

    // 批量获取所有交易对的价格
    const allPrices = await binanceClient.getAllPrices();

    // 计算每个持仓的实时盈亏
    const priceUpdates = openPositions
      .map((position) => {
        const symbol = pairIdToSymbolMap.get(position.tradingPairId);
        if (!symbol) return null;

        const currentPrice = allPrices.get(symbol);
        if (currentPrice === undefined) return null;

        const entryPrice = parseFloat(position.entryPrice);
        const qty = parseFloat(position.quantity);
        const margin = parseFloat(position.margin);
        const posSize = parseFloat(position.positionSize);

        const pnlMetrics = calculatePnlMetrics(
          position.side,
          entryPrice,
          currentPrice,
          qty,
          margin,
          posSize
        );

        return {
          positionId: position.id,
          currentPrice: currentPrice.toString(),
          unrealizedPnl: pnlMetrics.unrealizedPnl.toString(),
          unrealizedPnlPercent: pnlMetrics.unrealizedPnlPercent,
          roe: pnlMetrics.roe,
        };
      })
      .filter((item) => item !== null);

    return NextResponse.json({
      success: true,
      data: priceUpdates,
    });
  } catch (error) {
    console.error('[GET /api/positions/price-updates] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch price updates',
      },
      { status: 500 }
    );
  }
}
