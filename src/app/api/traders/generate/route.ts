import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { traders, tradingPairs, klineIntervals, traderKlineIntervals } from '@/db/schema';
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

    // Fetch trading pairs and intervals for mapping
    const [allPairs, allIntervals] = await Promise.all([
      db.select().from(tradingPairs),
      db.select().from(klineIntervals),
    ]);

    // Create maps for quick lookup
    const pairSymbolToId = Object.fromEntries(allPairs.map((p) => [p.symbol, p.id]));

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
        // Validate required fields
        if (
          !traderConfig.name ||
          !traderConfig.aggressivenessLevel ||
          !traderConfig.maxLeverage ||
          !traderConfig.minLeverage ||
          !traderConfig.maxPositions ||
          !traderConfig.maxPositionSize ||
          !traderConfig.minTradeAmount ||
          !traderConfig.maxDrawdown ||
          !traderConfig.stopLossThreshold ||
          !traderConfig.positionStopLoss ||
          !traderConfig.positionTakeProfit ||
          !traderConfig.maxConsecutiveLosses ||
          !traderConfig.dailyMaxLoss ||
          !traderConfig.riskPreferenceScore ||
          !traderConfig.activeTimeStart ||
          !traderConfig.activeTimeEnd ||
          !traderConfig.tradingStrategy ||
          !traderConfig.holdingPeriod
        ) {
          console.error('Invalid trader config - missing required fields:', traderConfig);
          continue;
        }

        // Map trading pair symbol to ID
        let preferredTradingPairId: number | null = null;
        if (traderConfig.preferredTradingPair) {
          const symbol = traderConfig.preferredTradingPair.toUpperCase().trim();
          preferredTradingPairId = pairSymbolToId[symbol] || null;
          if (!preferredTradingPairId) {
            console.warn(`Trading pair not found: ${symbol}, skipping`);
          }
        }

        // Map kline interval codes to IDs
        let preferredKlineIntervalIds: number[] = [];
        if (
          traderConfig.preferredKlineIntervals &&
          Array.isArray(traderConfig.preferredKlineIntervals)
        ) {
          preferredKlineIntervalIds = traderConfig.preferredKlineIntervals
            .map((code: string) => {
              const normalizedCode = code.toLowerCase().trim();
              // Try to find the interval by code (case-insensitive)
              const interval = allIntervals.find((i) => i.code.toLowerCase() === normalizedCode);
              return interval ? interval.id : null;
            })
            .filter((id): id is number => id !== null);
        }

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
            heartbeatInterval: 30, // Default heartbeat interval
            activeTimeStart: traderConfig.activeTimeStart,
            activeTimeEnd: traderConfig.activeTimeEnd,
            tradingStrategy: traderConfig.tradingStrategy,
            holdingPeriod: traderConfig.holdingPeriod,
            preferredTradingPairId,
          })
          .returning();

        const traderId = newTrader[0].id;

        // Insert kline interval relations if any
        if (preferredKlineIntervalIds.length > 0) {
          const intervalRelations = preferredKlineIntervalIds.map((klineIntervalId) => ({
            traderId,
            klineIntervalId,
          }));
          await db.insert(traderKlineIntervals).values(intervalRelations);
        }

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
