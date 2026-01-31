import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  traders,
  positions,
  tradingPairs,
  klineIntervals,
  traderKlineIntervals,
} from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';

/**
 * GET /api/trading/auto-charts
 *
 * 获取自动推荐的图表配置
 *
 * 逻辑：
 * 1. 获取所有开仓仓位及其未实现盈亏
 * 2. 按未实现盈亏降序排序，取前4个仓位
 * 3. 获取这些仓位所在的交易对
 * 4. 对每个交易对，找出最短的K线周期
 * 5. 返回去重后的交易对图表配置
 */
export async function GET() {
  try {
    // 获取所有开仓的持仓及其未实现盈亏
    const openPositions = await db
      .select({
        positionId: positions.id,
        traderId: positions.traderId,
        tradingPairId: positions.tradingPairId,
        entryPrice: positions.entryPrice,
        stopLossPrice: positions.stopLossPrice,
        takeProfitPrice: positions.takeProfitPrice,
        positionSize: positions.positionSize,
        side: positions.side,
        unrealizedPnl: positions.unrealizedPnl,
      })
      .from(positions)
      .where(eq(positions.status, 'open'))
      .orderBy(desc(positions.unrealizedPnl)); // 按未实现盈亏降序排序

    if (openPositions.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 取前4个盈利最高的仓位
    const topPositions = openPositions.slice(0, 4);
    console.log(
      `[auto-charts] Top ${topPositions.length} positions by unrealized PnL:`,
      topPositions.map((p) => ({
        positionId: p.positionId,
        unrealizedPnl: Number(p.unrealizedPnl),
      }))
    );

    // 获取这些仓位所在的交易对ID（去重）
    const tradingPairIds = [...new Set(topPositions.map((p) => p.tradingPairId))];
    const traderIds = [...new Set(topPositions.map((p) => p.traderId))];

    const [traderDetails, pairDetails, intervalRelations] = await Promise.all([
      db.select().from(traders).where(inArray(traders.id, traderIds)),
      db.select().from(tradingPairs).where(inArray(tradingPairs.id, tradingPairIds)),
      db
        .select()
        .from(traderKlineIntervals)
        .where(inArray(traderKlineIntervals.traderId, traderIds)),
    ]);

    const traderMap = new Map(traderDetails.map((t) => [t.id, t]));
    const pairMap = new Map(pairDetails.map((p) => [p.id, p]));

    // 为每个trader找出最短的K线周期
    const traderIdToMinInterval = new Map<number, { code: string; seconds: number }>();
    for (const rel of intervalRelations) {
      const interval = await db
        .select()
        .from(klineIntervals)
        .where(eq(klineIntervals.id, rel.klineIntervalId))
        .limit(1);

      if (interval.length === 0) continue;

      const current = traderIdToMinInterval.get(rel.traderId);
      if (!current || interval[0].seconds < current.seconds) {
        traderIdToMinInterval.set(rel.traderId, {
          code: interval[0].code,
          seconds: interval[0].seconds,
        });
      }
    }

    // 按交易对分组，收集该交易对下的所有仓位（包括top4之外的仓位）
    const pairIdToPositions = new Map<number, typeof openPositions>();
    for (const pos of openPositions) {
      if (!tradingPairIds.includes(pos.tradingPairId)) continue; // 只保留top4仓位所在的交易对

      const current = pairIdToPositions.get(pos.tradingPairId) || [];
      current.push(pos);
      pairIdToPositions.set(pos.tradingPairId, current);
    }

    // 构建图表配置
    const chartConfigs = [];

    for (const [tradingPairId, positionsOnPair] of pairIdToPositions) {
      const pair = pairMap.get(tradingPairId);
      if (!pair) continue;

      // 找出该交易对下使用最短周期的trader
      let minIntervalSeconds = Infinity;
      let minIntervalCode = '1h';

      for (const pos of positionsOnPair) {
        const intervalData = traderIdToMinInterval.get(pos.traderId);
        if (intervalData && intervalData.seconds < minIntervalSeconds) {
          minIntervalSeconds = intervalData.seconds;
          minIntervalCode = intervalData.code;
        }
      }

      // 收集该交易对下所有仓位的信息，并按未实现盈亏降序排序
      const positionInfos = positionsOnPair
        .map((pos) => {
          const trader = traderMap.get(pos.traderId);
          if (!trader) return null;

          return {
            positionId: pos.positionId,
            traderId: pos.traderId,
            traderName: trader.name,
            entryPrice: Number(pos.entryPrice),
            stopLossPrice: pos.stopLossPrice ? Number(pos.stopLossPrice) : null,
            takeProfitPrice: pos.takeProfitPrice ? Number(pos.takeProfitPrice) : null,
            positionSize: Number(pos.positionSize),
            unrealizedPnl: Number(pos.unrealizedPnl),
            side: pos.side as 'long' | 'short',
          };
        })
        .filter((p) => p !== null)
        // 按未实现盈亏降序排序
        .sort((a, b) => b.unrealizedPnl - a.unrealizedPnl);

      if (positionInfos.length === 0) continue;

      const maxUnrealizedPnl = Math.max(...positionInfos.map((p) => p.unrealizedPnl));
      console.log(
        `[auto-charts] ${pair.symbol}: ${positionInfos.length} positions, max unrealized PnL: ${maxUnrealizedPnl.toFixed(2)} USDT`
      );

      chartConfigs.push({
        symbol: pair.symbol,
        interval: minIntervalCode,
        positions: positionInfos,
      });
    }

    // 按交易对中最高未实现盈亏排序图表
    chartConfigs.sort((a, b) => {
      const aMaxPnl = Math.max(...a.positions.map((p) => p.unrealizedPnl));
      const bMaxPnl = Math.max(...b.positions.map((p) => p.unrealizedPnl));
      return bMaxPnl - aMaxPnl;
    });

    return NextResponse.json({
      success: true,
      data: chartConfigs,
    });
  } catch (error) {
    console.error('[GET /api/trading/auto-charts] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch auto-charts',
      },
      { status: 500 }
    );
  }
}
