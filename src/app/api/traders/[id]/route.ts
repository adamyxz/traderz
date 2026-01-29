import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { traders } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/traders/[id] - 获取单个交易员
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const trader = await db
      .select()
      .from(traders)
      .where(eq(traders.id, Number(id)));

    if (!trader[0]) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 });
    }

    return NextResponse.json(trader[0]);
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
        heartbeatInterval: body.heartbeatInterval,
        activeTimeStart: body.activeTimeStart,
        activeTimeEnd: body.activeTimeEnd,
        tradingStrategy: body.tradingStrategy,
        holdingPeriod: body.holdingPeriod,
      })
      .where(eq(traders.id, Number(id)))
      .returning();

    if (!updatedTrader[0]) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 });
    }

    return NextResponse.json(updatedTrader[0]);
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
