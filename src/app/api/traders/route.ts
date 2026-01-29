import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { traders } from '@/db/schema';

// GET /api/traders - 获取所有交易员
export async function GET() {
  try {
    const allTraders = await db.select().from(traders).orderBy(traders.createdAt);
    return NextResponse.json(allTraders);
  } catch (error) {
    console.error('Error fetching traders:', error);
    return NextResponse.json({ error: 'Failed to fetch traders' }, { status: 500 });
  }
}

// POST /api/traders - 创建新交易员
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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
        heartbeatInterval: body.heartbeatInterval,
        activeTimeStart: body.activeTimeStart,
        activeTimeEnd: body.activeTimeEnd,
        tradingStrategy: body.tradingStrategy,
        holdingPeriod: body.holdingPeriod,
      })
      .returning();

    return NextResponse.json(newTrader[0], { status: 201 });
  } catch (error) {
    console.error('Error creating trader:', error);
    return NextResponse.json({ error: 'Failed to create trader' }, { status: 500 });
  }
}
