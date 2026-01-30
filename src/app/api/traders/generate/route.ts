import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  traders,
  tradingPairs,
  klineIntervals,
  traderKlineIntervals,
  traderReaders,
  readers,
} from '@/db/schema';
import { generateMultipleTraders, type TraderWithRelations } from '@/lib/deepseek';

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

    // Fetch existing traders with relations
    const allTraders = await db.select().from(traders).orderBy(traders.createdAt);
    const [allPairs, allIntervals, allReaders, allIntervalRelations, allReaderRelations] =
      await Promise.all([
        db.select().from(tradingPairs),
        db.select().from(klineIntervals),
        db.select().from(readers),
        db.select().from(traderKlineIntervals),
        db.select().from(traderReaders),
      ]);

    // Build traders with relations
    const existingTraders: TraderWithRelations[] = allTraders.map((trader) => {
      const preferredPair = trader.preferredTradingPairId
        ? allPairs.find((p) => p.id === trader.preferredTradingPairId)
        : undefined;

      const intervalIds = allIntervalRelations
        .filter((r) => r.traderId === trader.id)
        .map((r) => r.klineIntervalId);
      const preferredIntervals = allIntervals.filter((i) => intervalIds.includes(i.id));

      const readerIds = allReaderRelations
        .filter((r) => r.traderId === trader.id)
        .map((r) => r.readerId);
      const traderReaders = allReaders.filter((r) => readerIds.includes(r.id));

      return {
        ...trader,
        preferredTradingPair: preferredPair,
        preferredKlineIntervals: preferredIntervals,
        associatedReaders: traderReaders,
      };
    });

    // Debug: Log available trading pairs and existing traders
    console.log('[Generate API] Available trading pairs:', {
      count: allPairs.length,
      pairs: allPairs.map((p) => ({ id: p.id, symbol: p.symbol, baseAsset: p.baseAsset })),
    });
    console.log('[Generate API] Existing traders with trading pairs:', {
      count: existingTraders.length,
      traders: existingTraders
        .filter((t) => t.preferredTradingPair)
        .map((t) => ({
          name: t.name,
          pairSymbol: t.preferredTradingPair?.symbol,
          pairId: t.preferredTradingPairId,
        })),
    });

    // Create maps for quick lookup
    const pairSymbolToId = Object.fromEntries(allPairs.map((p) => [p.symbol, p.id]));

    // Generate new traders one at a time and insert immediately
    const createdTraders = [];
    const errors = [];

    // Use the generator to process traders as they are generated
    for await (const result of generateMultipleTraders(existingTraders, count)) {
      if (!result.success || !result.trader) {
        errors.push(`Trader ${result.current}/${result.total}: ${result.error || 'Unknown error'}`);
        console.error(`[Generate API] Failed to generate trader ${result.current}/${result.total}`);
        continue;
      }

      const traderConfig = result.trader;
      console.log(
        `[Generate API] Generated trader ${result.current}/${result.total}:`,
        traderConfig.name
      );

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
          errors.push(`Trader ${result.current}: Missing required fields`);
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

        // Insert reader relations if any
        if (
          traderConfig.selectedReaders &&
          Array.isArray(traderConfig.selectedReaders) &&
          traderConfig.selectedReaders.length > 0
        ) {
          const readerRelations = traderConfig.selectedReaders.map((readerId: number) => ({
            traderId,
            readerId,
          }));
          try {
            await db.insert(traderReaders).values(readerRelations);
            console.log(
              `[Generate API] Associated ${readerRelations.length} readers with trader ${traderId}`
            );
          } catch (readerError) {
            console.error('[Generate API] Error inserting reader relations:', readerError);
            // Don't fail the entire trader creation if reader association fails
          }
        }

        createdTraders.push(newTrader[0]);
        console.log(
          `[Generate API] Successfully inserted trader ${result.current}/${result.total}:`,
          traderId
        );
      } catch (error) {
        console.error('[Generate API] Error inserting trader:', error);
        errors.push(
          `Trader ${result.current}: ${error instanceof Error ? error.message : 'Database error'}`
        );
        // Continue with next trader
      }
    }

    // Check if at least one trader was created
    if (createdTraders.length === 0) {
      return NextResponse.json(
        {
          error: 'Failed to generate any traders',
          details: errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: createdTraders.length,
      requested: count,
      traders: createdTraders,
      errors: errors.length > 0 ? errors : undefined,
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
