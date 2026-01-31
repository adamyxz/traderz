import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  traders,
  positions,
  tradingPairs,
  klineIntervals,
  traderKlineIntervals,
} from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

/**
 * GET /api/trading/auto-charts
 *
 * 获取自动推荐的图表配置
 *
 * 逻辑：
 * 1. 按交易对分组，找出有开仓的交易对
 * 2. 对每个交易对，获取所有该交易对的开仓仓位及其trader信息
 * 3. 找出该交易对下使用最短K线周期的trader，用他的周期作为图表周期
 */
export async function GET() {
  try {
    // 获取所有开仓的持仓
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
      })
      .from(positions)
      .where(eq(positions.status, 'open'));

    if (openPositions.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 按交易对分组
    const pairIdToPositions = new Map<number, typeof openPositions>();
    for (const pos of openPositions) {
      const current = pairIdToPositions.get(pos.tradingPairId) || [];
      current.push(pos);
      pairIdToPositions.set(pos.tradingPairId, current);
    }

    // 获取所有涉及到的trader、tradingPair、klineInterval
    const traderIds = [...new Set(openPositions.map((p) => p.traderId))];
    const tradingPairIds = [...new Set(openPositions.map((p) => p.tradingPairId))];

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

    // 计算每个trader的收益率
    const closedPositions = await db
      .select({
        traderId: positions.traderId,
        realizedPnl: positions.realizedPnl,
        positionSize: positions.positionSize,
      })
      .from(positions)
      .where(eq(positions.status, 'closed'));

    const traderPnlMap = new Map<number, { totalPnl: number; totalInvested: number }>();
    for (const pos of closedPositions) {
      const current = traderPnlMap.get(pos.traderId) || { totalPnl: 0, totalInvested: 0 };
      const pnl = Number(pos.realizedPnl);
      const invested = Number(pos.positionSize);
      traderPnlMap.set(pos.traderId, {
        totalPnl: current.totalPnl + pnl,
        totalInvested: current.totalInvested + invested,
      });
    }

    const traderReturnRateMap = new Map<number, number>();
    for (const [traderId, pnlData] of traderPnlMap) {
      const returnRate =
        pnlData.totalInvested > 0 ? (pnlData.totalPnl / pnlData.totalInvested) * 100 : 0;
      traderReturnRateMap.set(traderId, returnRate);
    }

    // 为每个交易对找出最短的K线周期
    const pairIdToMinInterval = new Map<number, { code: string; seconds: number }>();
    for (const rel of intervalRelations) {
      const interval = await db
        .select()
        .from(klineIntervals)
        .where(eq(klineIntervals.id, rel.klineIntervalId))
        .limit(1);

      if (interval.length === 0) continue;

      const current = pairIdToMinInterval.get(rel.traderId);
      if (!current || interval[0].seconds < current.seconds) {
        pairIdToMinInterval.set(rel.traderId, {
          code: interval[0].code,
          seconds: interval[0].seconds,
        });
      }
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
        const intervalData = pairIdToMinInterval.get(pos.traderId);
        if (intervalData && intervalData.seconds < minIntervalSeconds) {
          minIntervalSeconds = intervalData.seconds;
          minIntervalCode = intervalData.code;
        }
      }

      // 收集该交易对下所有仓位的信息
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
            returnRate: traderReturnRateMap.get(pos.traderId) || 0,
            side: pos.side as 'long' | 'short',
          };
        })
        .filter((p) => p !== null);

      if (positionInfos.length === 0) continue;

      chartConfigs.push({
        symbol: pair.symbol,
        interval: minIntervalCode,
        positions: positionInfos,
      });
    }

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
