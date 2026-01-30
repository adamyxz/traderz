import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  traders,
  tradingPairs,
  klineIntervals,
  traderKlineIntervals,
  readers,
  traderReaders,
  type Trader,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

// 扩展的Trader类型，包含关联数据
export interface TraderWithRelations extends Trader {
  preferredTradingPair?: typeof tradingPairs.$inferSelect;
  preferredKlineIntervals?: (typeof klineIntervals.$inferSelect)[];
  readers?: (typeof readers.$inferSelect)[];
}

// GET /api/traders - 获取所有交易员（包含关联数据）
export async function GET() {
  try {
    // 获取所有交易员
    const allTraders = await db.select().from(traders).orderBy(traders.createdAt);

    // 获取所有交易对、周期和readers（用于后续查找）
    const allPairs = await db.select().from(tradingPairs);
    const allIntervals = await db.select().from(klineIntervals);
    const allReaders = await db.select().from(readers);
    const allIntervalRelations = await db.select().from(traderKlineIntervals);
    const allReaderRelations = await db.select().from(traderReaders);

    // 为每个trader添加关联数据
    const tradersWithRelations: TraderWithRelations[] = await Promise.all(
      allTraders.map(async (trader) => {
        // 查找偏好的交易对
        const preferredPair = trader.preferredTradingPairId
          ? allPairs.find((p) => p.id === trader.preferredTradingPairId)
          : undefined;

        // 查找偏好的K线周期
        const intervalIds = allIntervalRelations
          .filter((r) => r.traderId === trader.id)
          .map((r) => r.klineIntervalId);
        const preferredIntervals = allIntervals.filter((i) => intervalIds.includes(i.id));

        // 查找关联的Readers
        const readerIds = allReaderRelations
          .filter((r) => r.traderId === trader.id)
          .map((r) => r.readerId);
        const traderReaders = allReaders.filter((r) => readerIds.includes(r.id));

        return {
          ...trader,
          preferredTradingPair: preferredPair,
          preferredKlineIntervals: preferredIntervals,
          readers: traderReaders,
        };
      })
    );

    return NextResponse.json(tradersWithRelations);
  } catch (error) {
    console.error('Error fetching traders:', error);
    return NextResponse.json({ error: 'Failed to fetch traders' }, { status: 500 });
  }
}

// POST /api/traders - 创建新交易员
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 创建交易员
    const newTrader = await db
      .insert(traders)
      .values({
        name: body.name,
        description: body.description || null,
        status: body.status || 'enabled',
        aggressivenessLevel: body.aggressivenessLevel,
        maxLeverage: body.maxLeverage,
        minLeverage: body.minLeverage,
        maxPositions: body.maxPositions,
        maxPositionSize: body.maxPositionSize,
        minTradeAmount: body.minTradeAmount,
        positionStrategy: body.positionStrategy || 'none',
        allowShort: body.allowShort || false,
        maxDrawdown: body.maxDrawdown,
        stopLossThreshold: body.stopLossThreshold,
        positionStopLoss: body.positionStopLoss,
        positionTakeProfit: body.positionTakeProfit,
        maxConsecutiveLosses: body.maxConsecutiveLosses,
        dailyMaxLoss: body.dailyMaxLoss,
        riskPreferenceScore: body.riskPreferenceScore,
        heartbeatInterval: 30, // Default heartbeat interval
        activeTimeStart: body.activeTimeStart,
        activeTimeEnd: body.activeTimeEnd,
        tradingStrategy: body.tradingStrategy,
        holdingPeriod: body.holdingPeriod,
        preferredTradingPairId: body.preferredTradingPairId || null,
      })
      .returning();

    const traderId = newTrader[0].id;

    // 如果提供了K线周期，创建关联关系
    if (body.preferredKlineIntervalIds && Array.isArray(body.preferredKlineIntervalIds)) {
      const intervalRelations = body.preferredKlineIntervalIds
        .filter((id: number) => id != null)
        .map((klineIntervalId: number) => ({
          traderId,
          klineIntervalId,
        }));

      if (intervalRelations.length > 0) {
        await db.insert(traderKlineIntervals).values(intervalRelations);
      }
    }

    // 如果提供了Readers，创建关联关系
    if (body.preferredReaderIds && Array.isArray(body.preferredReaderIds)) {
      const readerRelations = body.preferredReaderIds
        .filter((id: number) => id != null)
        .map((readerId: number) => ({
          traderId,
          readerId,
        }));

      if (readerRelations.length > 0) {
        await db.insert(traderReaders).values(readerRelations);
      }
    }

    // 获取完整的交易员数据（包含关联）
    const [preferredPair] = body.preferredTradingPairId
      ? await db.select().from(tradingPairs).where(eq(tradingPairs.id, body.preferredTradingPairId))
      : [undefined];

    const intervalRelations = await db
      .select()
      .from(traderKlineIntervals)
      .where(eq(traderKlineIntervals.traderId, traderId));

    const intervalIds = intervalRelations.map((r) => r.klineIntervalId);
    const preferredIntervals =
      intervalIds.length > 0
        ? await db.select().from(klineIntervals).where(eq(klineIntervals.id, intervalIds[0]))
        : [];

    const readerRelations = await db
      .select()
      .from(traderReaders)
      .where(eq(traderReaders.traderId, traderId));

    const readerIds = readerRelations.map((r) => r.readerId);
    const traderReadersList =
      readerIds.length > 0
        ? await db.select().from(readers).where(eq(readers.id, readerIds[0]))
        : [];

    const traderWithRelations: TraderWithRelations = {
      ...newTrader[0],
      preferredTradingPair: preferredPair,
      preferredKlineIntervals: preferredIntervals,
      readers: traderReadersList,
    };

    return NextResponse.json(traderWithRelations, { status: 201 });
  } catch (error) {
    console.error('Error creating trader:', error);
    return NextResponse.json({ error: 'Failed to create trader' }, { status: 500 });
  }
}
