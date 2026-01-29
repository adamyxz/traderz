import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { traders } from '@/db/schema';
import { generateMultipleTraders } from '@/lib/deepseek';

/**
 * POST /api/traders/generate
 * Generate one or more traders using AI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { count = 1 } = body;

    // Validate count
    if (count < 1 || count > 10) {
      return NextResponse.json({ error: 'Count must be between 1 and 10' }, { status: 400 });
    }

    // Fetch existing traders
    const existingTraders = await db.select().from(traders).orderBy(traders.createdAt);

    // Generate new traders
    const result = await generateMultipleTraders(existingTraders, count);

    if (!result.success || !result.traders || result.traders.length === 0) {
      return NextResponse.json(
        {
          error: 'Failed to generate traders',
          details: result.errors,
        },
        { status: 500 }
      );
    }

    // Insert generated traders into database
    const createdTraders = [];

    for (const traderConfig of result.traders) {
      try {
        // Convert numeric fields to strings as expected by database schema
        const newTrader = await db
          .insert(traders)
          .values({
            name: traderConfig.name,
            description: traderConfig.description || null,
            status: traderConfig.status || 'enabled',
            aggressivenessLevel: traderConfig.aggressivenessLevel,
            maxLeverage: String(traderConfig.maxLeverage),
            minLeverage: String(traderConfig.minLeverage),
            maxPositions: traderConfig.maxPositions,
            maxPositionSize: String(traderConfig.maxPositionSize),
            minTradeAmount: String(traderConfig.minTradeAmount),
            positionStrategy: traderConfig.positionStrategy || 'none',
            allowShort: traderConfig.allowShort || false,
            maxDrawdown: String(traderConfig.maxDrawdown),
            stopLossThreshold: String(traderConfig.stopLossThreshold),
            positionStopLoss: String(traderConfig.positionStopLoss),
            positionTakeProfit: String(traderConfig.positionTakeProfit),
            maxConsecutiveLosses: traderConfig.maxConsecutiveLosses,
            dailyMaxLoss: String(traderConfig.dailyMaxLoss),
            riskPreferenceScore: traderConfig.riskPreferenceScore,
            heartbeatInterval: traderConfig.heartbeatInterval,
            activeTimeStart: traderConfig.activeTimeStart,
            activeTimeEnd: traderConfig.activeTimeEnd,
            tradingStrategy: traderConfig.tradingStrategy,
            holdingPeriod: traderConfig.holdingPeriod,
          })
          .returning();

        createdTraders.push(newTrader[0]);
      } catch (error) {
        console.error('Error inserting trader:', error);
        // Continue with next trader
      }
    }

    return NextResponse.json({
      success: true,
      created: createdTraders.length,
      requested: count,
      traders: createdTraders,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error in generate traders API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
