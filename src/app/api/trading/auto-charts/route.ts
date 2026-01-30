import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  traders,
  positions,
  tradingPairs,
  klineIntervals,
  traderKlineIntervals,
} from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * GET /api/trading/auto-charts
 *
 * 获取自动推荐的图表配置
 *
 * 逻辑：
 * 1. 获取所有有持仓的trader（status='open'的positions）
 * 2. 按收益率排名（totalReturnRate），取前4名
 * 3. 对每个trader，找到其当前最大的持仓（按positionSize排序）
 * 4. 获取该持仓的交易对symbol和该trader关联的最小K线周期
 */
export async function GET() {
  try {
    // 1. 获取所有已平仓的仓位来计算每个trader的收益率
    const closedPositions = await db
      .select({
        traderId: positions.traderId,
        realizedPnl: positions.realizedPnl,
        positionSize: positions.positionSize,
      })
      .from(positions)
      .where(eq(positions.status, 'closed'));

    // 计算每个trader的收益率
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

    // 2. 获取所有有持仓的trader
    const tradersWithPositions = await db
      .select({
        traderId: positions.traderId,
      })
      .from(positions)
      .where(eq(positions.status, 'open'))
      .groupBy(positions.traderId);

    if (tradersWithPositions.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 获取trader详细信息
    const traderIds = tradersWithPositions.map((t) => t.traderId);
    const traderDetails = await db
      .select()
      .from(traders)
      .where(sql`${traders.id} = ANY(${traderIds})`);

    // 计算收益率并排序
    const tradersWithReturnRate = traderDetails.map((trader) => {
      const pnlData = traderPnlMap.get(trader.id);
      const totalPnl = pnlData?.totalPnl || 0;
      const totalInvested = pnlData?.totalInvested || 0;
      const totalReturnRate = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

      return {
        ...trader,
        totalReturnRate,
      };
    });

    // 按收益率降序排序，取前4
    tradersWithReturnRate.sort((a, b) => b.totalReturnRate - a.totalReturnRate);
    const topTraders = tradersWithReturnRate.slice(0, 4);

    // 3. 为每个top trader获取其最大的持仓和对应的交易对、周期
    const chartConfigs = [];

    for (const trader of topTraders) {
      // 获取该trader的所有持仓，按positionSize降序排序
      const traderPositions = await db
        .select()
        .from(positions)
        .where(and(eq(positions.traderId, trader.id), eq(positions.status, 'open')))
        .orderBy(desc(positions.positionSize))
        .limit(1);

      if (traderPositions.length === 0) continue;

      const largestPosition = traderPositions[0];

      // 获取交易对信息
      const [pair] = await db
        .select()
        .from(tradingPairs)
        .where(eq(tradingPairs.id, largestPosition.tradingPairId))
        .limit(1);

      if (!pair) continue;

      // 获取该trader关联的K线周期，找出最小的（按seconds排序）
      const intervalRelations = await db
        .select()
        .from(traderKlineIntervals)
        .where(eq(traderKlineIntervals.traderId, trader.id));

      if (intervalRelations.length === 0) continue;

      const intervalIds = intervalRelations.map((r) => r.klineIntervalId);
      const traderIntervals = await db
        .select()
        .from(klineIntervals)
        .where(sql`${klineIntervals.id} = ANY(${intervalIds})`)
        .orderBy(klineIntervals.seconds); // 升序，最小的在前

      if (traderIntervals.length === 0) continue;

      const minInterval = traderIntervals[0];

      chartConfigs.push({
        symbol: pair.symbol,
        interval: minInterval.code,
        traderId: trader.id,
        traderName: trader.name,
        positionSize: Number(largestPosition.positionSize),
        returnRate: trader.totalReturnRate,
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
