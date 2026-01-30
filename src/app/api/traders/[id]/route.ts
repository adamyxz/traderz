import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  traders,
  tradingPairs,
  klineIntervals,
  traderKlineIntervals,
  type Trader,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

// 扩展的Trader类型，包含关联数据
export interface TraderWithRelations extends Trader {
  preferredTradingPair?: typeof tradingPairs.$inferSelect;
  preferredKlineIntervals?: (typeof klineIntervals.$inferSelect)[];
}

// GET /api/traders/[id] - 获取单个交易员（包含关联数据）
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const traderResult = await db
      .select()
      .from(traders)
      .where(eq(traders.id, Number(id)));

    if (!traderResult[0]) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 });
    }

    const trader = traderResult[0];

    // 获取关联的交易对
    const [preferredPair] = trader.preferredTradingPairId
      ? await db
          .select()
          .from(tradingPairs)
          .where(eq(tradingPairs.id, trader.preferredTradingPairId))
      : [undefined];

    // 获取关联的K线周期
    const relations = await db
      .select()
      .from(traderKlineIntervals)
      .where(eq(traderKlineIntervals.traderId, trader.id));

    const preferredIntervals =
      relations.length > 0
        ? await db
            .select()
            .from(klineIntervals)
            .where(
              inArray(
                klineIntervals.id,
                relations.map((r) => r.klineIntervalId)
              )
            )
        : [];

    const traderWithRelations: TraderWithRelations = {
      ...trader,
      preferredTradingPair: preferredPair,
      preferredKlineIntervals: preferredIntervals,
    };

    return NextResponse.json(traderWithRelations);
  } catch (error) {
    console.error('Error fetching trader:', error);
    return NextResponse.json({ error: 'Failed to fetch trader' }, { status: 500 });
  }
}

// PUT /api/traders/[id] - 更新交易员
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 更新交易员基本信息
    const updatedTrader = await db
      .update(traders)
      .set({
        name: body.name,
        description: body.description,
        status: body.status,
        aggressivenessLevel: body.aggressivenessLevel,
        maxLeverage: body.maxLeverage,
        minLeverage: body.minLeverage,
        maxPositions: body.maxPositions,
        maxPositionSize: body.maxPositionSize,
        minTradeAmount: body.minTradeAmount,
        positionStrategy: body.positionStrategy,
        allowShort: body.allowShort,
        maxDrawdown: body.maxDrawdown,
        stopLossThreshold: body.stopLossThreshold,
        positionStopLoss: body.positionStopLoss,
        positionTakeProfit: body.positionTakeProfit,
        maxConsecutiveLosses: body.maxConsecutiveLosses,
        dailyMaxLoss: body.dailyMaxLoss,
        riskPreferenceScore: body.riskPreferenceScore,
        // heartbeatInterval: not updated from frontend, keeps existing value
        activeTimeStart: body.activeTimeStart,
        activeTimeEnd: body.activeTimeEnd,
        tradingStrategy: body.tradingStrategy,
        holdingPeriod: body.holdingPeriod,
        preferredTradingPairId: body.preferredTradingPairId || null,
      })
      .where(eq(traders.id, Number(id)))
      .returning();

    if (!updatedTrader[0]) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 });
    }

    // 更新K线周期关联
    await db.delete(traderKlineIntervals).where(eq(traderKlineIntervals.traderId, Number(id)));

    if (body.preferredKlineIntervalIds && Array.isArray(body.preferredKlineIntervalIds)) {
      const intervalRelations = body.preferredKlineIntervalIds
        .filter((intervalId: number) => intervalId != null)
        .map((klineIntervalId: number) => ({
          traderId: Number(id),
          klineIntervalId,
        }));

      if (intervalRelations.length > 0) {
        await db.insert(traderKlineIntervals).values(intervalRelations);
      }
    }

    // 获取完整的交易员数据（包含关联）
    const [preferredPair] = body.preferredTradingPairId
      ? await db.select().from(tradingPairs).where(eq(tradingPairs.id, body.preferredTradingPairId))
      : [undefined];

    const intervalRelations = await db
      .select()
      .from(traderKlineIntervals)
      .where(eq(traderKlineIntervals.traderId, Number(id)));

    const intervalIds = intervalRelations.map((r) => r.klineIntervalId);
    const preferredIntervals =
      intervalIds.length > 0
        ? await db.select().from(klineIntervals).where(inArray(klineIntervals.id, intervalIds))
        : [];

    const traderWithRelations: TraderWithRelations = {
      ...updatedTrader[0],
      preferredTradingPair: preferredPair,
      preferredKlineIntervals: preferredIntervals,
    };

    return NextResponse.json(traderWithRelations);
  } catch (error) {
    console.error('Error updating trader:', error);
    return NextResponse.json({ error: 'Failed to update trader' }, { status: 500 });
  }
}

// DELETE /api/traders/[id] - 删除交易员
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 先删除关联的K线周期关系
    await db.delete(traderKlineIntervals).where(eq(traderKlineIntervals.traderId, Number(id)));

    // 删除交易员
    const deletedTrader = await db
      .delete(traders)
      .where(eq(traders.id, Number(id)))
      .returning();

    if (!deletedTrader[0]) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Trader deleted successfully' });
  } catch (error) {
    console.error('Error deleting trader:', error);
    return NextResponse.json({ error: 'Failed to delete trader' }, { status: 500 });
  }
}
